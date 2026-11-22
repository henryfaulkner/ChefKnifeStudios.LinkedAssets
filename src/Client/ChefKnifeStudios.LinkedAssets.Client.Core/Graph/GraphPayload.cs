using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
namespace ChefKnifeStudios.LinkedAssets.Client.Core.Graph;

public sealed record GraphNode(string Id,string DeviceId,string Label);
public sealed record GraphEdge(string Id,string Source,string Target);
public sealed record GraphPayload(string Key,string ParentId,GraphNode[] Members,GraphEdge[] Edges,string Color)
{
    public static GraphPayload From(LinkRecord link,string color)
    {
        var nodes=link.Members.OrderBy(m=>m.DeviceId,StringComparer.Ordinal).Select(m=>new GraphNode(VisualIdentity.Node(link.Key,m.DeviceId),m.DeviceId,m.Label)).ToArray();
        var edges=new List<GraphEdge>();
        for(var i=0;i<nodes.Length;i++)for(var j=i+1;j<nodes.Length;j++)
            edges.Add(new(VisualIdentity.Segment(link.Key,nodes[i].DeviceId,nodes[j].DeviceId),nodes[i].Id,nodes[j].Id));
        return new(link.Key,VisualIdentity.Parent(link.Key),nodes,edges.ToArray(),color);
    }
}
