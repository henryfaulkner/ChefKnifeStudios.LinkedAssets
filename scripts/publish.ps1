$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $workspaceRoot = [System.IO.Path]::GetFullPath((Get-Location).Path)
    $publishRoot = [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot 'artifacts/client'))
    if (-not $publishRoot.StartsWith($workspaceRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or (Split-Path $publishRoot -Leaf) -ne 'client') { throw 'Publish output must remain inside this workspace.' }
    if (Test-Path -LiteralPath $publishRoot) { Remove-Item -LiteralPath $publishRoot -Recurse -Force }
    dotnet publish src/Client/ChefKnifeStudios.LinkedAssets.Client.WebApp -c Release -o artifacts/client
    if ($LASTEXITCODE -ne 0) { throw 'Release publish failed.' }
    $mapSettings = @{ Map = @{ LightStyleUrl = [string]$env:LINKED_ASSETS_MAP_LIGHT_STYLE_URL; DarkStyleUrl = [string]$env:LINKED_ASSETS_MAP_DARK_STYLE_URL } }
    $mapSettings | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath artifacts/client/wwwroot/appsettings.json -Encoding utf8
    # The SDK compressed the source settings before publish-time configuration was injected.
    # Keep precompressed runtime assets, but serve this small configuration from its updated JSON.
    foreach ($suffix in @('.br', '.gz')) {
        $compressedSettings = Join-Path $publishRoot ('wwwroot/appsettings.json' + $suffix)
        if (Test-Path -LiteralPath $compressedSettings) { Remove-Item -LiteralPath $compressedSettings -Force }
    }
    python scripts/validate-publish.py artifacts/client/wwwroot
    if ($LASTEXITCODE -ne 0) { throw 'Published artifact validation failed.' }
} finally { Pop-Location }
