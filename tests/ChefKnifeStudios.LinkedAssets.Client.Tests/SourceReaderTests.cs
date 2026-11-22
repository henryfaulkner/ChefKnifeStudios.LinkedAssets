using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using ChefKnifeStudios.LinkedAssets.Client.Core.Services;

namespace ChefKnifeStudios.LinkedAssets.Client.Tests;

public class SourceReaderTests
{
    private static (GeotabReadClient Client, HttpClient Http) Client(Func<JsonElement, object> respond)
    {
        var http = new HttpClient(new ResponseHandler(async (request, ct) => {
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            return ResponseHandler.Json(JsonSerializer.Serialize(new { result = respond(body.RootElement) }, WireJson.Options));
        }));
        return (new(http, TimeProvider.System, new(RetryDelay:TimeSpan.Zero)), http);
    }
    [Fact]
    public async Task Id_paging_preserves_all_records_without_duplicates()
    {
        var seen = new List<string?>();
        var (client, http) = Client(body => {
            var sort = body.GetProperty("params").GetProperty("sort");
            Assert.False(sort.TryGetProperty("lastId", out _));
            var offset = sort.GetProperty("offset").GetString(); seen.Add(offset);
            return offset is null ? new[] { new {id="a",name="Alpha"}, new {id="b",name="Bravo"} } : new[] { new {id="c",name="Charlie"} };
        });
        using (client) using (http)
        {
            var result = await new SourceReader(client, new(PageSize:2)).DevicesAsync(TransportTests.Session, default);
            Assert.Equal(Coverage.Complete, result.Coverage);
            Assert.Equal(new[] {"a","b","c"}, result.Records.Select(x => x.Id));
            Assert.Equal(new string?[] {null,"b"}, seen);
        }
    }
    [Fact]
    public async Task Repeating_full_page_is_visibly_incomplete()
    {
        var (client, http) = Client(_ => new[] { new {id="a"}, new {id="b"} });
        using (client) using (http)
        {
            var result = await new SourceReader(client,new(PageSize:2)).DevicesAsync(TransportTests.Session,default);
            Assert.Equal(Coverage.Incomplete,result.Coverage);
            Assert.Equal(2,result.Records.Length);
        }
    }
    [Theory]
    [InlineData(2, 2, Coverage.Complete)]
    [InlineData(3, 2, Coverage.Incomplete)]
    public async Task Manual_enumeration_compares_unfiltered_distinct_count(int expected, int actual, Coverage coverage)
    {
        var (client,http) = Client(body => {
            var p=body.GetProperty("params"); Assert.False(p.TryGetProperty("search",out _));
            return body.GetProperty("method").GetString()=="GetCountOf" ? expected : Enumerable.Range(0,actual).Select(i=>new {id=i.ToString(),linkType="Manual"}).ToArray();
        });
        using(client) using(http) Assert.Equal(coverage,(await new SourceReader(client).DeviceLinksAsync(TransportTests.Session,default)).Coverage);
    }
    [Fact]
    public async Task Capped_member_batch_splits_and_retains_ended_history()
    {
        var requests = 0;
        var (client,http) = Client(body => {
            requests++;
            return body.GetProperty("params").GetProperty("search").GetProperty("assetLinkIds").EnumerateArray().Select(id=>new {id="period-"+id.GetString(), assetLinkId=id.GetString(), device=new{id="shared"},activeFrom="2026-11-01T00:00:00Z",activeTo="2026-11-02T00:00:00Z"}).ToArray();
        });
        using(client) using(http)
        {
            var result = await new SourceReader(client,new(DetailsCap:2,DetailHistoryVerified:true)).DetailsAsync(TransportTests.Session,["a","b"],default);
            Assert.Equal(Coverage.Complete,result.Coverage); Assert.Equal(2,result.Records.Length); Assert.Equal(3,requests);
            Assert.All(result.Records,x=>Assert.NotNull(x.ActiveTo));
        }
    }
    [Fact]
    public async Task Single_parent_at_cap_has_incomplete_history()
    {
        var (client,http) = Client(_=>new[]{new {id="p",assetLinkId="a"}});
        using(client) using(http) Assert.Equal(Coverage.Incomplete,(await new SourceReader(client,new(DetailsCap:1,DetailHistoryVerified:true)).DetailsAsync(TransportTests.Session,["a"],default)).Coverage);
    }
    [Fact]
    public async Task Changing_manual_counts_repeat_the_entire_read_once()
    {
        var counts=0;var reads=0;
        var(client,http)=Client(body=>{
            if(body.GetProperty("method").GetString()=="GetCountOf")return ++counts==1?2:3;
            return Enumerable.Range(0,++reads==1?2:3).Select(i=>new{id=i.ToString()}).ToArray();
        });
        using(client) using(http){var result=await new SourceReader(client).DeviceLinksAsync(TransportTests.Session,default);Assert.Equal(Coverage.Complete,result.Coverage);Assert.Equal(3,result.Records.Length);Assert.Equal(2,reads);Assert.Equal(4,counts);}
    }
}
