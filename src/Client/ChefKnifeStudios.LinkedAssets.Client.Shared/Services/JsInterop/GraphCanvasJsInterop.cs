using ChefKnifeStudios.LinkedAssets.Client.Core.Graph;
using ChefKnifeStudios.LinkedAssets.Client.Core.Models;
using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;
namespace ChefKnifeStudios.LinkedAssets.Client.Shared.Services.JsInterop;

public sealed record LayoutChange(string Key,NodePosition[] Positions);
public sealed class GraphCanvasJsInterop(IJSRuntime js) : IAsyncDisposable
{
    private IJSObjectReference? _module;
    private int _id;
    private Task? _initialization;
    public Task CreateAsync<T>(ElementReference element,DotNetObjectReference<T> callbacks,object theme) where T:class =>
        _initialization=CreateCoreAsync(element,callbacks,theme);
    private async Task CreateCoreAsync<T>(ElementReference element,DotNetObjectReference<T> callbacks,object theme) where T:class
    {
        _module=await js.InvokeAsync<IJSObjectReference>("import","./_content/ChefKnifeStudios.LinkedAssets.Client.Shared/js/graph-canvas.js");
        _id=await _module.InvokeAsync<int>("create",element,callbacks,theme);
    }
    public ValueTask<LayoutChange[]> CaptureAsync()=>_module!.InvokeAsync<LayoutChange[]>("captureActive",_id);
    public ValueTask<LayoutChange[]> ReplaceAsync(long revision,GraphPayload[] graphs,Dictionary<string,object> positions)=>
        _module!.InvokeAsync<LayoutChange[]>("replaceSnapshot",_id,revision,graphs,positions);
    public ValueTask<LayoutChange[]> VisibleAsync(long revision,string[] keys,bool reflow)=>_module!.InvokeAsync<LayoutChange[]>("setVisible",_id,revision,keys,reflow);
    public ValueTask SelectionAsync(long revision,string? key)=>_module!.InvokeVoidAsync("setSelection",_id,revision,key);
    public ValueTask ThemeAsync(object theme,GraphPayload[] graphs)=>_module!.InvokeVoidAsync("setTheme",_id,theme,graphs);
    public ValueTask<LayoutChange[]> ArrangeAsync(long revision,string[] keys)=>_module!.InvokeAsync<LayoutChange[]>("arrange",_id,revision,keys);
    public ValueTask NavigateAsync(string action,string? key,string? deviceId=null,double dx=0,double dy=0)=>
        _module!.InvokeVoidAsync("navigate",_id,action,key,deviceId,dx,dy);
    public async ValueTask DisposeAsync()
    {
        if(_initialization is not null){try{await _initialization;}catch(JSDisconnectedException){return;}}
        if(_module is null)return;
        try{await _module.InvokeVoidAsync("dispose",_id);await _module.DisposeAsync();}catch(JSDisconnectedException){ }
    }
}
