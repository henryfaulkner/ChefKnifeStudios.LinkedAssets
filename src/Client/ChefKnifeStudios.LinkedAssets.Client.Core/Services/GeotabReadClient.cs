using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;

namespace ChefKnifeStudios.LinkedAssets.Client.Core.Services;

public enum ReadFailure { Authentication, Expired, Denied, RateLimited, Network, InvalidResponse, Incomplete }
public sealed class GeotabException(ReadFailure failure) : Exception(failure.ToString())
{
    public ReadFailure Failure { get; } = failure;
}

public sealed class GeotabCredentials
{
    public string Database { get; init; } = "";
    public string UserName { get; init; } = "";
    public string SessionId { get; init; } = "";
    public override string ToString() => "Geotab credentials (redacted)";
}
public sealed class GeotabSession
{
    public string Host { get; init; } = "https://my.geotab.com";
    public GeotabCredentials Credentials { get; init; } = new();
    public Uri ApiUri => new(new Uri(Host), "/apiv1");
    public bool IsValid => HostIsAllowed(Host) && Credentials is {} credentials && !string.IsNullOrWhiteSpace(credentials.SessionId)
        && !string.IsNullOrWhiteSpace(credentials.Database) && !string.IsNullOrWhiteSpace(credentials.UserName);
    public static bool HostIsAllowed(string host) => Uri.TryCreate(host, UriKind.Absolute, out var uri)
        && uri.Scheme == "https" && uri.Port == 443 && uri.UserInfo.Length == 0
        && uri.Query.Length == 0 && uri.Fragment.Length == 0 && uri.AbsolutePath == "/"
        && (uri.Host.Equals("geotab.com", StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith(".geotab.com", StringComparison.OrdinalIgnoreCase));
    public override string ToString() => "Geotab session (redacted)";
}

public sealed record ReadOptions(object? Search = null, int ResultsLimit = 1000, object? Sort = null);
public sealed record RequestPolicy(int RequestsPerMinute = 60, TimeSpan? RetryDelay = null, TimeSpan? Timeout = null);
public interface IGeotabReadClient
{
    Task<GeotabSession> AuthenticateAsync(string userName, string password, string? database, string? server, CancellationToken ct);
    Task<T[]> GetAsync<T>(GeotabSession session, ReadOptions options, CancellationToken ct);
    Task<int> CountDeviceLinksAsync(GeotabSession session, CancellationToken ct);
}

public sealed class GeotabReadClient(HttpClient http, TimeProvider clock, RequestPolicy? policy = null) : IGeotabReadClient, IDisposable
{
    private readonly RequestPolicy _policy = policy ?? new();
    private readonly SemaphoreSlim _concurrency = new(4);
    private readonly Dictionary<string, Queue<DateTimeOffset>> _budgets = new(StringComparer.Ordinal);
    private static string TypeName<T>() => typeof(T) == typeof(DeviceDto) ? "Device"
        : typeof(T) == typeof(AssetLinkDto) ? "AssetLink"
        : typeof(T) == typeof(AssetLinkDetailsDto) ? "AssetLinkDetails"
        : typeof(T) == typeof(DeviceLinkDto) ? "DeviceLink"
        : typeof(T) == typeof(DeviceStatusInfoDto) ? "DeviceStatusInfo"
        : throw new ArgumentException("Read type is not allowed.");
    // Wire fields must match the DTO contracts exactly: an omitted field deserializes as null.
    private static readonly Dictionary<Type, string[]> SelectorFields = new()
    {
        [typeof(DeviceDto)] = ["id", "name"],
        [typeof(AssetLinkDto)] = ["id", "linkType", "isActive"],
        [typeof(AssetLinkDetailsDto)] = ["id", "assetLinkId", "device", "activeFrom", "activeTo"],
        [typeof(DeviceLinkDto)] = ["id", "sourceDevice", "destinationDevice", "linkType", "fromDate", "toDate"],
        [typeof(DeviceStatusInfoDto)] = ["device", "latitude", "longitude", "dateTime"],
    };

    public async Task<GeotabSession> AuthenticateAsync(string userName, string password, string? database, string? server, CancellationToken ct)
    {
        var host = ResolveHost(server);
        var result = await CallAsync<JsonElement>(new Uri(new Uri(host), "/apiv1"), "Authenticate", "Authenticate",
            new { userName, password, database = string.IsNullOrWhiteSpace(database) ? null : database.Trim() }, true, ct);
        try
        {
            var credentials = result.GetProperty("credentials").Deserialize<GeotabCredentials>(WireJson.Options)!;
            var path = result.GetProperty("path").GetString();
            var resolved = path == "ThisServer" ? host : "https://" + path?.TrimEnd('/');
            var session = new GeotabSession { Host = resolved, Credentials = credentials };
            if (!session.IsValid) throw new GeotabException(ReadFailure.InvalidResponse);
            return session;
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        { throw new GeotabException(ReadFailure.InvalidResponse); }
    }

    private static string ResolveHost(string? server)
    {
        var value = string.IsNullOrWhiteSpace(server) ? "my.geotab.com" : server.Trim();
        if (!value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            value = value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ? value : "https://" + value;
        if (!GeotabSession.HostIsAllowed(value)) throw new GeotabException(ReadFailure.InvalidResponse);
        return value;
    }

    public async Task<T[]> GetAsync<T>(GeotabSession session, ReadOptions options, CancellationToken ct)
    {
        if (!session.IsValid) throw new GeotabException(ReadFailure.Expired);
        if (options.ResultsLimit < 1) throw new ArgumentOutOfRangeException(nameof(options));
        var type = TypeName<T>();
        var parameters = new Dictionary<string, object?> { ["credentials"] = session.Credentials, ["typeName"] = type,
            ["resultsLimit"] = options.ResultsLimit, ["propertySelector"] = new { fields = SelectorFields[typeof(T)], isIncluded = true } };
        if (options.Search is not null) parameters["search"] = options.Search;
        if (options.Sort is not null) parameters["sort"] = options.Sort;
        var records=await CallAsync<T[]>(session.ApiUri, "Get", type, parameters, false, ct);
        if(records.Any(record=>record is null))throw new GeotabException(ReadFailure.InvalidResponse);
        return records;
    }
    public Task<int> CountDeviceLinksAsync(GeotabSession session, CancellationToken ct)
    {
        if (!session.IsValid) throw new GeotabException(ReadFailure.Expired);
        return CallAsync<int>(session.ApiUri, "GetCountOf", "DeviceLink", new { typeName = "DeviceLink", credentials = session.Credentials }, false, ct);
    }

    private async Task BudgetAsync(string key, CancellationToken ct)
    {
        while (true)
        {
            TimeSpan wait;
            lock (_budgets)
            {
                if (!_budgets.TryGetValue(key, out var queue)) _budgets[key] = queue = new();
                var now = clock.GetUtcNow();
                while (queue.TryPeek(out var time) && now - time >= TimeSpan.FromMinutes(1)) queue.Dequeue();
                if (queue.Count < Math.Max(1, _policy.RequestsPerMinute)) { queue.Enqueue(now); return; }
                wait = queue.Peek().AddMinutes(1) - now;
            }
            await Task.Delay(wait, clock, ct);
        }
    }

    private async Task<T> CallAsync<T>(Uri uri, string method, string type, object parameters, bool authenticating, CancellationToken ct)
    {
        // No caller can supply a method name: only the three operations above reach this boundary.
        for (var attempt = 0; ; attempt++)
        {
            await BudgetAsync(method + ":" + type, ct);
            await _concurrency.WaitAsync(ct);
            TimeSpan? serverDelay = null;
            ReadFailure? failure = null;
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(_policy.Timeout ?? TimeSpan.FromSeconds(30));
                using var response = await http.PostAsJsonAsync(uri, new { method, @params = parameters }, WireJson.Options, timeout.Token);
                serverDelay = response.Headers.RetryAfter?.Delta
                    ?? (response.Headers.RetryAfter?.Date is { } date ? date - clock.GetUtcNow() : null);
                if (response.StatusCode == HttpStatusCode.Unauthorized) failure = authenticating ? ReadFailure.Authentication : ReadFailure.Expired;
                else if (response.StatusCode == HttpStatusCode.Forbidden) failure = ReadFailure.Denied;
                else if ((int)response.StatusCode == 429) failure = ReadFailure.RateLimited;
                else if (!response.IsSuccessStatusCode) failure = (int)response.StatusCode >= 500 ? ReadFailure.Network : ReadFailure.InvalidResponse;
                else
                {
                    using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(timeout.Token), cancellationToken: timeout.Token);
                    var root = json.RootElement;
                    if (root.TryGetProperty("error", out var error) && error.ValueKind != JsonValueKind.Null)
                    {
                        // Inspect categories only. Never expose server text or authenticated response bodies.
                        var category = error.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "";
                        if (error.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object && data.TryGetProperty("type", out var t)) category += t.GetString();
                        failure = category.Contains("InvalidUser", StringComparison.OrdinalIgnoreCase) || category.Contains("Authentication", StringComparison.OrdinalIgnoreCase)
                            ? authenticating ? ReadFailure.Authentication : ReadFailure.Expired
                            : category.Contains("Security", StringComparison.OrdinalIgnoreCase) || category.Contains("Permission", StringComparison.OrdinalIgnoreCase)
                                ? ReadFailure.Denied
                                : category.Contains("OverLimit", StringComparison.OrdinalIgnoreCase) ? ReadFailure.RateLimited : ReadFailure.InvalidResponse;
                    }
                    else if (root.TryGetProperty("result", out var result))
                    {
                        var value = result.Deserialize<T>(WireJson.Options);
                        if (value is not null) return value;
                        failure = ReadFailure.InvalidResponse;
                    }
                    else failure = ReadFailure.InvalidResponse;
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (OperationCanceledException) { failure = ReadFailure.Network; }
            catch (HttpRequestException) { failure = ReadFailure.Network; }
            catch (JsonException) { failure = ReadFailure.InvalidResponse; }
            catch (InvalidOperationException) { failure = ReadFailure.InvalidResponse; }
            finally { _concurrency.Release(); }
            if (authenticating || attempt >= 2 || failure is not (ReadFailure.Network or ReadFailure.RateLimited))
                throw new GeotabException(failure ?? ReadFailure.InvalidResponse);
            var delay = serverDelay ?? (_policy.RetryDelay ?? TimeSpan.FromMilliseconds(400 * (attempt + 1) + Random.Shared.Next(100)));
            await Task.Delay(delay > TimeSpan.Zero ? delay : TimeSpan.Zero, clock, ct);
        }
    }
    public void Dispose() => _concurrency.Dispose();
}
