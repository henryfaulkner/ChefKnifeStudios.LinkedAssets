using System.Collections.Immutable;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;

namespace ChefKnifeStudios.LinkedAssets.Client.Core.Services;

public sealed record ReadLimits(int PageSize = 1000, int DetailsCap = 1000, int ParentBatchSize = 50, int ManualLimit = 50000,
    bool DetailHistoryVerified = false);
public sealed record SourceRead<T>(ImmutableArray<T> Records, Coverage Coverage, string? Issue = null);
public sealed class SourceReader(IGeotabReadClient client, ReadLimits? limits = null)
{
    private readonly ReadLimits _limits = limits ?? new();
    public Task<SourceRead<DeviceDto>> DevicesAsync(GeotabSession session, CancellationToken ct) =>
        PagesAsync<DeviceDto>(session, null, x => x.Id, ct);
    public Task<SourceRead<AssetLinkDto>> AssetLinksAsync(GeotabSession session, CancellationToken ct) =>
        PagesAsync<AssetLinkDto>(session, new { isActive = true }, x => x.Id, ct);

    private async Task<SourceRead<T>> PagesAsync<T>(GeotabSession session, object? search, Func<T, string?> getId, CancellationToken ct)
    {
        var records = new Dictionary<string, T>(StringComparer.Ordinal);
        var cursors = new HashSet<string>(StringComparer.Ordinal);
        string? offset = null;
        var malformed = false;
        try
        {
            while (true)
            {
                var page = await client.GetAsync<T>(session, new(search, _limits.PageSize,
                    new { sortBy = "id", sortDirection = "asc", offset }), ct);
                var before = records.Count;
                foreach (var row in page)
                    if (getId(row) is { Length: > 0 } id) records[id] = row;
                    else malformed = true;
                if (page.Length < _limits.PageSize)
                    return new(records.Values.ToImmutableArray(), malformed ? Coverage.Incomplete : Coverage.Complete,
                        malformed ? "Some records have no source identity." : null);
                var last = getId(page[^1]);
                if (last is null || !cursors.Add(last) || records.Count == before)
                    return new(records.Values.ToImmutableArray(), Coverage.Incomplete, "Source paging did not advance.");
                offset = last;
            }
        }
        catch (GeotabException ex) when (ex.Failure != ReadFailure.Expired)
        { return new(records.Values.ToImmutableArray(), records.Count == 0 ? Coverage.Failed : Coverage.Incomplete, ex.Failure.ToString()); }
    }

    public async Task<SourceRead<AssetLinkDetailsDto>> DetailsAsync(GeotabSession session, IEnumerable<string> parentIds, CancellationToken ct)
    {
        var parents=parentIds.Distinct(StringComparer.Ordinal).ToArray();
        if(parents.Length==0)return new([],Coverage.Complete);
        var rows = new Dictionary<string, AssetLinkDetailsDto>(StringComparer.Ordinal);
        var complete = true;
        string? issue = null;
        async Task ReadBatch(string[] ids)
        {
            var result = await client.GetAsync<AssetLinkDetailsDto>(session, new(new { assetLinkIds = ids }, _limits.DetailsCap), ct);
            if (result.Length >= _limits.DetailsCap && ids.Length > 1)
            {
                await ReadBatch(ids[..(ids.Length / 2)]);
                await ReadBatch(ids[(ids.Length / 2)..]);
                return;
            }
            if (result.Length >= _limits.DetailsCap) { complete = false; issue = "A link's member history reached the read limit."; }
            foreach (var row in result)
            {
                if (row.Id is { Length: > 0 } id && row.AssetLinkId is { } parent && ids.Contains(parent, StringComparer.Ordinal)) rows[id] = row;
                else { complete = false; issue = "Malformed or unrelated member history was returned."; }
            }
        }
        try
        {
            foreach (var batch in parents.Chunk(_limits.ParentBatchSize)) await ReadBatch(batch);
        }
        catch (GeotabException ex) when (ex.Failure != ReadFailure.Expired)
        { complete = false; issue = "Member history read failed: " + ex.Failure; }
        return new(rows.Values.ToImmutableArray(), !complete ? Coverage.Incomplete : _limits.DetailHistoryVerified ? Coverage.Complete : Coverage.Unverified,
            issue ?? (!_limits.DetailHistoryVerified ? "Full member history has not been verified against this server." : null));
    }

    public async Task<SourceRead<DeviceLinkDto>> DeviceLinksAsync(GeotabSession session, CancellationToken ct)
    {
        DeviceLinkDto[] rows = [];
        try
        {
            for (var attempt = 0; attempt < 2; attempt++)
            {
                var before = await client.CountDeviceLinksAsync(session, ct);
                if (before < 0 || before >= _limits.ManualLimit)
                    return new([], Coverage.Incomplete, "Manual link count exceeds the supported complete-read limit.");
                var response = await client.GetAsync<DeviceLinkDto>(session, new(ResultsLimit:Math.Max(1, before + 1)), ct);
                rows = response.Where(x => !string.IsNullOrEmpty(x.Id)).DistinctBy(x => x.Id, StringComparer.Ordinal).ToArray();
                var after = await client.CountDeviceLinksAsync(session, ct);
                if (before == after && rows.Length == after && response.All(x => !string.IsNullOrEmpty(x.Id)))
                    return new(rows.ToImmutableArray(), Coverage.Complete);
            }
            return new(rows.ToImmutableArray(), Coverage.Incomplete, "Manual link count changed or the server truncated the read.");
        }
        catch (GeotabException ex) when (ex.Failure != ReadFailure.Expired)
        { return new(rows.ToImmutableArray(), rows.Length == 0 ? Coverage.Failed : Coverage.Incomplete, ex.Failure.ToString()); }
    }
}
