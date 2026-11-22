using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using ChefKnifeStudios.LinkedAssets.Client.Core.Services;
namespace ChefKnifeStudios.LinkedAssets.Client.Tests;
public sealed class FixedClock(DateTimeOffset instant):TimeProvider
{
    public override DateTimeOffset GetUtcNow()=>instant;
}
public class ApplicationTests
{
    [Fact]
    public async Task Unknown_manual_type_is_an_explicit_partial_snapshot_instead_of_confirmed_empty()
    {
        using var http=new HttpClient(new ResponseHandler(async(request,ct)=>{
            using var json=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            if(json.RootElement.GetProperty("method").GetString()=="GetCountOf")return ResponseHandler.Json("{\"result\":1}");
            return ResponseHandler.Json(json.RootElement.GetProperty("params").GetProperty("typeName").GetString()=="DeviceLink"
                ? """{"result":[{"id":"unknown-type","fromDate":"2026-11-01T00:00:00Z","sourceDevice":{"id":"a"},"destinationDevice":{"id":"b"}}]}"""
                : "{\"result\":[]}");
        }));
        var clock=new FixedClock(DateTimeOffset.Parse("2026-11-21T12:00:00Z"));
        using var client=new GeotabReadClient(http,clock);
        var result=await new LinkedAssetsService(new SourceReader(client),clock).LoadAsync(TransportTests.Session,default);
        Assert.Equal(LoadState.Partial,result.State);Assert.Empty(result.Links);Assert.NotEmpty(result.Issues);
    }
    [Theory]
    [InlineData(false,false,LoadState.Empty)]
    [InlineData(true,false,LoadState.Partial)]
    [InlineData(true,true,LoadState.Failed)]
    public async Task A_confirmed_empty_database_is_distinct_from_unavailable_sources(bool denyAssets,bool denyManual,LoadState expected)
    {
        var now=DateTimeOffset.Parse("2026-11-21T12:00:00Z");
        using var http=new HttpClient(new ResponseHandler(async(request,ct)=>{
            using var json=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            var type=json.RootElement.GetProperty("params").GetProperty("typeName").GetString();
            if((denyAssets&&type=="AssetLink")||(denyManual&&type=="DeviceLink"))return ResponseHandler.Json("""{"error":{"name":"SecurityException"}}""");
            return ResponseHandler.Json(json.RootElement.GetProperty("method").GetString()=="GetCountOf"?"{\"result\":0}":"{\"result\":[]}");
        }));
        using var client=new GeotabReadClient(http,new FixedClock(now));
        var result=await new LinkedAssetsService(new SourceReader(client),new FixedClock(now)).LoadAsync(TransportTests.Session,default);
        Assert.Equal(now,result.FetchedAt);Assert.Equal(expected,result.State);Assert.Empty(result.Links);
    }
}
