# Linked Assets

A read-only, client-side Blazor application for exploring Geotab linked assets as an interactive graph.

The initial design is preserved in [docs/linked-assets-mockup.png](docs/linked-assets-mockup.png). It describes device graphs grouped by link type, search and filters, sorting, and a details blade with recent device positions and report times. The mockup is the source reference for future specification work.

Project setup is complete; application implementation has not started.

## Spec Kit

[GitHub Spec Kit](https://github.com/github/spec-kit) v1.4.3 is installed locally for Codex, with nine skills in `.agents/skills`, templates and PowerShell scripts in `.specify`, and the bundled specification workflow.

Open Codex in this directory. Start with `$speckit-constitution`, then `$speckit-specify`, `$speckit-plan`, `$speckit-tasks`, and `$speckit-implement`. Additional skills are `$speckit-clarify`, `$speckit-checklist`, `$speckit-analyze`, and `$speckit-converge`.

The constitution is still the upstream template and should be filled in before planning implementation. Preserve the mockup's technical and behavior rules when defining the project.

To invoke the pinned CLI without changing the machine's shared installation:

```powershell
uvx --from 'git+https://github.com/github/spec-kit.git@v1.4.3' specify --help
```
