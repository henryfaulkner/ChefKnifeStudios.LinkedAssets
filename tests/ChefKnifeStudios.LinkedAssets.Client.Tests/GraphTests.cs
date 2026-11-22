using System.Collections.Immutable;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using ChefKnifeStudios.LinkedAssets.Client.Core.Graph;
namespace ChefKnifeStudios.LinkedAssets.Client.Tests;
public class GraphTests
{
    [Theory] [InlineData(2,1)] [InlineData(3,3)] [InlineData(4,6)]
    public void Each_link_has_named_independent_nodes_and_all_unordered_pairs(int members,int edges)
    {
        var source=new LinkRecord("AssetLink:same","AssetLink","same","Automatic",LinkType.Automatic,[],
            Enumerable.Range(0,members).Select(i=>new LinkMember(i.ToString(),"Device "+i)).ToImmutableArray(),null,Coverage.Unverified,[]);
        var a=GraphPayload.From(source,"#C62828");var b=GraphPayload.From(source with{Key="AssetLink:other"},"#C62828");
        Assert.Equal(members,a.Members.Length);Assert.Equal(edges,a.Edges.Length);
        Assert.All(a.Members,n=>Assert.StartsWith("Device ",n.Label));
        Assert.Empty(a.Members.Select(n=>n.Id).Intersect(b.Members.Select(n=>n.Id)));
        Assert.Equal(edges,a.Edges.Select(e=>e.Id).Distinct().Count());
    }
}
