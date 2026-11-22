# Linked Assets agent instructions

Read [.specify/memory/constitution.md](.specify/memory/constitution.md) and [docs/implementation-design.md](docs/implementation-design.md) before implementing this application.

The [implementation checklist](docs/implementation-design.md#implementation-checklist) is the **single source of truth for implementation status**. Every implementation agent must reference it at the start of work and update it as objectives start, finish, become blocked or are handed off. Follow its dependency, evidence and status rules. Check an item only after its required behavior and verification are complete; reopen it if later changes invalidate that evidence.

Use the stable `LA-###` IDs in work notes and handoffs. Keep phase counts and the current handoff note accurate. Do not create a competing status checklist in a scratch plan or Spec Kit tasks file; link to the canonical IDs and reconcile status there. The constitution governs requirements; the checklist governs implementation status.

Inspect the relevant Transit Jazz references before introducing architecture or UI patterns. Production domain data comes from Geotab public APIs, all source operations are read-only, and the app remains standalone client-side Blazor. Synthetic/sanitized test fixtures stay in test tooling and must not ship as a production data source.
