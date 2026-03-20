# Speckle Skill Package — Skill Index

> 25 deterministic skills for Speckle data platform interaction with Claude.
> Each skill is self-contained, English-only, and follows ALWAYS/NEVER deterministic language.

---

## Skills by Category

### Core (3 skills) — Foundation knowledge

| # | Skill | Status | Description |
|---|-------|--------|-------------|
| 1 | speckle-core-object-model | DONE | Base class, id/applicationId, detaching, chunking, decomposition, data schema layers, proxies, displayValue, units |
| 2 | speckle-core-transport | DONE | ServerTransport, SQLiteTransport, MemoryTransport, DiskTransport, send/receive flow, caching, progress |
| 3 | speckle-core-api | DONE | GraphQL API, REST endpoints, authentication (PAT, OAuth2+PKCE), terminology mapping, rate limiting |

### Syntax (4 skills) — How to work with Speckle

| # | Skill | Status | Description |
|---|-------|--------|-------------|
| 4 | speckle-syntax-base-objects | DONE | Geometry primitives (Point, Line, Mesh, Brep), Collections, displayValue, units, domain objects |
| 5 | speckle-syntax-graphql | DONE | Queries, mutations, subscriptions, cursor pagination, variables, nested queries |
| 6 | speckle-syntax-webhooks | DONE | 14 event types, webhook CRUD, payload structure, HMAC security, retry behavior |
| 7 | speckle-syntax-automate | DONE | AutomationContext API, FunctionInputs, Python + C# patterns, deployment flow |

### Implementation (13 skills) — SDK, connector, and integration recipes

| # | Skill | Status | Description |
|---|-------|--------|-------------|
| 8 | speckle-impl-python-sdk | DONE | SpecklePy: client, auth, resources, operations, ServerTransport, local paths |
| 9 | speckle-impl-sharp-sdk | DONE | Speckle.Sdk: NuGet, old vs new SDK, Operations, Helpers, IL Repack, DI |
| 10 | speckle-impl-connectors-overview | DONE | Connector architecture, DUI3, ToSpeckle/ToHost, connector matrix, proxies |
| 11 | speckle-impl-revit | DONE | Revit 2022-2026, 3 publish modes, Direct Shape receive, parameters, coordinates |
| 12 | speckle-impl-rhino-grasshopper | DONE | Rhino 7/8, 15+ GH components, user strings, blocks, no native BIM objects |
| 13 | speckle-impl-blender | DONE | Blender 4.2-5.0 (Win/Mac), 4 shaders, no cameras/lights/textures/Linux |
| 14 | speckle-impl-autocad-civil3d | DONE | AutoCAD 2022-2026, solids-to-mesh, XData, Civil 3D CivilObject, corridors |
| 15 | speckle-impl-tekla | DONE | Tekla 2023-2025, PUBLISH-ONLY, TeklaObject, no assemblies/drawings |
| 16 | speckle-impl-powerbi | DONE | Power BI read-only, 7 helper functions, Data Gateway, analytics |
| 17 | speckle-impl-viewer | DONE | @speckle/viewer, extensions (Camera, Filter, Select, Diff, Measure, Section) |
| 18 | speckle-impl-automate-functions | DONE | End-to-end: templates, local testing, GitHub Actions, deployment, publishing |
| 19 | speckle-impl-federation | DONE | Cross-tool exchange, fidelity matrix, applicationId, geometry baking, workflows |
| 20 | speckle-impl-versioning | DONE | Version CRUD, comparison, rollback, DiffExtension, model management |

### Errors (3 skills) — Diagnosis and anti-patterns

| # | Skill | Status | Description |
|---|-------|--------|-------------|
| 21 | speckle-errors-transport | DONE | Network errors, timeout, SQLite lock, auth expiry, retry strategies |
| 22 | speckle-errors-conversion | DONE | Unsupported geometry, Direct Shape fallback, property loss, unit mismatch |
| 23 | speckle-errors-auth | DONE | Token expiry, scope mismatch, OAuth errors, 401 vs 403, PAT debugging |

### Agents (2 skills) — Intelligent orchestration

| # | Skill | Status | Description |
|---|-------|--------|-------------|
| 24 | speckle-agents-data-validator | DONE | Schema validation, geometry integrity, pre-flight/post-receive checks, proxies |
| 25 | speckle-agents-model-coordinator | DONE | Connector selection, workflow planning, federation coordination, terminology |

---

## Totals

| Category | Skills | Status |
|----------|--------|--------|
| Core | 3 | 3/3 |
| Syntax | 4 | 4/4 |
| Implementation | 13 | 13/13 |
| Errors | 3 | 3/3 |
| Agents | 2 | 2/2 |
| **Total** | **25** | **25/25** |

---

## Skill Dependencies

```
agents/model-coordinator  ──> ALL skills (meta-orchestrator)
agents/data-validator     ──> core/object-model, syntax/base-objects

impl/* connectors         ──> impl/connectors-overview
impl/python-sdk           ──> core/object-model, core/transport
impl/sharp-sdk            ──> core/object-model, core/transport
impl/viewer               ──> core/api, syntax/base-objects
impl/automate-functions   ──> syntax/automate
impl/federation           ──> impl/connectors-overview
impl/versioning           ──> core/api, syntax/graphql

syntax/base-objects       ──> core/object-model
syntax/graphql            ──> core/api
syntax/webhooks           ──> core/api
syntax/automate           ──> core/api, core/object-model

errors/transport          ──> core/transport
errors/conversion         ──> impl/connectors-overview
errors/auth               ──> core/api
```

---

**Version:** 1.0.0 — All 25 skills complete and validated.
