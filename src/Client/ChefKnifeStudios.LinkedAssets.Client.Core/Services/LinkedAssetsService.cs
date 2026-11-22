using System.Collections.Immutable;
using ChefKnifeStudios.LinkedAssets.Client.Core.Graph;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;

namespace ChefKnifeStudios.LinkedAssets.Client.Core.Services;

public sealed class LinkedAssetsService(SourceReader reader, TimeProvider clock)
{
    public async Task<LinkSnapshot> LoadAsync(GeotabSession session, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var assetsTask = reader.AssetLinksAsync(session,ct);
        var namesTask = reader.DevicesAsync(session,ct);
        var manualTask = reader.DeviceLinksAsync(session,ct);
        var assets = await assetsTask;
        var detailsTask = reader.DetailsAsync(session, assets.Records.Select(x=>x.Id!), ct);
        await Task.WhenAll(namesTask,manualTask,detailsTask);
        var names = await namesTask; var manual = await manualTask; var details = await detailsTask;
        var projection = LinkProjection.Normalize(assets.Records,details.Records,manual.Records,names.Records,now,details.Coverage);
        return new(now,projection.Links,
            [new("Automatic / Cold Chain links",assets.Coverage,assets.Issue,true),new("Member history",details.Coverage,details.Issue),
             new("Manual links",manual.Coverage,manual.Issue,true),new("Device names",names.Coverage,names.Issue)],projection.Issues);
    }
}

public sealed class DeviceStatusService(IGeotabReadClient client)
{
    private readonly Dictionary<string, (Task<DeviceSnapshot> Task, CancellationToken Token)> _cache = new(StringComparer.Ordinal);
    private long _generation;
    public void Reset(long generation) { lock (_cache) { _generation = generation; _cache.Clear(); } }
    public Task<DeviceSnapshot> GetAsync(GeotabSession session, string id, long generation, CancellationToken ct)
    {
        lock (_cache)
        {
            if (generation != _generation) throw new OperationCanceledException(ct);
            if (!_cache.TryGetValue(id,out var entry) || entry.Task.IsCanceled || (entry.Token.IsCancellationRequested&&!entry.Task.IsCompletedSuccessfully))
                _cache[id] = entry = (ReadAsync(session,id,ct),ct);
            return entry.Task;
        }
    }
    private async Task<DeviceSnapshot> ReadAsync(GeotabSession session,string id,CancellationToken ct)
    {
        try
        {
            var rows = await client.GetAsync<DeviceStatusInfoDto>(session,
                new(new { deviceSearch = new { id }, includeUntrackedDevices = true }),ct);
            var status = rows.Where(x=>x.Device?.Id==id).OrderByDescending(x=>x.DateTime).FirstOrDefault();
            if (status is null) return new(id,null,null,null,Availability.Missing,Availability.Missing);
            var position = status.Latitude is { } lat && double.IsFinite(lat) && lat is >= -90 and <= 90
                && status.Longitude is { } lng && double.IsFinite(lng) && lng is >= -180 and <= 180;
            return new(id,status.DateTime,status.Latitude,status.Longitude,status.DateTime is null ? Availability.Missing : Availability.Available,
                position ? Availability.Available : Availability.Missing);
        }
        catch (GeotabException ex) when (ex.Failure != ReadFailure.Expired)
        {
            var availability = ex.Failure == ReadFailure.Denied ? Availability.Denied : Availability.Failed;
            return new(id,null,null,null,availability,availability,ex.Failure.ToString());
        }
    }
}
