using System.Text.Json;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using ChefKnifeStudios.LinkedAssets.Client.Core.Services;
namespace ChefKnifeStudios.LinkedAssets.Client.Tests;
public class StatusTests
{
    [Theory]
    [InlineData("null","null","\"2026-11-21T11:00:00Z\"",Availability.Available,Availability.Missing)]
    [InlineData("0","0","null",Availability.Missing,Availability.Available)]
    [InlineData("91","0","null",Availability.Missing,Availability.Missing)]
    public async Task Position_and_report_availability_are_independent(string lat,string lng,string date,Availability report,Availability position)
    {
        var calls=0;
        using var http=new HttpClient(new ResponseHandler(async(request,ct)=> {
            calls++;
            using var body=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            Assert.Equal("d",body.RootElement.GetProperty("params").GetProperty("search").GetProperty("deviceSearch").GetProperty("id").GetString());
            return ResponseHandler.Json($"{{\"result\":[{{\"device\":{{\"id\":\"d\"}},\"latitude\":{lat},\"longitude\":{lng},\"dateTime\":{date}}}]}}");
        }));
        using var client=new GeotabReadClient(http,TimeProvider.System);
        var statuses=new DeviceStatusService(client);statuses.Reset(1);
        using var selection=new CancellationTokenSource();
        var a=statuses.GetAsync(TransportTests.Session,"d",1,selection.Token);
        var b=statuses.GetAsync(TransportTests.Session,"d",1,selection.Token);
        Assert.Same(a,b);
        var value=await a;Assert.Equal(report,value.ReportAvailability);Assert.Equal(position,value.PositionAvailability);Assert.Equal(1,calls);
        selection.Cancel();
        Assert.Same(a,statuses.GetAsync(TransportTests.Session,"d",1,default));
        statuses.Reset(2);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>statuses.GetAsync(TransportTests.Session,"d",1,default));
    }
}
