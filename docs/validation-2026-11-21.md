# Local validation evidence — 2026-11-21

This records acceptance evidence, not implementation status. The [canonical checklist](implementation-design.md#implementation-checklist) owns objective states. Validation used the working tree based on `55f65c7c305d47705fea0b28858eea9bdcec2336`; the implementation has not been committed or deployed by this session.

The Release solution builds without warnings. `dotnet test -c Release --no-restore` passes 52 tests covering wire contracts, opaque identities, complete graphs, intervals, departed-member addition recency, deterministic sorts, source completeness, independent report/position availability, HTTP/RPC failures, cancellation, bounded retries, invalid credentials and malformed responses.

The browser suite has 54 functional scenarios across Chromium and Firefox. A complete 52-scenario run passed, followed by eight focused passes covering the new activity-boundary scenario and stronger narrow-screen, open-blade refresh and rendered-pin checks. Combining those reports yields 54 unique passing scenarios, with zero unexpected or flaky outcomes. Tests execute the published WASM application with test-owned request interception. The separate graph/map spikes load the production adapters and pinned libraries.

Raw local reports are in `artifacts/validation/browser-results.json`, `targeted-results.json` and `performance-results.json`, with console logs beside them. These generated files are excluded from version control. Commands to reproduce them are in [README](../README.md).

| Requirement | Local evidence |
| --- | --- |
| R01 — client-only/read-only | WebApp → Shared → Core; no backend project or proxy. Observed RPC methods are Authenticate, Get and GetCountOf. Graph manipulation and filtering do not write source data. Published-content validation excludes fixtures, test logins and stale assembly fingerprints. |
| R02 — Transit Jazz conventions | Inspected startup/project boundaries, ObservableObject, HTTP handling, lazy interop/disposal, active palettes, MatThemeProvider, Roboto, blade CSS, MapLibre bridge and deployment references. Adaptation decisions remain in design section 3. |
| R03–R05 — source identity and rendering | Synthetic Automatic/AssociatedDevice AssetLinks plus Manual DeviceLinks; cross-source same IDs, repeated periods and shared devices. Named 2/3/4-member graphs have 1/3/6 segments. Exact graph/key colors match in both themes. Live semantics remain unverified. |
| R06 — manipulation | Real pointer node/group/edge movement, blank/Space pan, zoom, cancellation and arranging during a drag. Later pointer deltas cannot undo the arrangement. Keyboard movement supports whole groups and individual members. |
| R07 — overlay | Desktop and 390×844 canvas rectangles stay unchanged on selection/open/close. Selection updates the existing nonmodal blade; Escape/Close return focus. Narrow Browse controls can select another link while details remain open. |
| R08 — maps | First creation renders all 25 member pins in the actual blade; assertions query MapLibre's rendered pin layer. Spikes cover coincident points, antimeridian bounds and explicit polar-projection failure. Full style reload restores current-selection pins; report bullets survive map errors. Provider access is not proved by blank local test styles. |
| R09 — reports | Every member has a bullet, with independent missing/denied states. Browser Intl formatting distinguishes repeated 01:30 EDT/EST instants and retains separate UTC details. |
| R10–R11 — filters | Empty/whitespace/case-insensitive source-name search, complete matching graphs, combined type filters, all-off/zero-match states, no per-keystroke RPCs, retained hidden coordinates and cleared hidden selection. |
| R12 — sorts | Pure tests include departed-member additions, future/sentinel/missing dates and stable ties. Browser checks preserve internal graph shape while arranging. Unknown history never becomes known recency. |
| R13 — delivery | Bicep builds locally to one staticSites resource with an empty API location and workflow generation disabled. One workflow has validation/artifact/deployment stages. Static-host tests prove fallback, missing-asset 404s and the Production header. Remote CI, provisioning and deployed-origin checks have not run. |
| R14 — verification/scope | Deterministic synthetic manifest, fixed test clock, fake HTTP handlers, browser interception, pinned assets/licenses and fixture-free static output. No employee account, synthetic production fallback or Geotab mutation path was added. |

The activity-boundary test advances a fixed browser clock past a known member start. The app performs a new read, preserves the existing moved nodes and places the joining member near its own graph. Distant boundaries use bounded browser timer waits; a failed refresh retains labelled prior data and does not start a retry loop.

Performance was measured after loading, using Release output on Windows 11 build 26200, Intel Core i9-13900HX, 32 logical processors and 63.7 GiB reported memory. Playwright 1.58.2 uses Chromium 145.0.7632.6; the functional second engine is Firefox 146.0.1. The app viewport is 1280×720; the isolated graph host is 1400×900. API responses were intercepted fixtures; live API latency was not measured.

| Measurement | Observed | Target |
| --- | --- | --- |
| Rendered content | 500 independent links, 2,000 visual nodes, 5,995 segments | No omitted members, names or pairwise segments |
| Adapter filter-to-paint p95 | 90.6 ms, 10 samples | ≤150 ms |
| Full WASM filter-to-paint p95 | 113 ms, 20 samples | ≤150 ms |
| Drag frame interval p95 | 16.8 ms, 1,005 intervals over 16.77 seconds | ≤33 ms over at least 10 seconds |
| Selection/close/theme lifecycle | 20 cycles per engine; zero active MapLibre instances after each close; one graph owner retained | No accumulating instances/listeners |

Chromium is the recorded performance baseline. Earlier Firefox stress probes produced roughly 33–42 ms drag p95; its functional checks pass, but a ≤33 ms Firefox performance claim is not made. Hardware-dependent thresholds are separate from the portable CI functional suite. No threshold, topology or label requirement was relaxed.

Visual review uses `artifacts/validation/default.png`, `details.png`, `dark.png` and `narrow.png`, generated by `node tests/browser/capture.mjs` from its documented working directory. These show synthetic data and local blank map styles, not a live tenant or provider. Mouse/keyboard automation and visual inspection were performed; physical touch hardware and a screen reader were not exercised.

External evidence remains necessary: an accessible sandbox and expiry, actual enum/error/no-fix shapes and source permissions, full member history and enumeration, localhost/deployed CORS, real map-provider attribution/access, an Azure hostname/scoped token, a remote CI run, deployed smoke checks and an exercised rollback. AssetLink addition dates remain unavailable in production until history completeness is proved. All implementation state and these dependencies remain in the canonical checklist.
