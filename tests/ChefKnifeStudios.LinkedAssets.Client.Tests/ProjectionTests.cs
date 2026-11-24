using System.Collections.Immutable;
using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Graph;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;

namespace ChefKnifeStudios.LinkedAssets.Client.Tests;
public class ProjectionTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-21T12:00:00Z");
    private static Projection Fixture(Coverage history = Coverage.Complete)
    {
        using var json = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"fixtures","basic.json")));
        T[] Rows<T>(string name) => json.RootElement.GetProperty(name).Deserialize<T[]>(WireJson.Options)!;
        return LinkProjection.Normalize(Rows<AssetLinkDto>("AssetLink"),Rows<AssetLinkDetailsDto>("AssetLinkDetails"),
            Rows<DeviceLinkDto>("DeviceLink"),Rows<DeviceDto>("Device"),Now,history);
    }
    [Fact]
    public void Source_records_remain_independent_with_duplicate_members_collapsed_only_within_link()
    {
        var links=Fixture().Links;
        Assert.Equal(3,links.Length);
        Assert.Equal(7,links.Sum(l=>l.Members.Length));
        Assert.Equal(2,links.Count(l=>l.SourceId=="same"));
        Assert.Equal(2,links.Count(l=>l.Members.Any(m=>m.DeviceId=="d1")));
    }
    [Fact]
    public void Addition_evidence_uses_active_members_and_unverified_history_orders_by_recorded_evidence()
    {
        var links=Fixture().Links;
        var order=new[]{"DeviceLink:same","AssetLink:same","AssetLink:cold"};
        Assert.Equal(DateTimeOffset.Parse("2026-11-01T00:00:00Z"),links.Single(x=>x.Type==LinkType.Automatic).LatestAddition);
        Assert.Equal(order,LinkProjection.Sort(links,SortMode.MostRecent).Select(l=>l.Key));
        foreach (var coverage in new[] {Coverage.Incomplete,Coverage.Unverified})
        {
            var unverified=Fixture(coverage).Links;
            var automatic=unverified.Single(x=>x.Type==LinkType.Automatic);
            Assert.Null(automatic.LatestAddition);
            Assert.Equal(DateTimeOffset.Parse("2026-11-01T00:00:00Z"),automatic.LatestRecordedAddition);
            Assert.Equal(order,LinkProjection.Sort(unverified,SortMode.MostRecent).Select(l=>l.Key));
        }
    }
    [Theory]
    [InlineData("",3)] [InlineData("   ",3)] [InlineData("TRACTOR",2)] [InlineData(" bravo ",2)] [InlineData("absent",0)]
    public void Search_matches_source_names_and_keeps_whole_graphs(string query,int count)
    {
        var result=LinkProjection.Filter(Fixture().Links,query,new HashSet<LinkType>(Enum.GetValues<LinkType>())).ToArray();
        Assert.Equal(count,result.Length);
        if(query.Contains("TRACTOR")) Assert.Contains(result,x=>x.Members.Length==3);
    }
    [Fact]
    public void Type_filter_applies_even_with_empty_search_and_all_off()
    {
        Assert.Single(LinkProjection.Filter(Fixture().Links,"",new HashSet<LinkType>{LinkType.Manual}));
        Assert.Empty(LinkProjection.Filter(Fixture().Links,"",new HashSet<LinkType>()));
    }
    [Theory]
    [InlineData(-1,1,true)] [InlineData(0,1,true)] [InlineData(-1,0,false)] [InlineData(1,2,false)]
    public void Membership_has_inclusive_start_exclusive_end(int start,int end,bool active) =>
        Assert.Equal(active,LinkProjection.Active(Now.AddHours(start),Now.AddHours(end),Now));
    [Fact]
    public void Malformed_end_does_not_turn_into_an_open_link()
    {
        var pair=JsonSerializer.Deserialize<DeviceLinkDto>("""{"id":"x","linkType":"Manual","fromDate":"2026-11-01T00:00:00Z","toDate":"bad","sourceDevice":{"id":"d"}}""",WireJson.Options)!;
        var projection=LinkProjection.Normalize([],[],[pair],[],Now,Coverage.Complete);
        Assert.Empty(projection.Links); Assert.NotEmpty(projection.Issues);
    }
    [Fact]
    public void Known_recency_type_ties_and_recorded_fallbacks_are_deterministic_with_unknowns_last()
    {
        var sample=Fixture().Links[0];
        var a=sample with{Key="AssetLink:a",SourceId="a",Type=LinkType.Automatic,LatestAddition=Now.AddDays(-1),LatestRecordedAddition=null};
        var b=sample with{Key="AssetLink:b",SourceId="b",Type=LinkType.Automatic,LatestAddition=Now.AddDays(-1),LatestRecordedAddition=null};
        var c=sample with{Key="DeviceLink:c",SourceKind="DeviceLink",SourceId="c",Type=LinkType.Manual,LatestAddition=Now,LatestRecordedAddition=null};
        var recorded=sample with{Key="AssetLink:r",SourceId="r",LatestAddition=null,LatestRecordedAddition=Now.AddDays(-2)};
        var unknown=sample with{Key="AssetLink:u",SourceId="u",LatestAddition=null,LatestRecordedAddition=null};
        Assert.Equal(new[]{c.Key,a.Key,b.Key,recorded.Key,unknown.Key},LinkProjection.Sort(new[]{unknown,recorded,b,c,a},SortMode.MostRecent).Select(l=>l.Key));
        Assert.Equal(new[]{a.Key,b.Key,recorded.Key,unknown.Key,c.Key},LinkProjection.Sort(new[]{unknown,recorded,b,c,a},SortMode.LinkType).Select(l=>l.Key));
    }
    [Fact]
    public void Future_additions_missing_endpoints_and_unsupported_types_are_not_invented()
    {
        var asset=new AssetLinkDto("a","Automatic",true,null,null,null);
        var projection=LinkProjection.Normalize([asset],[new("current","a",new("d"),Now.AddDays(-1),null),new("future","a",new("future"),Now.AddDays(1),null)],
            [new("m",new("d"),null,"Manual",Now.AddDays(-2),null,null),new("camera",new("d"),new("d2"),"Camera",Now.AddDays(-1),null,null)],[],Now,Coverage.Complete);
        Assert.Equal(2,projection.Links.Length);
        Assert.All(projection.Links,l=>Assert.Single(l.Members));
        Assert.Equal(Now.AddDays(-1),projection.Links.Single(l=>l.SourceId=="a").LatestAddition);
        Assert.Equal(Now.AddDays(-1),projection.Links.Single(l=>l.SourceId=="a").LatestRecordedAddition);
        Assert.Contains(projection.Issues,issue=>issue.Contains("DeviceLink:camera",StringComparison.Ordinal));
    }
}
