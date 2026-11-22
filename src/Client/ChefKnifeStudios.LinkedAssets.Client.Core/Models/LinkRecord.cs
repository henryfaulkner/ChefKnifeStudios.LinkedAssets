using System.Collections.Immutable;
using System.Text;
using System.Text.Json;

namespace ChefKnifeStudios.LinkedAssets.Client.Core.Models;

public enum LinkType { Automatic, Manual, ColdChain }
public enum SortMode { MostRecent, LinkType }
public enum Coverage { Complete, Unverified, Incomplete, Failed }
public enum LoadState { Loading, Ready, Empty, Partial, Failed, Expired }
public enum Availability { Available, Missing, Loading, Denied, Failed }
public sealed record MemberPeriod(string? Id, string? DeviceId, DateTimeOffset? Start, DateTimeOffset? End);
public sealed record LinkMember(string DeviceId, string? SourceName)
{
    public string Label => string.IsNullOrWhiteSpace(SourceName) ? $"Name unavailable ({DeviceId})" : SourceName;
}
public sealed record LinkRecord(string Key, string SourceKind, string SourceId, string RawType, LinkType Type,
    ImmutableArray<MemberPeriod> Periods, ImmutableArray<LinkMember> Members,
    DateTimeOffset? LatestAddition, Coverage HistoryCoverage, ImmutableArray<string> Issues);
public sealed record SourceCoverage(string Source, Coverage Coverage, string? Message = null, bool IsRelationshipSource = false);
public sealed record LinkSnapshot(DateTimeOffset FetchedAt, ImmutableArray<LinkRecord> Links,
    ImmutableArray<SourceCoverage> Sources, ImmutableArray<string> Issues)
{
    public LoadState State => Sources.Where(s=>s.IsRelationshipSource).All(s => s.Coverage == Coverage.Failed) ? LoadState.Failed
        : Sources.Any(s => s.Coverage != Coverage.Complete) || !Issues.IsEmpty ? LoadState.Partial
        : Links.IsEmpty ? LoadState.Empty : LoadState.Ready;
}
public sealed record DeviceSnapshot(string DeviceId, DateTimeOffset? ReportTime, double? Latitude, double? Longitude,
    Availability ReportAvailability, Availability PositionAvailability, string? Error = null)
{
    public static DeviceSnapshot Loading(string id) => new(id, null, null, null, Availability.Loading, Availability.Loading);
}
public sealed record NodePosition(string DeviceId, double X, double Y);
public sealed record GraphPan(double X,double Y);
public sealed record GraphViewport(double X,double Y,double Zoom);
public static class VisualIdentity
{
    public static string Encode(params string[] parts) => Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(parts)));
    public static string Node(string key, string deviceId) => "n" + Encode(key, deviceId);
    public static string Parent(string key) => "p" + Encode(key);
    public static string Segment(string key, string a, string b) => "e" + Encode(key,
        string.CompareOrdinal(a, b) < 0 ? a : b, string.CompareOrdinal(a, b) < 0 ? b : a);
}
