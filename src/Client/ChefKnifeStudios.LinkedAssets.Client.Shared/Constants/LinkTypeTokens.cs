using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
namespace ChefKnifeStudios.LinkedAssets.Client.Shared.Constants;
public static class LinkTypeTokens
{
    public static string Label(LinkType type)=>type==LinkType.ColdChain?"Cold Chain":type.ToString();
    public static string Color(LinkType type,bool dark)=>type switch
    {
        LinkType.Automatic=>dark?"#FF8A80":"#C62828",
        LinkType.Manual=>dark?"#81C784":"#2E7D32",
        _=>dark?"#90CAF9":"#1565C0"
    };
}
