using System.Collections.Immutable;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;

namespace ChefKnifeStudios.LinkedAssets.Client.Core.Graph;

public sealed record Projection(ImmutableArray<LinkRecord> Links, ImmutableArray<string> Issues);
public static class LinkProjection
{
    public static bool Active(DateTimeOffset? start, DateTimeOffset? end, DateTimeOffset now) =>
        start is { Year: > 1 } s && s <= now && (end is null || now < end);

    public static Projection Normalize(IEnumerable<AssetLinkDto> assets, IEnumerable<AssetLinkDetailsDto> details,
        IEnumerable<DeviceLinkDto> manual, IEnumerable<DeviceDto> devices, DateTimeOffset now,
        Coverage history, bool manualDefaultVerified = false)
    {
        var names = devices.Where(x => x.Id is {Length:>0}).GroupBy(x => x.Id!, StringComparer.Ordinal)
            .ToDictionary(x => x.Key, x => x.Last().Name, StringComparer.Ordinal);
        var periods = details.GroupBy(x => x.AssetLinkId ?? "", StringComparer.Ordinal)
            .ToDictionary(x => x.Key, x => x.DistinctBy(p => p.Id ?? VisualIdentity.Encode(p.Device?.Id ?? "", p.ActiveFrom?.ToString("O") ?? "")).ToArray(), StringComparer.Ordinal);
        var links = ImmutableArray.CreateBuilder<LinkRecord>();
        var issues = ImmutableArray.CreateBuilder<string>();
        void Add(string kind, string id, string rawType, LinkType type, ImmutableArray<MemberPeriod> all, Coverage coverage, IEnumerable<string>? extra = null)
        {
            var local = ImmutableArray.CreateBuilder<string>();
            if (extra is not null) local.AddRange(extra);
            if (all.Any(p => p.Start is null || p.End == DateTimeOffset.MinValue)) local.Add("Some member intervals are unavailable or malformed.");
            if (all.Any(p => string.IsNullOrEmpty(p.DeviceId))) local.Add("Some member identities are unavailable.");
            var members = all.Where(p => Active(p.Start,p.End,now) && !string.IsNullOrEmpty(p.DeviceId))
                .Select(p => p.DeviceId!).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)
                .Select(id => new LinkMember(id,names.GetValueOrDefault(id))).ToImmutableArray();
            if (members.IsEmpty) { issues.Add($"{kind}:{id}: no known active member."); return; }
            if (members.Length == 1) local.Add("Single active member; sibling membership is unavailable or inactive.");
            if (members.Any(m => string.IsNullOrWhiteSpace(m.SourceName))) local.Add("Some device names are unavailable.");
            var recorded = all.Where(p => p.Start is {Year:>1} start && start <= now).Max(p => p.Start);
            var addition = coverage == Coverage.Complete && !all.Any(p => p.Start is null or {Year:1}) ? recorded : null;
            links.Add(new(kind+":"+id,kind,id,rawType,type,all,members,addition,coverage,local.ToImmutable())
                { LatestRecordedAddition = recorded });
        }
        foreach (var asset in assets.DistinctBy(x => x.Id))
        {
            if (string.IsNullOrEmpty(asset.Id)) { issues.Add("AssetLink source identity unavailable."); continue; }
            var type = asset.LinkType switch { "Automatic" => LinkType.Automatic, "AssociatedDevice" => LinkType.ColdChain, _ => (LinkType?)null };
            if (type is null) { issues.Add($"AssetLink:{asset.Id}: unsupported type {asset.LinkType??"unavailable"} excluded."); continue; }
            if (asset.IsActive != true) { if (asset.IsActive is null) issues.Add($"AssetLink:{asset.Id}: activity flag unavailable."); continue; }
            var all = periods.GetValueOrDefault(asset.Id, []).Select(p=>new MemberPeriod(p.Id,p.Device?.Id,p.ActiveFrom,p.ActiveTo)).ToImmutableArray();
            Add("AssetLink",asset.Id,asset.LinkType!,type.Value,all,history);
        }
        foreach (var pair in manual.DistinctBy(x=>x.Id))
        {
            if (string.IsNullOrEmpty(pair.Id)) { issues.Add("DeviceLink source identity unavailable."); continue; }
            var defaulted = pair.LinkType is null && manualDefaultVerified;
            if (pair.LinkType != "Manual" && !defaulted) { issues.Add($"DeviceLink:{pair.Id}: unsupported or unknown type {pair.LinkType??"unavailable"} excluded."); continue; }
            if (!Active(pair.FromDate,pair.ToDate,now))
            { if (pair.FromDate is null || pair.ToDate == DateTimeOffset.MinValue) issues.Add($"DeviceLink:{pair.Id}: interval unavailable."); continue; }
            Add("DeviceLink",pair.Id,pair.LinkType ?? "Manual (verified default)",LinkType.Manual,
                [new(null,pair.SourceDevice?.Id,pair.FromDate,pair.ToDate),new(null,pair.DestinationDevice?.Id,pair.FromDate,pair.ToDate)],
                Coverage.Complete, defaulted ? ["Type uses the verified API default."] : null);
        }
        return new(links.ToImmutable(), issues.ToImmutable());
    }
    public static IEnumerable<LinkRecord> Filter(IEnumerable<LinkRecord> links, string? query, IReadOnlySet<LinkType> enabled)
    {
        var text = query?.Trim() ?? "";
        return links.Where(link => enabled.Contains(link.Type) && (text.Length == 0 || link.Members.Any(m=>
            m.SourceName?.Contains(text,StringComparison.OrdinalIgnoreCase) == true)));
    }
    public static IOrderedEnumerable<LinkRecord> Sort(IEnumerable<LinkRecord> links, SortMode mode) => mode == SortMode.MostRecent
        ? links.OrderBy(x=>x.LatestAddition is null).ThenByDescending(x=>x.LatestAddition).ThenBy(x=>x.Type)
            .ThenBy(x=>x.SourceKind,StringComparer.Ordinal).ThenBy(x=>x.SourceId,StringComparer.Ordinal)
        : links.OrderBy(x=>x.Type).ThenBy(x=>x.LatestAddition is null).ThenByDescending(x=>x.LatestAddition)
            .ThenBy(x=>x.SourceKind,StringComparer.Ordinal).ThenBy(x=>x.SourceId,StringComparer.Ordinal);
}
