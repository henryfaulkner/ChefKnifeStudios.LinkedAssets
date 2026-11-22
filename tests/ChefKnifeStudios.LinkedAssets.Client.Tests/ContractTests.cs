using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;

namespace ChefKnifeStudios.LinkedAssets.Client.Tests;

public class ContractTests
{
    [Fact]
    public void Wire_data_preserves_absence_unknown_types_and_duplicate_periods()
    {
        var source = JsonSerializer.Deserialize<AssetLinkDto>("""{"id":"same","linkType":99,"assetLinkDetails":[{"id":"one","device":{"id":"d"},"activeFrom":"bad"},{"id":"two","device":{"id":"d"}}]}""", WireJson.Options)!;
        Assert.Equal("99", source.LinkType);
        Assert.Null(source.IsActive);
        Assert.Equal(2, source.AssetLinkDetails!.Length);
        Assert.Null(source.AssetLinkDetails[0].ActiveFrom);
        var status = JsonSerializer.Deserialize<DeviceStatusInfoDto>("""{"device":{"id":"d"},"latitude":0}""", WireJson.Options)!;
        Assert.Equal(0, status.Latitude);
        Assert.Null(status.Longitude);
        Assert.Null(status.DateTime);
    }
    [Fact]
    public void Visual_keys_are_collision_safe_across_sources_and_opaque_delimiters()
    {
        Assert.NotEqual(VisualIdentity.Node("AssetLink:same", "d"), VisualIdentity.Node("DeviceLink:same", "d"));
        Assert.NotEqual(VisualIdentity.Node("a:b", "c"), VisualIdentity.Node("a", "b:c"));
        Assert.Equal(VisualIdentity.Segment("x", "a", "b"), VisualIdentity.Segment("x", "b", "a"));
    }
}
