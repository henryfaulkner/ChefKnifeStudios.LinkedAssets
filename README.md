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

There is no production demo mode. A fresh checkout displays sign-in until actual Geotab access is supplied. Request a public demo database using the design's [acquisition guide](docs/implementation-design.md#11-test-data-acquisition-without-employee-credentials), record its actual expiry, and arrange an API user with read access to Device, AssetLink, AssetLinkDetails, DeviceLink and DeviceStatusInfo. Do not commit credentials. Sample vehicles alone do not guarantee all three link categories exist.

AssetLink member history remains explicitly unverified until the target server's limits and complete history are proven under LA-005/LA-037. Those links show “Addition time unavailable” and sort after known addition dates. Missing DeviceLink types are excluded until the target's default encoding is verified. Refresh is manual; known membership boundaries also trigger reevaluation. A failed refresh retains the prior snapshot and labels it stale.

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

Stop any existing process on port 5180 before the managed static-host run. The Python host is test tooling that applies the SWA fallback/header contract; it is never published as an application backend. To test a running development host instead, leave both `LA_*` variables unset. Hosting-only checks skip in that mode.

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

`bicep/main.bicep` defines one resource group and one Static Web App, with an empty API location and generated workflow creation disabled. It has only been built locally. No Azure resources were provisioned during local implementation.

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
