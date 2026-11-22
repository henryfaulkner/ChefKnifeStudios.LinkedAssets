using System.Net;
using System.Text;
using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using ChefKnifeStudios.LinkedAssets.Client.Core.Services;

namespace ChefKnifeStudios.LinkedAssets.Client.Tests;

public sealed class ResponseHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(request, ct);
    public static HttpResponseMessage Json(string json, HttpStatusCode code = HttpStatusCode.OK) => new(code) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
}
public class TransportTests
{
    [Theory]
    [InlineData("[]")]
    [InlineData("{\"error\":17}")]
    [InlineData("{\"result\":[null]}")]
    public async Task Malformed_rpc_envelopes_and_null_records_fail_safely(string body)
    {
        using var http=new HttpClient(new ResponseHandler((_,_)=>Task.FromResult(ResponseHandler.Json(body))));
        using var client=new GeotabReadClient(http,TimeProvider.System);
        Assert.Equal(ReadFailure.InvalidResponse,(await Assert.ThrowsAsync<GeotabException>(()=>client.GetAsync<DeviceDto>(Session,new(),default))).Failure);
    }
    [Fact]
    public async Task Corrupt_null_credentials_are_rejected_without_crashing_restore_or_authentication()
    {
        var corrupted=JsonSerializer.Deserialize<GeotabSession>("""{"host":"https://my.geotab.com","credentials":null}""",WireJson.Options)!;
        Assert.False(corrupted.IsValid);
        using var http=new HttpClient(new ResponseHandler((_,_)=>Task.FromResult(ResponseHandler.Json("""{"result":{"path":"ThisServer","credentials":null}}"""))));
        using var client=new GeotabReadClient(http,TimeProvider.System);
        var failure=await Assert.ThrowsAsync<GeotabException>(()=>client.AuthenticateAsync("fixture","test-only",null,default));
        Assert.Equal(ReadFailure.InvalidResponse,failure.Failure);
    }
    internal static GeotabSession Session => new() { Credentials = new() { Database = "test-only", UserName = "fixture", SessionId = "not-live" } };
    [Theory]
    [InlineData("InvalidUserException", ReadFailure.Expired)]
    [InlineData("SecurityException", ReadFailure.Denied)]
    [InlineData("UnknownFailure", ReadFailure.InvalidResponse)]
    public async Task Http_200_rpc_errors_are_failures_and_not_retried(string category, ReadFailure expected)
    {
        var requests = 0;
        using var http = new HttpClient(new ResponseHandler((_, _) => { requests++; return Task.FromResult(ResponseHandler.Json($"{{\"error\":{{\"name\":\"{category}\",\"message\":\"private details\"}},\"result\":[]}}")); }));
        using var client = new GeotabReadClient(http, TimeProvider.System);
        var ex = await Assert.ThrowsAsync<GeotabException>(() => client.GetAsync<DeviceDto>(Session, new(), default));
        Assert.Equal(expected, ex.Failure);
        Assert.DoesNotContain("private", ex.Message);
        Assert.Equal(1, requests);
    }
    [Fact]
    public async Task Transient_failures_retry_only_twice()
    {
        var count = 0;
        using var http = new HttpClient(new ResponseHandler((_, _) => { count++; return Task.FromResult(ResponseHandler.Json("{}", HttpStatusCode.ServiceUnavailable)); }));
        using var client = new GeotabReadClient(http, TimeProvider.System, new(RetryDelay:TimeSpan.Zero));
        await Assert.ThrowsAsync<GeotabException>(() => client.GetAsync<DeviceDto>(Session, new(), default));
        Assert.Equal(3, count);
    }
    [Fact]
    public async Task Cancelled_requests_do_not_become_user_errors_or_retries()
    {
        using var cts = new CancellationTokenSource();
        using var http = new HttpClient(new ResponseHandler((_, ct) => { cts.Cancel(); ct.ThrowIfCancellationRequested(); throw new Exception(); }));
        using var client = new GeotabReadClient(http, TimeProvider.System);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.GetAsync<DeviceDto>(Session, new(), cts.Token));
    }
    [Theory]
    [InlineData("https://my.geotab.com", true)]
    [InlineData("https://my123.geotab.com", true)]
    [InlineData("https://geotab.com.evil.test", false)]
    [InlineData("https://user@my.geotab.com", false)]
    [InlineData("http://my.geotab.com", false)]
    [InlineData("https://my.geotab.com/steal", false)]
    public void Session_hosts_are_restricted(string host, bool allowed) => Assert.Equal(allowed, GeotabSession.HostIsAllowed(host));
    [Theory]
    [InlineData(401,ReadFailure.Expired)] [InlineData(403,ReadFailure.Denied)]
    public async Task Http_access_errors_are_not_empty_successes(int code,ReadFailure expected)
    {
        using var http=new HttpClient(new ResponseHandler((_,_)=>Task.FromResult(ResponseHandler.Json("{}",(HttpStatusCode)code))));
        using var client=new GeotabReadClient(http,TimeProvider.System);
        Assert.Equal(expected,(await Assert.ThrowsAsync<GeotabException>(()=>client.GetAsync<DeviceDto>(Session,new(),default))).Failure);
    }
    [Fact]
    public async Task Rate_limits_honor_retry_after_and_stop_after_three_requests()
    {
        var count=0;
        using var http=new HttpClient(new ResponseHandler((_,_)=>{count++;var response=ResponseHandler.Json("{}",(HttpStatusCode)429);response.Headers.RetryAfter=new(TimeSpan.Zero);return Task.FromResult(response);}));
        using var client=new GeotabReadClient(http,TimeProvider.System,new(RetryDelay:TimeSpan.Zero));
        Assert.Equal(ReadFailure.RateLimited,(await Assert.ThrowsAsync<GeotabException>(()=>client.GetAsync<DeviceDto>(Session,new(),default))).Failure);Assert.Equal(3,count);
    }
}
