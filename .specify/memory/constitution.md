# Linked Assets Constitution

## Core Principles

### I. Read-Only, Client-Side Operation

The application MUST be read-only with respect to Geotab data: it MUST NOT create, update,
or delete devices, links, or other source records. Moving graph elements, changing the
viewport, filtering, sorting, and selecting links MUST be local presentation operations.
The application MUST execute entirely in the browser, using client-side Blazor, without
an application backend, proxy, server-rendered runtime, or server-side data store.
All application domain data MUST be sourced from Geotab's public APIs, including device
records and names, reported positions, report times, linked assets, and link metadata.
Every source read MUST use Geotab's property selector to limit each response to the
fields the application's read contracts actually consume; unconsumed members, such as
embedded asset-link detail history inside AssetLink records, MUST NOT be requested.
The selected fields MUST match the application's deserialization contracts exactly so
required data is never silently omitted, and any change to a read contract MUST update
its property selection in the same change.
(Amended 2026-11-23: full-record reads caused avoidable transfer and browser-side
parsing load; measured on alpha, property selection reduced a 20-record Device page
from 73,361 to 848 bytes. Affected artifacts: GeotabReadClient selector map,
TransportTests, implementation-design section 11.2.)
Local presentation state, such as graph layout, filters, selection, and theme preferences,
MUST remain distinct from Geotab source data. Geotab authentication UI MUST expose only
the inputs and steps required to establish or restore access.
These constraints keep exploration independent of source-data mutation and server operations.

### II. Blazor and C# with Transit Jazz Architecture

The application MUST use .NET Blazor and MUST be written primarily in C#.
Another language MUST have a concrete purpose, such as lightweight JavaScript interop
for a JavaScript library or Bicep infrastructure definitions.
C# project organization, component and service boundaries, dependency injection, and
utility conventions MUST closely resemble Transit Jazz. Implementation planning MUST
inspect Transit Jazz and identify applicable code structures and utilities to copy or adapt.
Developers MUST maximize reuse of applicable Transit Jazz structures and utilities before
creating equivalents. Reuse MUST remain subject to the client-only boundary and YAGNI;
unneeded Transit Jazz subsystems MUST NOT be imported solely for structural similarity.

Transit Jazz source is fixed at `C:/Projects/ChefKnifeStudios.TransitJazz`.
The following are direct implementation references, subject to the reuse and YAGNI rules above:

- **Project boundaries and startup:** [WebApp project](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/ChefKnifeStudios.TransitJazz.Client.WebApp.csproj),
  [Client.Shared project](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/ChefKnifeStudios.TransitJazz.Client.Shared.csproj), and
  [Client.Core project](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Core/ChefKnifeStudios.TransitJazz.Client.Core.csproj)
  demonstrate the WebAssembly host, Razor component library, and client service layer.
  [Program.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/Program.cs) shows host creation, configuration, DI lifetimes, MatBlazor,
  and local-storage registration. Copy the applicable boundaries and registrations;
  Transit Jazz's SignalR, transit endpoints, and server projects are outside this app's scope.
- **View models and events:** [BaseViewModel.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/BaseViewModel.cs) supplies CommunityToolkit.Mvvm
  observable state; [ViewModels/RouteFilterViewModel.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/ViewModels/RouteFilterViewModel.cs) is a concrete consumer.
  [Services/EventNotificationService.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Core/Services/EventNotificationService.cs) defines typed event contracts and dispatch.
  Use these as references for filter, selection, and theme state when that structure is needed.
- **HTTP utilities:** [Services/HttpService.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Core/Services/HttpService.cs) and
  [Services/HttpServiceFactory.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Core/Services/HttpServiceFactory.cs) show HTTP wrapping, results, logging, and client
  construction. Adapt only operations required for Geotab authentication and public data reads.
  The presence of mutation helpers in Transit Jazz does not authorize Geotab data mutations.
- **Browser interop:** [Services/JsInterop/ViewportSizeJsInterop.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Services/JsInterop/ViewportSizeJsInterop.cs),
  [Services/JsInterop/IViewportSizeJsInterop.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Services/JsInterop/IViewportSizeJsInterop.cs), and
  [wwwroot/js/viewportSizeJsInterop.js](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/wwwroot/js/viewportSizeJsInterop.js) demonstrate lazy module import, typed callbacks,
  resize debouncing, subscription cleanup, logging, and asynchronous disposal.
  [Services/JsInterop/OutsideClickJsInterop.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Services/JsInterop/OutsideClickJsInterop.cs) is the companion reference for
  outside-click registration and cleanup.

### III. Transit Jazz UI and Purposeful Libraries

The UI MUST follow Transit Jazz typography, color palette, Material theme, light/dark
mode behavior, mapping conventions, and modular component philosophy, including MatBlazor
and its theming patterns. Implementation plans MUST identify the Transit Jazz references
used to reproduce these conventions.
Library choices MUST favor the best fit for the required behavior and MUST be either
Blazor-native libraries or JavaScript libraries usable through lightweight JS interop.
Library selection MUST record the relevant capability and integration tradeoffs.
JavaScript interop MUST remain limited to the capabilities needed from the selected library;
it MUST NOT become a second application framework or duplicate C# application logic.

The project-owned low-fidelity mockups MUST guide component location, relative size, and
shape during UI design:

- [Default canvas mockup](../../docs/linked-assets-default-mockup.png): search at the
  upper left, a compact link-type key near the upper center, independent link graphs
  distributed across the main canvas, and vertically stacked sorting buttons at the
  lower left. Graph nodes are small labeled dots joined by thin colored segments.
- [Details blade mockup](../../docs/linked-assets-details-blade-mockup.png): a tall
  rectangular blade anchored to the right edge, with a rectangular recent-positions map
  near its top and a bulleted device report-time list immediately below it.

These images define the layout and component silhouettes; Transit Jazz defines typography,
palette, Material styling, and light/dark presentation. Their sketch styling and exact pixel
dimensions are illustrative. The blade MUST overlay the full canvas as specified below;
its illustrated boundary does not imply resizing the canvas. Every device node MUST retain
its required name label even where a mockup omits one. The original broader design reference
remains at [linked-assets-mockup.png](../../docs/linked-assets-mockup.png).

Direct UI references in the Transit Jazz source tree:

- **Typography and theme assets:** [wwwroot/css/app.css](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/wwwroot/css/app.css) defines Roboto typography
  and base styles; [wwwroot/css/variables.css](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/wwwroot/css/variables.css) supplies base palette tokens.
  [wwwroot/css/mdc-overrides.css](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/wwwroot/css/mdc-overrides.css) contains Material component overrides and
  `.mj-dark` styling. [wwwroot/index.html](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/wwwroot/index.html) shows stylesheet/script loading.
- **Theme composition:** [Constants/ColorConstants.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Constants/ColorConstants.cs) contains the active
  `Light` and `Dark` palettes; the `LightNotUsed` and `DarkNotUsed` classes are not the
  active reference. [Layout/MainLayout.razor](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.WebApp/Layout/MainLayout.razor) builds `MatTheme` values, applies
  `MatThemeProvider`, switches the `mj-dark` class, and unsubscribes theme events.
- **Light/dark preferences:** [Components/FABs/DarkModeFab.razor](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/FABs/DarkModeFab.razor),
  [Services/SettingsService.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Services/SettingsService.cs), and [Models/Settings.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Models/Settings.cs)
  show the toggle and local preference storage.
  [Services/SettingsChangeController.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Services/SettingsChangeController.cs) and
  [EventArgs/ThemeChangedEventArgs.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/EventArgs/ThemeChangedEventArgs.cs) show change coordination and notification.
  Reuse the theme-related behavior without importing unrelated transit or audio settings.
- **Modular components and blades:** [Components/Blades/BladeContainer.razor](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Blades/BladeContainer.razor),
  [Components/Blades/BladeContainer.razor.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Blades/BladeContainer.razor.cs), and
  [Components/Blades/BladeContainer.razor.css](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Blades/BladeContainer.razor.css) show content composition,
  open/close methods, cleanup, and a fixed right-hand overlay with a slide transition.
  [Components/Blades/SettingsBlade.razor](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Blades/SettingsBlade.razor) shows its composition into a feature.
  Adapt outside-click behavior so selecting another link updates the open details blade.
  [Components/RouteFilterList.razor](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/RouteFilterList.razor) and
  [Components/RouteFilterList.razor.css](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/RouteFilterList.razor.css) provide filter-component structure and
  styling references; Linked Assets still requires its own strike-through key toggles.
- **Mapping:** [Components/Map.razor](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Map.razor),
  [Components/Map.razor.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Map.razor.cs), and [Components/Map.razor.Helper.cs](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/Components/Map.razor.Helper.cs)
  show the map host, lifecycle, and C# integration.
  [wwwroot/js/map-interop.js](C:/Projects/ChefKnifeStudios.TransitJazz/src/Client/ChefKnifeStudios.TransitJazz.Client.Shared/wwwroot/js/map-interop.js) implements the MapLibre `ChefMap` bridge,
  GeoJSON point rendering, and `LngLatBounds`/`fitBounds` use in `plotFeatures`.
  Adapt that viewport logic: the reference limits fitting to 20 points and returns before
  fitting when first adding a source. Linked Assets MUST fit every available member position
  on initial display, as already required below. Reuse map setup and theme conventions
  without importing live vehicle tracking, route animation, or audio behavior.

### IV. Prototype Simplicity and YAGNI

Implementation MUST use the smallest working design that satisfies current requirements.
Code, abstractions, dependencies, configuration, and extension points MUST serve an existing
requirement. Speculative infrastructure, future-only features, and unused generalization
MUST NOT be introduced. Transit Jazz reuse and library adoption MUST reduce implementation
work without bringing unnecessary scope. This prototype strategy prioritizes usable behavior
and rapid iteration while preserving the explicit architectural boundaries.

### V. Independent Link Graphs

Linked assets MUST include both Geotab `AssetLink` and `DeviceLink` records:

- `AssetLink` MUST supply automatic links and cold-chain associated links.
- `DeviceLink` MUST supply manual links.

The application MUST preserve each link's source record identity and link type when
combining these sources for display. Link membership and classification MUST come from
Geotab API data so the graphs represent the source relationships.

Each link MUST be an atomic, independent graph. Each member device MUST appear as a node
within that link and connect to sibling linked devices through line segments.
Every device node MUST display the device's name.
When a device belongs to multiple links, each link MUST render its own separate node for
that device; shared device identity MUST NOT merge link graphs or their visual nodes.
All nodes and connecting segments within a link MUST use the link color represented by
the corresponding link-type label in the key. This preserves each link's identity even
when devices participate in several relationships.

## Product Behavior

- **Canvas interaction:** Links and device nodes MUST be movable. Link layouts MUST support
  flexible size and shape, with connections following node movement. Canvas navigation and
  graph manipulation MUST provide fluid whiteboard-style interaction comparable to tldraw.
  The comparison defines the UX expectation and does not mandate the tldraw library.
- **Selection and details:** Clicking a link MUST open the details blade when closed and
  populate it with the selected link. Clicking a link while the blade is open MUST update
  its contents. The blade MUST overlay the canvas rather than resize it.
- **Map:** The details blade MUST contain a still embedded map with a pin at each selected
  member device's most recently reported position. Its initial viewport MUST fit all
  available device positions for that link. Missing positions MUST be identified without
  inventing coordinates. The map MUST represent reported positions without animated playback.
- **Report times:** The blade MUST contain a bulleted list identifying each member device
  and its most recent report time. Missing report times MUST be explicitly identified.
- **Empty search:** An empty search textbox MUST apply no device-name restriction. With
  all link-type toggles on, all links available to the application MUST be shown. Link-type
  toggles MUST remain effective when the textbox is empty.
- **Device-name search:** The textbox MUST filter links as the user types, retaining only
  links with at least one member device whose name contains the input text. Matching MUST
  retain the entire link graph, including its other member devices.
  When no member device matches, the entire link graph MUST disappear, including every
  node, name label, connecting line segment, and group outline.
- **Key toggles:** Every link-type label in the key MUST be a toggle that defaults to on.
  Clicking an on label MUST strike through its text and exclude links of that type.
  Clicking an off label MUST remove the strike-through and restore that type's eligibility.
  Text search and link-type filters MUST apply together.
  Excluding a link type MUST hide every graph of that type, including all nodes, name
  labels, connecting line segments, and group outlines. Hidden links MUST leave no orphan
  lines on the canvas. Restoring a link's eligibility MUST restore its complete graph.
- **Result arrangement:** Device-name search and link-type filter changes MUST automatically
  rearrange the resulting visible links into a grid of at most four rows, with columns
  growing rightward as needed (N = ceil(count/4)). Sorted order MUST fill each column
  top-to-bottom before continuing to the next column on the right. Clearing search or
  restoring link types MUST reflow the complete resulting set without gaps reserved for
  hidden links. Grid cells MUST align across rows and columns and provide enough space for
  each graph and its device-name labels.
  Rearrangement MUST preserve each link's internal node positions relative to one another;
  hidden links MUST retain their local coordinates until they become visible again.
  Automatic reflow MUST use the selected sort mode, defaulting to Most Recent.
  (Amended 2026-11-23: the owner replaced row-major left-to-right filling with the fixed
  four-row, column-major arrangement; rationale — reading order should follow a column
  then move right. Affected artifacts: implementation-design sections 7/13, V13/V14,
  graph-canvas.js pack, tests/browser/layout.spec.js.)
- **Sorting:** The page MUST expose buttons that arrange visible links logically in the
  same grid, ordered down each column and then across columns to the right. Required modes
  MUST include Most Recent and Link Type.
  Most Recent MUST order links by their latest addition, newest first; it MUST NOT substitute
  device report recency.
  Planning MUST define the public-API evidence for addition recency, behavior when that
  evidence is unavailable, the link-type ordering, and deterministic tie handling.
  Additional sort modes MUST be backed by a current requirement.

## Development and Deployment Workflow

- Specifications and implementation plans MUST trace relevant requirements to these
  principles and product behaviors. Unresolved API semantics or library capabilities MUST
  be investigated during planning rather than silently replaced with different behavior.
- Before introducing application structure or UI conventions, developers MUST inspect
  the corresponding Transit Jazz implementation and record reuse decisions in the plan.
  Deviations MUST state a concrete compatibility or requirement-based reason.
- Deployment MUST be automated through exactly one GitHub Actions deployment workflow
  adapted from the Transit Jazz client action, targeting one Azure Static Web App.
  Infrastructure MUST be defined using Bicep. Deployment MUST preserve static client-only
  hosting and MUST NOT introduce a server application or API backend.

  The specific workflow reference is [.github/workflows/client.yml](C:/Projects/ChefKnifeStudios.TransitJazz/.github/workflows/client.yml): .NET setup,
  WASM tools, Release publish, artifact handoff, SPA navigation fallback, the production
  environment header, and deployment through `Azure/static-web-apps-deploy`.
  Adapt project paths, artifact paths, and deployment secret names for Linked Assets.
  Transit-specific synth version stamping and the separate Marta/server workflows are not
  part of this adaptation. For Bicep, use [bicep/modules/staticWebApp.bicep](C:/Projects/ChefKnifeStudios.TransitJazz/bicep/modules/staticWebApp.bicep)
  for `Microsoft.Web/staticSites`, an empty API location, and hostname outputs;
  [bicep/main.bicep](C:/Projects/ChefKnifeStudios.TransitJazz/bicep/main.bicep) provides resource-group, parameter, and module wiring examples.
  Adapt the existing project/domain defaults and include only infrastructure needed here;
  its DNS and observability Key Vault modules are not requirements for Linked Assets.
- Reviews MUST check read-only API use, client-side execution, justified language and
  library choices, Transit Jazz consistency, and absence of speculative code.
- Validation MUST cover the behaviors affected by a change. Graph identity and colors,
  selection and overlay behavior, map fitting and report times, combined filters, sorting,
  and fluid canvas interaction MUST have explicit acceptance checks when implemented.
  Automated checks MUST target meaningful behavior or integration risk rather than
  duplicating implementation details. UI behavior MUST also receive browser verification.

## Governance

This constitution governs project specifications, plans, tasks, implementation, and reviews.
Conflicting project artifacts MUST be reconciled with it before dependent work proceeds.
An amendment MUST describe the rule being changed, its rationale, and the affected artifacts
or existing behavior. The project owner MUST approve substantive governance changes; an
explicit owner request supplying new rules constitutes approval for those rules.

Versions MUST follow semantic versioning: a MAJOR increment for incompatible removals or
redefinitions of principles, a MINOR increment for new principles or materially expanded
guidance, and a PATCH increment for clarifications that do not change requirements.
Amendments MUST preserve the original ratification date and update the last-amended date.
Every specification, implementation plan, and code review MUST assess compliance with
the applicable rules. Departures from a MUST rule require an approved constitutional
amendment; implementation convenience alone is not an exception.

**Version**: 1.3.0 | **Ratified**: 2026-11-21 | **Last Amended**: 2026-11-23
