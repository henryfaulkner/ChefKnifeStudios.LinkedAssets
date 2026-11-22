namespace ChefKnifeStudios.LinkedAssets.Client.Core.Services;

public interface ISessionStore
{
    Task<GeotabSession?> ReadAsync();
    Task WriteAsync(GeotabSession? session);
}
public sealed class GeotabSessionService(IGeotabReadClient client, ISessionStore store)
{
    public GeotabSession? Current { get; private set; }
    private long _generation;
    public async Task RestoreAsync()
    {
        var generation = ++_generation;
        GeotabSession? session = null;
        try { session = await store.ReadAsync(); } catch { }
        if (generation != _generation) return;
        Current = session?.IsValid == true ? session : null;
        if (Current is null) await ClearStoredAsync();
    }
    public async Task SignInAsync(string userName, string password, string? database, CancellationToken ct)
    {
        var generation = ++_generation;
        Current = null;
        await ClearStoredAsync();
        var session = await client.AuthenticateAsync(userName.Trim(), password, database, ct);
        if (generation != _generation || ct.IsCancellationRequested) return;
        Current = session;
        try { await store.WriteAsync(session); } catch { }
        if (generation != _generation) await ClearStoredAsync();
    }
    public async Task SignOutAsync()
    {
        ++_generation;
        Current = null;
        await ClearStoredAsync();
    }
    private async Task ClearStoredAsync() { try { await store.WriteAsync(null); } catch { } }
}
