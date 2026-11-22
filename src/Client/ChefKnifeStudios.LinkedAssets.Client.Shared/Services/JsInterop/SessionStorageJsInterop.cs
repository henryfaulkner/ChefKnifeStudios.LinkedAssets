using ChefKnifeStudios.LinkedAssets.Client.Core.Services;
using Microsoft.JSInterop;
namespace ChefKnifeStudios.LinkedAssets.Client.Shared.Services.JsInterop;

public sealed class SessionStorageJsInterop(IJSRuntime js) : ISessionStore, IAsyncDisposable
{
    private Task<IJSObjectReference>? _module;
    private Task<IJSObjectReference> Module => _module ??= js.InvokeAsync<IJSObjectReference>("import",
        "./_content/ChefKnifeStudios.LinkedAssets.Client.Shared/js/browser-storage.js").AsTask();
    public async Task<GeotabSession?> ReadAsync() => await (await Module).InvokeAsync<GeotabSession?>("readSession");
    public async Task WriteAsync(GeotabSession? session) => await (await Module).InvokeVoidAsync("writeSession",session);
    public async ValueTask DisposeAsync()
    {
        if (_module is not null) { try { await (await _module).DisposeAsync(); } catch (JSDisconnectedException) { } }
    }
}
