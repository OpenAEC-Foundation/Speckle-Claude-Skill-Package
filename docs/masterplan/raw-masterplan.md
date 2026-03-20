# Speckle Skill Package — Raw Masterplan

> Phase B1 output — Technology landscape mapping and preliminary skill inventory.
> Created: 2026-03-20

---

## 1. Technology Landscape Overview

### What is Speckle?

Speckle is the **first open-source data hub for AEC** (Architecture, Engineering, Construction). It replaces file-based workflows with **object-based, version-controlled data exchange** between design tools. Core value: objects (not files) are the fundamental unit — structured, queryable, hash-addressed, and deduplicated.

### Platform Architecture

| Component | Technology | Role |
|-----------|-----------|------|
| **Server** | Node.js, PostgreSQL, Redis, S3 | Central API hub, authentication, data storage |
| **GraphQL API** | Apollo Server | Primary API — 24 queries, 35+ mutations, 20 subscriptions |
| **REST API** | Express | Minimal — only 2 GET endpoints for object retrieval |
| **SpecklePy** | Python 3.6+ | Python SDK — send/receive, Base objects, GraphQL wrapper |
| **Speckle.Sdk** | .NET Standard 2.0 | C# SDK — connectors, send/receive, serialization |
| **Viewer** | TypeScript, Three.js | @speckle/viewer — 3D rendering with extensions |
| **Automate** | Python/C# Functions | Serverless CI/CD — triggered by version creation |
| **Connectors** | .NET (DUI3) | Revit, Rhino/GH, Blender, AutoCAD, Civil 3D, Tekla, Power BI |

### Terminology (Critical — Recent Migration)

| Current Term | Legacy Term | Description |
|-------------|-------------|-------------|
| **Project** | Stream | Container holding Models |
| **Model** | Branch | Set of objects within a Project |
| **Version** | Commit | Immutable snapshot with history |
| **Workspace** | _(new)_ | Top-level organizational container |

**Hierarchy**: Workspace > Project > Model > Version > Objects

### Object Model

- **Base** — Foundation class. Properties: `id` (content hash), `applicationId` (stable host ID), `speckle_type`
- **Detaching** (`@` prefix) — Stores property as reference, not embedded. Critical for shared objects
- **Chunking** (`[Chunkable(size)]`) — Splits large lists (vertices, faces) into manageable chunks
- **Data Schema layers**: Base Objects → DataObjects → Collections → Root Collection → Proxies
- **Proxies** — Cross-cutting relationships: RenderMaterial, Level, Group, Definition, Color

### Transport System

| Transport | Storage | Use Case |
|-----------|---------|----------|
| **ServerTransport** | Speckle Server | Collaborative cloud storage |
| **SQLiteTransport** | Local SQLite | Default local cache, offline |
| **MemoryTransport** | RAM | Serverless, Docker, fast ops |
| **DiskTransport** | Local filesystem | Project-local storage |

### GraphQL API Surface

**Queries (24)**: `activeUser`, `project(id)`, `workspace(id)`, `serverInfo`, `automateFunction(id)`, `permissions`, `admin`, etc.

**Mutations (35+)**:
- Projects: `projectMutations()` (create, update, delete)
- Models: `modelMutations()` (create, update, delete)
- Versions: `versionMutations()` (create, update, delete, move)
- Tokens: `apiTokenCreate`, `apiTokenRevoke`, `appTokenCreate`
- Webhooks: `webhookCreate`, `webhookUpdate`, `webhookDelete`
- Automate: `automateMutations()`, `automateFunctionRunStatusReport`
- Workspaces: `workspaceMutations()`

**Subscriptions (20)**: `projectModelsUpdated`, `projectVersionsUpdated`, `projectUpdated`, `projectAutomationsUpdated`, `viewerUserActivityBroadcasted`, `userProjectsUpdated`, `workspaceProjectsUpdated`, etc.

### Authentication

1. **Personal Access Tokens (PATs)** — For scripts, automation. Scopes: `streams:read`, `streams:write`, `profile:read`, `profile:email`
2. **OAuth2 with PKCE** — For multi-user web apps. Register app → redirect → exchange code for token

### Automate

- Enterprise CI/CD platform — serverless functions triggered by new versions
- SDKs: `speckle-automate` (Python), `Speckle.Automate.Sdk` (C#/.NET)
- Key API: `AutomationContext` with `receive_version()`, `attach_error_to_objects()`, `mark_run_failed/success()`, `store_file_result()`
- Deployment: GitHub-based with GitHub Actions

### Connector Ecosystem

| Connector | Versions | Platform | Send | Receive | Notes |
|-----------|----------|----------|------|---------|-------|
| **Revit** | 2022–2026 | Windows | Yes | Direct Shapes | No custom property import on receive |
| **Rhino** | 7, 8 | Windows | Yes | Yes | Full geometry + user strings |
| **Grasshopper** | (bundled) | Windows | Yes | Yes | Cannot create native BIM elements |
| **Blender** | 4.2–5.0 | Win/Mac | Yes | Yes | No cameras/lights, 4 shader types only |
| **AutoCAD** | 2022–2026 | Windows | Yes | Yes | Solids → mesh on convert |
| **Civil 3D** | 2022–2026 | Windows | Yes | Yes | CivilObject types, corridors |
| **Tekla** | 2023–2025 | Windows | Yes | **No** | Publish-only, no receive |
| **Power BI** | — | Windows | No | Yes | Visualization/analytics |

### Key Architectural Insights

1. **Asymmetric fidelity**: Publishing preserves more data than loading (properties out, not always back)
2. **Direct Shape problem**: Revit receive ALWAYS creates Direct Shapes, never native parametric elements
3. **Geometry baking**: Complex geometry (NURBS, Breps) → mesh/curve primitives for interoperability
4. **Proxy architecture**: Materials, levels, groups, definitions stored as Root Collection proxies
5. **Grasshopper limitation**: Cannot create native BIM objects — only Data Objects with geometry
6. **Tekla is one-way**: Publish only, no receive capability

### Viewer (@speckle/viewer)

- Three.js-based, TypeScript, extension system
- Core API: `init()`, `loadObject()`, `getWorldTree()`, `createExtension()`
- Extensions: CameraController, FilteringExtension, SelectionExtension, DiffExtension, MeasurementsTool, SectionTool
- Events: ObjectClicked, ObjectDoubleClicked, LoadComplete, FilteringStateSet
- Custom rendering pipeline API for advanced use

---

## 2. Skill Inventory — Revised

Based on research findings, the preliminary 22-skill inventory is **confirmed with refinements**:

### Category: core/ (3 skills)

| # | Skill Name | Scope | Complexity |
|---|-----------|-------|-----------|
| 1 | `speckle-core-object-model` | Base class, id/applicationId, speckle_type, detaching (@), chunking, decomposition, data schema layers (Base→DataObject→Collection→Proxy), immutability | High |
| 2 | `speckle-core-transport` | Transport system (Server, SQLite, Memory, Disk), send/receive flow, multi-transport, caching, local data paths per OS | Medium |
| 3 | `speckle-core-api` | GraphQL API surface (queries, mutations, subscriptions), REST endpoints, authentication (PAT, OAuth2), terminology mapping (Project/Model/Version vs Stream/Branch/Commit), pagination, rate limiting | High |

### Category: syntax/ (4 skills)

| # | Skill Name | Scope | Complexity |
|---|-----------|-------|-----------|
| 4 | `speckle-syntax-base-objects` | Creating/manipulating Base objects in Python and C#, dynamic properties, typed properties, geometry primitives (Point, Line, Mesh, etc.), units, displayValue, Collections | High |
| 5 | `speckle-syntax-graphql` | GraphQL query/mutation patterns, project/model/version CRUD, user queries, webhook CRUD, subscriptions, pagination, variables, error handling | High |
| 6 | `speckle-syntax-webhooks` | Webhook lifecycle (create, update, delete), event types, payload structure, security, retry behavior | Medium |
| 7 | `speckle-syntax-automate` | Automate function structure, FunctionInputs, AutomationContext API, error attachment, result reporting, file storage, deployment via GitHub | High |

### Category: impl/ (10 skills)

| # | Skill Name | Scope | Complexity |
|---|-----------|-------|-----------|
| 8 | `speckle-impl-python-sdk` | SpecklePy setup, SpeckleClient, authentication, operations (send/receive/serialize), resource methods (project, model, version), local data paths | High |
| 9 | `speckle-impl-sharp-sdk` | Speckle.Sdk (.NET), old vs new SDK, Operations, Helpers, Client, Account, IL Repack dependency isolation | High |
| 10 | `speckle-impl-connectors` | Connector architecture overview, DUI3, conversion pipeline (ToSpeckle/ToHost), shared infrastructure, supported connectors matrix | Medium |
| 11 | `speckle-impl-revit` | Revit connector: publishing (selection/view/category), receiving (Direct Shapes), parameters, linked models, coordinate systems, limitations | High |
| 12 | `speckle-impl-rhino-grasshopper` | Rhino: geometry, layers, user strings, named views. Grasshopper: components (Publish, Load, Query, Filter, Create Collection/Properties/Data Object), block handling | High |
| 13 | `speckle-impl-blender` | Blender connector: mesh/curve support, 4 shader types, modifiers, block loading modes, limitations (no cameras/lights/textures/Linux) | Medium |
| 14 | `speckle-impl-viewer` | @speckle/viewer setup, loading objects, extensions (Camera, Filtering, Selection, Diff, Measurements, Section), events, rendering pipeline | High |
| 15 | `speckle-impl-automate-functions` | Building Automate functions end-to-end: Python template, C# template, testing locally, deployment, CI/CD, function library publishing | High |
| 16 | `speckle-impl-federation` | Cross-tool data exchange patterns, assembling federated views, proxy-based relationships, applicationId stability, conflict resolution, versioning strategies | Medium |
| 17 | `speckle-impl-versioning` | Version management: creating versions, comparing versions, rollback patterns, sync strategies, version history traversal, DiffExtension in viewer | Medium |

### Category: errors/ (3 skills)

| # | Skill Name | Scope | Complexity |
|---|-----------|-------|-----------|
| 18 | `speckle-errors-transport` | Transport failures: network errors, timeout, authentication expiry, SQLite lock, memory limits, multi-transport error handling | Medium |
| 19 | `speckle-errors-conversion` | Conversion failures: unsupported geometry, Direct Shape fallback, missing properties on receive, geometry baking data loss, proxy resolution failures | High |
| 20 | `speckle-errors-auth` | Authentication errors: token expiry, scope mismatch, OAuth flow errors, PAT vs app token confusion, server vs cloud auth differences | Medium |

### Category: agents/ (2 skills)

| # | Skill Name | Scope | Complexity |
|---|-----------|-------|-----------|
| 21 | `speckle-agents-model-coordinator` | Intelligent workflow orchestration: choose right connector, plan send/receive sequences, handle cross-tool federation, resolve terminology confusion | High |
| 22 | `speckle-agents-data-validator` | Data validation: check object schema, verify required properties, validate geometry integrity, pre-flight checks before send, post-receive validation | High |

---

## 3. Dependency Graph

```
Layer 0 (no dependencies):
  speckle-core-object-model
  speckle-core-transport
  speckle-core-api

Layer 1 (depends on core):
  speckle-syntax-base-objects      → object-model
  speckle-syntax-graphql           → api
  speckle-syntax-webhooks          → api
  speckle-syntax-automate          → api, object-model

Layer 2 (depends on core + syntax):
  speckle-impl-python-sdk          → object-model, transport, base-objects
  speckle-impl-sharp-sdk           → object-model, transport, base-objects
  speckle-impl-connectors          → object-model, transport
  speckle-impl-viewer              → api, base-objects
  speckle-impl-automate-functions  → automate (syntax)

Layer 3 (depends on impl):
  speckle-impl-revit               → connectors, base-objects
  speckle-impl-rhino-grasshopper   → connectors, base-objects
  speckle-impl-blender             → connectors, base-objects
  speckle-impl-federation          → connectors, python-sdk or sharp-sdk
  speckle-impl-versioning          → api, graphql

Layer 4 (depends on all above):
  speckle-errors-transport         → transport, python-sdk, sharp-sdk
  speckle-errors-conversion        → connectors, revit, rhino-grasshopper, blender
  speckle-errors-auth              → api, python-sdk, sharp-sdk

Layer 5 (meta-skills):
  speckle-agents-model-coordinator → ALL skills
  speckle-agents-data-validator    → object-model, base-objects, python-sdk, sharp-sdk
```

---

## 4. Preliminary Batch Plan

| Batch | Skills | Count | Dependencies |
|-------|--------|-------|-------------|
| B5.1 | core-object-model, core-transport, core-api | 3 | None |
| B5.2 | syntax-base-objects, syntax-graphql, syntax-webhooks | 3 | B5.1 |
| B5.3 | syntax-automate, impl-python-sdk, impl-sharp-sdk | 3 | B5.1, B5.2 |
| B5.4 | impl-connectors, impl-viewer, impl-automate-functions | 3 | B5.2, B5.3 |
| B5.5 | impl-revit, impl-rhino-grasshopper, impl-blender | 3 | B5.4 |
| B5.6 | impl-federation, impl-versioning, errors-transport | 3 | B5.4, B5.5 |
| B5.7 | errors-conversion, errors-auth, agents-data-validator | 3 | B5.5, B5.6 |
| B5.8 | agents-model-coordinator | 1 | ALL |

**Total: 8 batches, 22 skills**

---

## 5. Research Gaps Identified

### Must Research Before Phase B3

1. **Speckle v2 vs v3 differences** — HANDOFF.md mentions "v3 API wijkt significant af van v2". Need to understand what changed and which version we target
2. **Existing Speckle MCP servers** — Are there community or official MCP servers? Search GitHub and npm
3. **Speckle Objects library** — The `Speckle.Objects` NuGet package contains domain model classes (Wall, Floor, Beam, etc.). Need full inventory
4. **GraphQL schema introspection** — Get the actual schema from a live server for accuracy
5. **SpecklePy API completeness** — The resource modules suggest a richer API than documented. Need source code review
6. **Automate function SDK details** — Testing, local development, environment variables
7. **Viewer extension development** — Can users create custom extensions? What's the API?

### Nice-to-Have Research

8. **IFC schema mapping** — How Speckle maps to/from IFC
9. **Power BI connector** — Data Gateway integration details
10. **Community automate functions** — Common patterns and examples

---

## 6. Open Decisions for Phase B3

| # | Question | Options | Impact |
|---|----------|---------|--------|
| OQ-1 | Target Speckle v2 only, or include v3? | v2-only / v2+v3 notes / v3-only | All skills |
| OQ-2 | Include AutoCAD/Civil 3D connector skills? | Yes (expand to ~24) / No (keep 22) | impl/ count |
| OQ-3 | Separate Rhino and Grasshopper skills? | Combined (current) / Split to 2 skills | impl/ count |
| OQ-4 | MCP server: build custom, use existing, or skip? | Build / Integrate / Skip for v1.0 | Parallel track |

---

## 7. Sources Verified During Research

| Source | URL | Status |
|--------|-----|--------|
| Speckle Docs (new) | docs.speckle.systems | ACTIVE — primary docs site |
| Speckle Guide (legacy) | speckle.guide | PARTIALLY ACTIVE — some redirects to new site |
| Speckle Server repo | github.com/specklesystems/speckle-server | ACTIVE — monorepo |
| SpecklePy repo | github.com/specklesystems/specklepy | ACTIVE — Python SDK |
| Speckle Sharp SDK repo | github.com/specklesystems/speckle-sharp-sdk | ACTIVE — new C# SDK |
| Speckle Connectors repo | github.com/specklesystems/speckle-sharp-connectors | ACTIVE — .NET connectors |
| GraphQL endpoint | app.speckle.systems/graphql | ACTIVE — introspectable |
| LLMs.txt | docs.speckle.systems/llms.txt | ACTIVE — complete doc index |

**Important discovery**: `docs.speckle.systems/llms.txt` provides a complete documentation map — extremely valuable for topic-specific research in Phase B4.
