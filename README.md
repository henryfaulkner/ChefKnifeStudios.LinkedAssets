# Linked Assets

A read-only, client-side Blazor application for exploring Geotab linked assets as an interactive graph.

The [constitution](.specify/memory/constitution.md) defines the requirements. The [end-to-end design](docs/implementation-design.md) covers architecture, Geotab contracts, Transit Jazz reuse, graph behavior, validation, test data and deployment.

The [implementation checklist](docs/implementation-design.md#implementation-checklist), after the design section, is the **single source of truth for implementation status**. Implementation agents must read, reference and update it throughout their work; see [AGENTS.md](AGENTS.md).

Layout references: [default canvas](docs/linked-assets-default-mockup.png), [details blade](docs/linked-assets-details-blade-mockup.png), and [original broader mockup](docs/linked-assets-mockup.png).

For development without Geotab employee credentials, follow [test-data acquisition](docs/implementation-design.md#11-test-data-acquisition-without-employee-credentials): public demo/sandbox access for live integration, with test-only fixtures for deterministic local and CI verification.

The application runs as standalone .NET 10 Blazor WebAssembly. Production domain data is read directly from Geotab; local test fixtures are supplied only by test tooling. The canonical checklist records verified behavior and remaining live/deployment gates.

## Run locally

Prerequisites: .NET SDK 10.0.401 (see `global.json`), the `wasm-tools` workload, Node.js 20.9+ for browser tests, Python 3.10+ for static artifact checks, and Azure CLI/Bicep only for infrastructure validation.

```powershell
dotnet workload install wasm-tools
dotnet restore --locked-mode
dotnet run --project src/Client/ChefKnifeStudios.LinkedAssets.Client.WebApp --no-launch-profile --urls http://localhost:5180
```

Open `http://localhost:5180`. Enter your Geotab username/password and, if needed, database. Passwords are cleared after each attempt. Sessions live in memory and tab `sessionStorage`; only theme preferences use `localStorage`. Storage failures retain an in-memory session/preference. Sign-out clears this app's stored session and presentation state.

Restores disable the SDK's implicit local package source so the lock file uses canonical NuGet.org packages on Windows and Linux. If an existing SDK-sourced cache entry causes `NU1403`, use an isolated cache without weakening hash validation: set `$env:NUGET_PACKAGES = Join-Path (Get-Location) 'artifacts/nuget-packages'`, then rerun `dotnet restore --locked-mode` and subsequent build/publish commands in that shell.

There is no production demo mode. A fresh checkout displays sign-in until actual Geotab access is supplied. Request a public demo database using the design's [acquisition guide](docs/implementation-design.md#11-test-data-acquisition-without-employee-credentials), record its actual expiry, and arrange an API user with read access to Device, AssetLink, AssetLinkDetails, DeviceLink and DeviceStatusInfo. Do not commit credentials. Sample vehicles alone do not guarantee all three link categories exist.

AssetLink member history remains explicitly unverified until the target server's limits and complete history are proven under LA-005/LA-037. Those links show “Addition time unavailable” and sort after known addition dates. Missing DeviceLink types are excluded until the target's default encoding is verified. Refresh is manual; known membership boundaries also trigger reevaluation. A failed refresh retains the prior snapshot and labels it stale.

## Explore locally with mock data

Start the app at `https://localhost:7099/`, the preview's default target, then open another terminal. To use the HTTP Run locally command above instead, set `$env:LA_PREVIEW_URL = 'http://localhost:5180'` before launching the preview:

```powershell
cd tests/browser
npm ci
npx playwright install chromium
npm run preview
```

This opens a separate Chromium window, signs in with test-only values, and displays three synthetic links: Automatic, Manual and Cold Chain. You can drag graphs, search, toggle types, sort and open details with fixture positions/report times. The preview uses OpenFreeMap street maps in light and dark themes with the actual pin renderer; internet access is required, and no map key is needed. A yellow MOCK DATA notice identifies this window. Close it or press Ctrl+C to stop.

All Geotab API responses in this window are intercepted locally; no real username/password or unlocked account is needed. If you sign out, enter any nonempty username/password to sign back into the preview. Reload retains the mock session. Normal browser windows still require actual Geotab access. The fixtures and launcher remain in test tooling and are excluded from the published app. Live access verification remains open under LA-004/LA-037.

## Agent verification UI

Wrap optional verification controls in the shared `AgentOnly` component:

```razor
<AgentOnly>
    <button @onclick="VerifyFeature">Verify feature</button>
</AgentOnly>
```

The wrapper renders its contents only when the current URL includes `agent=true`, for example `https://localhost:7099/?agent=true`. Append `&agent=true` when other query parameters are present. Omitting the parameter or setting `agent=false` hides the contents entirely, including from keyboard navigation and the accessibility tree. URL changes update the wrapper; no preference is persisted. Use this wrapper for all agent-only visibility decisions instead of parsing the URL or adding CSS rules in individual controls.

This is an explicit presentation opt-in that anyone can use, not agent detection or an authorization boundary. It uses the same application state and actions. Refresh, snapshot status/source coverage, zoom/Fit controls, and Browse links are available only inside this wrapper for agent verification tasks; it is disabled while reads are running.

## Tests without an account

```powershell
dotnet build -c Release --no-restore
dotnet test -c Release --no-build
./scripts/publish.ps1
Push-Location tests/browser
npm ci
npx playwright install chromium firefox
$env:LA_STATIC_HOST = '1'
$env:LA_START_STATIC_HOST = '1'
npx playwright test --grep-invert 'stress fixture|scale node|published WASM app filters'
Pop-Location
az bicep build --file bicep/main.bicep --outfile artifacts/infra/main.json
```

Stop any existing process on port 5180 before the managed static-host run. The Python host is test tooling that applies the SWA fallback/header contract; it is never published as an application backend. To test a running development host instead, leave `LA_STATIC_HOST` and `LA_START_STATIC_HOST` unset. Browser tests and `capture.mjs` default to `https://localhost:7099/`, matching the preview; set `LA_PREVIEW_URL` to target another development URL. Hosting-only checks skip in development mode.

Fixtures and their provenance/count manifest are under `tests/fixtures/geotab`; browser interception is in `tests/browser/fixtures.js`. Tests run the production transport, normalization, view model and adapters. Release publishing checks that fixtures and test logins are absent from `artifacts/client/wwwroot`.

For hardware-dependent performance checks, start the published static host and run:

```powershell
# Terminal 1, repository root
python tests/browser/static-server.py artifacts/client/wwwroot
# Terminal 2, repository root
Push-Location tests/browser
$env:LA_STATIC_HOST = '1'
npx playwright test --project=chromium --grep 'stress fixture|scale node|published WASM app filters'
node capture.mjs
Pop-Location
```

The scale set has 500 independent links, 2,000 visual nodes and 5,995 pairwise segments, with shared device identities. Chromium is the measured performance baseline. Firefox receives the functional suite; its observed stress drag latency remains documented in the validation evidence. `capture.mjs` writes synthetic-test screenshots to `artifacts/validation`; they are not production data.

## Maps and static delivery

Development map styles may be supplied in WebApp `wwwroot/appsettings.json`. Publishing takes public browser style URLs from `LINKED_ASSETS_MAP_LIGHT_STYLE_URL` and `LINKED_ASSETS_MAP_DARK_STYLE_URL` and writes the published configuration. Use a separate provider browser key restricted to localhost/the eventual HTTPS hostname. No Geotab credentials belong in this configuration. Without map styles, details still show report times and an explicit map-configuration message.

```powershell
$env:LINKED_ASSETS_MAP_LIGHT_STYLE_URL = 'https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_PUBLIC_BROWSER_KEY'
$env:LINKED_ASSETS_MAP_DARK_STYLE_URL = 'https://api.maptiler.com/maps/streets-v2-dark/style.json?key=YOUR_PUBLIC_BROWSER_KEY'
./scripts/publish.ps1
```

`bicep/main.bicep` defines one resource group and one Free Static Web App, with an empty API location and generated workflow creation disabled. On 2026-11-22, Azure validation and deployment of the unchanged template succeeded in the ChefKnifeStudios subscription. The target is `linked-assets-rg/linked-assets-swa` in `eastus2`, with hostname `white-forest-0daca9d0f.5.azurestaticapps.net`. Provisioning the host does not upload the application files or establish product acceptance; see LA-043–LA-046 in the canonical checklist.

All Azure infrastructure changes must go through Bicep. Reproduce the validation and deployment with:

```powershell
$subscriptionId = 'd2f70759-7eeb-4ca5-9046-f7c8d562ef8f'
az bicep build --file bicep/main.bicep --outfile artifacts/infra/main.json
az deployment sub validate --subscription $subscriptionId --name linked-assets-infra --location eastus2 --template-file bicep/main.bicep
az deployment sub what-if --subscription $subscriptionId --name linked-assets-infra --location eastus2 --template-file bicep/main.bicep
az deployment sub create --subscription $subscriptionId --name linked-assets-infra --location eastus2 --template-file bicep/main.bicep
```

Review what-if before applying. Azure's response omits `buildProperties` and includes service-managed properties such as `stableInboundIP` and `trafficSplitting`, so what-if can report a modification after successful provisioning. Do not copy these read-only properties into Bicep or perform portal/CLI resource adjustments to eliminate that report.

The sole workflow is `.github/workflows/client.yml`. PRs validate; main/manual runs deploy only after repository variable `LINKED_ASSETS_RELEASE_READY` is set to `true`. Leave that unset until the checklist's live and delivery prerequisites pass. It uses public style URL repository variables with the same names as the publish environment variables and secret `AZURE_STATIC_WEB_APPS_API_TOKEN_LINKED_ASSETS`, scoped to the one SWA. No secret value is stored here.

Static rollback uses that same workflow's optional `artifact_run_id` to download a known-good retained client artifact. Artifacts are named by source revision and retained for 30 days. This path must still be exercised against the actual host under LA-047; no deployment/rollback is claimed by local tests.

Troubleshooting: distinguish source permission errors from an empty source; inspect the in-app coverage notice before assuming all links loaded. Expired access requires sign-in again. Tile/style/WebGL failures leave member reports usable. Restart the development host after JS asset changes so its fingerprint manifest is rebuilt. Do not copy authenticated request bodies into logs or issues. A demo expiry requires renewed live access; it never activates synthetic fallback data. See the [local validation evidence](docs/validation-2026-11-21.md) for measured scope and limitations.

## Spec Kit

[GitHub Spec Kit](https://github.com/github/spec-kit) v1.4.3 is installed locally for Codex, with nine skills in `.agents/skills`, templates and PowerShell scripts in `.specify`, and the bundled specification workflow.

Open Codex in this directory. Start with `$speckit-constitution`, then `$speckit-specify`, `$speckit-plan`, `$speckit-tasks`, and `$speckit-implement`. Additional skills are `$speckit-clarify`, `$speckit-checklist`, `$speckit-analyze`, and `$speckit-converge`.

The constitution is populated at v1.1.0. If using Spec Kit for subsequent features, preserve its rules and the design's confirmed decisions. Generated tasks must reference the canonical implementation checklist rather than establish a competing status ledger. Spec Kit requirements-quality checklists serve a different purpose from implementation status.

To invoke the pinned CLI without changing the machine's shared installation:

```powershell
uvx --from 'git+https://github.com/github/spec-kit.git@v1.4.3' specify --help
```
