using MatBlazor;
namespace ChefKnifeStudios.LinkedAssets.Client.Shared.Constants;
public static class ThemeTokens
{
    public static MatTheme Create(bool dark) => new()
    {
        Primary = dark ? "#90A4AE" : "#37474F", Secondary = dark ? "#78909C" : "#546E7A",
        Surface = dark ? "#1A1C1E" : "#F5F5F5", Background = dark ? "#1A1C1E" : "#F5F5F5",
        OnPrimary = dark ? "#1C3440" : "#FFFFFF", OnSecondary = dark ? "#1A2E38" : "#FFFFFF",
        OnSurface = dark ? "#E2E2E6" : "#1A1C1E"
    };
}
