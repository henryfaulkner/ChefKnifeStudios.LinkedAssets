using Blazored.LocalStorage;
namespace ChefKnifeStudios.LinkedAssets.Client.Shared.Services;
public sealed class SettingsService(ILocalStorageService storage)
{
    public bool IsDark { get; private set; }
    public event EventHandler? ThemeChanged;
    private long _revision;
    private Task _save=Task.CompletedTask;
    public async Task InitializeAsync()
    {
        var revision=_revision;
        var dark=false;
        try { dark = await storage.GetItemAsync<bool>("linked-assets-dark"); }
        catch { }
        if(revision!=_revision)return;
        IsDark=dark;
        ThemeChanged?.Invoke(this, EventArgs.Empty);
    }
    public async Task ToggleAsync()
    {
        ++_revision;IsDark = !IsDark;
        ThemeChanged?.Invoke(this, EventArgs.Empty);
        _save=SaveAfterAsync(_save,IsDark);await _save;
    }
    private async Task SaveAfterAsync(Task previous,bool dark){await previous;try{await storage.SetItemAsync("linked-assets-dark",dark);}catch{}}
}
