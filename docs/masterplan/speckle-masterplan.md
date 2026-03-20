# Speckle Data Platform Skill Package — Definitive Masterplan

## Status
Phase 3 complete. Finalized from raw masterplan after vooronderzoek review.
Date: 2026-03-20

---

## Decisions Made During Refinement

| # | Decision | Rationale |
|---|----------|-----------|
| R-01 | **Renamed** `speckle-impl-connectors` to `speckle-impl-connectors-overview` | Clarifies this is the architecture overview, not a specific connector |
| R-02 | **Added** `speckle-impl-autocad-civil3d` | User directive: all connectors. AutoCAD+Civil3D combined (same codebase) |
| R-03 | **Added** `speckle-impl-tekla` | User directive: all connectors. Tekla is unique: publish-only |
| R-04 | **Added** `speckle-impl-powerbi` | User directive: all connectors. Power BI is unique: analytics/visualization |
| R-05 | **Confirmed** combined Rhino+Grasshopper | GH is bundled with Rhino connector, shared install, but distinct usage patterns documented |
| R-06 | **Added** Speckle v3 coverage to all skills | User directive: v2+v3, inline version tables a la ERPNext package |
| R-07 | **Reordered** connector batches for parallel execution | Batches 5+6 (connector skills) can execute after batch 4 independently |

**Result**: 22 raw skills → **25 definitive skills** (3 additions, 0 removals, 0 merges).

---

## Definitive Skill Inventory (25 skills)

### speckle-core/ (3 skills)

| Name | Scope | Key APIs | Research Input | Complexity | Dependencies |
|------|-------|----------|----------------|------------|-------------|
| `speckle-core-object-model` | Base class (id, applicationId, speckle_type, totalChildrenCount); content hashing; dynamic vs typed properties; detaching (@ prefix, [DetachProperty]); chunking ([Chunkable]); decomposition (composed/decomposed); data schema layers (Base→DataObject→Collection→Proxy); proxy types (RenderMaterial, Level, Group, Definition, Color); displayValue; units | Base, id, applicationId, speckle_type, @detach, Chunkable, DataObject, Collection, Proxy | vooronderzoek-object-model §1-§8 | High | None |
| `speckle-core-transport` | Transport interface (Python AbstractTransport, C# ITransport); ServerTransport (auth, batch sending, endpoints); SQLiteTransport (paths per OS); MemoryTransport; DiskTransport; send flow (multi-transport); receive flow (cache-first); caching strategy; progress reporting | ServerTransport, SQLiteTransport, MemoryTransport, DiskTransport, operations.send/receive | vooronderzoek-transport §1-§7 | Medium | None |
| `speckle-core-api` | GraphQL endpoint (cloud/self-hosted); auth headers; terminology mapping (Project↔Stream, Model↔Branch, Version↔Commit); REST endpoints (2 GET); PAT auth (scopes); OAuth2+PKCE flow; rate limiting; error handling | GraphQL queries/mutations/subscriptions, REST /objects/, PAT, OAuth2 | vooronderzoek-api §1-§11 | High | None |

### speckle-syntax/ (4 skills)

| Name | Scope | Key APIs | Research Input | Complexity | Dependencies |
|------|-------|----------|----------------|------------|-------------|
| `speckle-syntax-base-objects` | Creating Base objects (Python + C#); dynamic properties; typed properties; geometry primitives (Point, Line, Polyline, Mesh, Brep, Arc, Circle, Ellipse); units; displayValue; Collections; wrapping in Base container for viewer; Speckle.Objects domain classes (Wall, Floor, Beam) | Base(), Point, Line, Mesh, Polyline, Brep, Collection, Speckle.Objects | vooronderzoek-object-model §5-§8, vooronderzoek-sdks §1.5-§1.6 | High | core-object-model |
| `speckle-syntax-graphql` | ALL major queries (activeUser, project, workspace, serverInfo); ALL major mutations (project/model/version CRUD, webhook CRUD, token CRUD); subscriptions (projectModelsUpdated, etc.); cursor-based pagination; variables; error handling; nested query patterns | project(), modelMutations(), versionMutations(), webhookCreate, apiTokenCreate, subscriptions | vooronderzoek-api §2-§5 | High | core-api |
| `speckle-syntax-webhooks` | Webhook lifecycle (create/update/delete via GraphQL); 14 event types with trigger strings; payload structure; configuration limits; security; retry behavior | webhookCreate, webhookUpdate, webhookDelete, WebhookCreateInput | vooronderzoek-api §8 | Medium | core-api |
| `speckle-syntax-automate` | Automate function structure; FunctionInputs (Pydantic/DataAnnotations); AutomationContext API (receive_version, attach_error_to_objects, mark_run_failed/success, store_file_result, set_context_view); execute_automate_function; Python vs C# comparison; deployment flow | AutomationContext, AutomateBase, FunctionInputs, execute_automate_function | vooronderzoek-automate §1-§6 | High | core-api, core-object-model |

### speckle-impl/ (13 skills)

| Name | Scope | Key APIs | Research Input | Complexity | Dependencies |
|------|-------|----------|----------------|------------|-------------|
| `speckle-impl-python-sdk` | SpecklePy install (pip, Python 3.10+); SpeckleClient (constructor, auth); resource modules (project, model, version, active_user, server, workspace); operations (send/receive/serialize/deserialize); ServerTransport (3 auth paths); local data paths; error handling | SpeckleClient, operations.send/receive, ServerTransport, get_default_account | vooronderzoek-sdks §1 | High | core-object-model, core-transport, syntax-base-objects |
| `speckle-impl-sharp-sdk` | Speckle.Sdk NuGet; old vs new SDK; .NET Standard 2.0; Client/Account; Operations (Send/Receive/Serialize/Deserialize); Helpers (simplified API); IL Repack dependency isolation; Speckle.Objects domain model; DI pattern | Speckle.Sdk, Client, Operations, Helpers, Base, [DetachProperty], [Chunkable] | vooronderzoek-sdks §2 | High | core-object-model, core-transport, syntax-base-objects |
| `speckle-impl-connectors-overview` | Connector architecture; DUI3 shared UI; conversion pipeline (ToSpeckle/ToHost); supported connectors matrix; connector SDK; proxy architecture; data schema for connectors; applicationId; units handling | ToSpeckle, ToHost, DataObject, displayValue, Collection, Proxy | vooronderzoek-connectors §1, §12, §13 | Medium | core-object-model, core-transport |
| `speckle-impl-revit` | Revit 2022-2026; 3 publishing modes (selection/view/category); Direct Shape on receive (ALWAYS); parameter mapping; linked models; coordinate systems (Internal Origin/Project Base/Survey Point); rebar handling; material handling; known limitations | Revit connector UI, Direct Shape, parameters, coordinate systems | vooronderzoek-connectors §2 | High | impl-connectors-overview, syntax-base-objects |
| `speckle-impl-rhino-grasshopper` | Rhino 7/8 (Win); geometry+hatches+text+blocks; user strings; named views; layers. GH: 15+ components (Sign-In, Publish, Load, Query, Filter, Create Collection/Properties/Data Object); 3 object types; block handling; cannot create native BIM objects | Rhino connector, GH components, Block, DataObject | vooronderzoek-connectors §3, §4 | High | impl-connectors-overview, syntax-base-objects |
| `speckle-impl-blender` | Blender 4.2-5.0 (Win/Mac); mesh+curves; 4 shader types (Principled/Diffuse/Emission/Glass); no cameras/lights/textures; Apply Modifiers; block loading modes; no Linux; no custom properties on receive | Blender connector UI, mesh, curves, materials | vooronderzoek-connectors §5 | Medium | impl-connectors-overview, syntax-base-objects |
| `speckle-impl-autocad-civil3d` | AutoCAD 2022-2026; all geometry+hatch+text+blocks; solids→mesh; XData+Extension Dictionaries; layer management. Civil 3D: CivilObject types; corridors; featurelines; PropertySetDefinition proxy; no reference point | AutoCAD connector, Civil3dObject, PropertySetDefinition | vooronderzoek-connectors §6, §7 | Medium | impl-connectors-overview |
| `speckle-impl-tekla` | Tekla 2023-2025; PUBLISH-ONLY (no receive!); selectable model objects (beams/plates/bolts); TeklaObject type; no assemblies/drawings/numbering series; no drawing views | Tekla connector, TeklaObject | vooronderzoek-connectors §8 | Low | impl-connectors-overview |
| `speckle-impl-powerbi` | Power BI visualization/analytics; 7 helper functions; Data Gateway for scheduled refresh; read-only connector; different use case from design connectors | Power BI connector, Data Gateway | vooronderzoek-connectors §11 | Low | impl-connectors-overview |
| `speckle-impl-viewer` | @speckle/viewer setup; Viewer class (init, loadObject, dispose); SpeckleLoader+UrlHelper; extensions (CameraController, FilteringExtension, SelectionExtension, DiffExtension, MeasurementsTool, SectionTool); events; rendering pipeline; custom extensions | Viewer, SpeckleLoader, UrlHelper, Extensions, ViewerEvent | vooronderzoek-sdks §3 | High | core-api, syntax-base-objects |
| `speckle-impl-automate-functions` | End-to-end function development; Python+C# templates; local testing; GitHub Actions CI/CD; deployment wizard; Function Library publishing; input schema; error reporting; file artifacts; flatten_base traversal | speckle-automate, AutomationContext, GitHub Actions, function templates | vooronderzoek-automate §3-§7 | High | syntax-automate |
| `speckle-impl-federation` | Cross-tool data exchange patterns; federated views; proxy-based relationships; applicationId stability; geometry baking for interoperability; asymmetric fidelity; common workflows (Revit→GH→Revit); conflict resolution; versioning strategies | Federation patterns, applicationId, displayValue, proxy references | vooronderzoek-connectors §12 | Medium | impl-connectors-overview, impl-python-sdk or impl-sharp-sdk |
| `speckle-impl-versioning` | Version management; creating/comparing/rolling back versions; sync strategies; version history traversal; DiffExtension in viewer; branch/model management | version CRUD, DiffExtension, model management | vooronderzoek-api §3, vooronderzoek-sdks §3 | Medium | core-api, syntax-graphql |

### speckle-errors/ (3 skills)

| Name | Scope | Key APIs | Research Input | Complexity | Dependencies |
|------|-------|----------|----------------|------------|-------------|
| `speckle-errors-transport` | Transport failures: network errors, timeout, auth expiry, SQLite lock, memory limits, multi-transport errors, batch upload failures, progress reporting errors | Transport error types, retry patterns | vooronderzoek-transport §anti-patterns | Medium | core-transport, impl-python-sdk, impl-sharp-sdk |
| `speckle-errors-conversion` | Conversion failures: unsupported geometry, Direct Shape fallback, missing properties on receive, geometry baking data loss, proxy resolution failures, unit mismatch, displayValue errors | Conversion error types, fallback patterns | vooronderzoek-connectors §anti-patterns | High | impl-connectors-overview, impl-revit, impl-rhino-grasshopper |
| `speckle-errors-auth` | Auth errors: token expiry, scope mismatch, OAuth flow errors, PAT vs app token confusion, server vs cloud auth, refresh token failures, SSO issues | Auth error types, token refresh, scope debugging | vooronderzoek-api §7, §anti-patterns | Medium | core-api, impl-python-sdk, impl-sharp-sdk |

### speckle-agents/ (2 skills)

| Name | Scope | Key APIs | Research Input | Complexity | Dependencies |
|------|-------|----------|----------------|------------|-------------|
| `speckle-agents-model-coordinator` | Intelligent workflow orchestration: choose right connector for task; plan send/receive sequences; handle cross-tool federation; resolve terminology confusion (Stream↔Project); recommend version strategy; multi-model coordination | All skill decision trees | All vooronderzoek | High | ALL skills |
| `speckle-agents-data-validator` | Data validation: check object schema; verify required properties; validate geometry integrity; pre-flight checks before send; post-receive validation; proxy reference integrity; unit consistency | Base validation, property checks, geometry validation | vooronderzoek-object-model, vooronderzoek-connectors | High | core-object-model, syntax-base-objects, impl-python-sdk |

---

## Batch Execution Plan (DEFINITIVE)

| Batch | Skills | Count | Dependencies | Notes |
|-------|--------|-------|-------------|-------|
| 1 | `core-object-model`, `core-transport`, `core-api` | 3 | None | Foundation, no deps |
| 2 | `syntax-base-objects`, `syntax-graphql`, `syntax-webhooks` | 3 | Batch 1 | Core syntax patterns |
| 3 | `syntax-automate`, `impl-python-sdk`, `impl-sharp-sdk` | 3 | Batch 1-2 | Automate syntax + SDK skills |
| 4 | `impl-connectors-overview`, `impl-viewer`, `impl-automate-functions` | 3 | Batch 2-3 | Connector arch + viewer + automate impl |
| 5 | `impl-revit`, `impl-rhino-grasshopper`, `impl-blender` | 3 | Batch 4 | Major connectors (parallel with batch 6) |
| 6 | `impl-autocad-civil3d`, `impl-tekla`, `impl-powerbi` | 3 | Batch 4 | Additional connectors (parallel with batch 5) |
| 7 | `impl-federation`, `impl-versioning`, `errors-transport` | 3 | Batch 4-6 | Cross-cutting impl + first error skill |
| 8 | `errors-conversion`, `errors-auth`, `agents-data-validator` | 3 | Batch 5-7 | Error skills + first agent |
| 9 | `agents-model-coordinator` | 1 | ALL | Meta-agent, references all skills |

**Total**: 25 skills across 9 batches.

---

## Per-Skill Agent Prompts

### Constants

```
PROJECT_ROOT = C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package
REQUIREMENTS_FILE = C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\REQUIREMENTS.md
REFERENCE_SKILL = C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md
```

---

### Batch 1

#### Prompt: speckle-core-object-model

```
## Task: Create the speckle-core-object-model skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-core\speckle-core-object-model\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (API signatures for Base, DataObject, Collection, Proxy types in Python + C#)
3. references/examples.md (working code examples for creating/inspecting objects)
4. references/anti-patterns.md (what NOT to do with Base objects)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-core-object-model
description: >
  Use when creating Speckle objects, understanding Base class inheritance, or working with object decomposition.
  Prevents incorrect detachment syntax, broken content hashing, and misuse of dynamic vs typed properties.
  Covers Base class hierarchy, id/applicationId, speckle_type, detaching (@), chunking, decomposition, DataObject, Collection, Proxy types, displayValue, and units.
  Keywords: speckle base object, object model, detach, chunkable, decomposition, speckle_type, displayValue, collection, proxy.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Base class: id (content hash), applicationId, speckle_type, totalChildrenCount, dynamic vs typed properties
- Detaching: @ prefix (Python), [DetachProperty] (C#); when and why to detach
- Chunking: [Chunkable] attribute, large list serialization
- Decomposition: composed vs decomposed traversal, flatten_base
- Data schema layers: Base → DataObject → Collection → Proxy
- Proxy types: RenderMaterial, Level, Group, Definition, Color
- displayValue: how connectors render objects without native conversion
- Units: unit encoding on geometry objects

### Research Sections to Read
From vooronderzoek-speckle-object-model.md:
- Section 1: Base Class Fundamentals
- Section 2: Content Hashing and ID Generation
- Section 3: Detaching and Chunking
- Section 4: Decomposition
- Section 5: Data Schema Layers (DataObject, Collection, Proxy)
- Section 6: Proxy Types
- Section 7: displayValue
- Section 8: Units

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Cover BOTH Python and C# perspectives for every concept
```

#### Prompt: speckle-core-transport

```
## Task: Create the speckle-core-transport skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-core\speckle-core-transport\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (API signatures for all transport types in Python + C#)
3. references/examples.md (working code examples for send/receive with transports)
4. references/anti-patterns.md (transport misuse patterns)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-core-transport
description: >
  Use when sending or receiving Speckle objects, configuring transports, or debugging data transfer issues.
  Prevents SQLite lock errors, auth token expiry during long transfers, and missing cache-first receive patterns.
  Covers ServerTransport, SQLiteTransport, MemoryTransport, DiskTransport, send/receive flow, caching strategy, and progress callbacks.
  Keywords: speckle transport, server transport, sqlite transport, send, receive, cache, operations, upload, download.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Transport interface: Python AbstractTransport, C# ITransport
- ServerTransport: constructor, authentication (3 paths), batch sending, REST endpoints
- SQLiteTransport: default paths per OS (Windows/Mac/Linux), manual path override
- MemoryTransport: in-memory volatile storage, testing use case
- DiskTransport: file-based persistence
- Send flow: serialize → write to local + remote transports → return root hash
- Receive flow: check local cache → fetch from server → deserialize
- Caching strategy: SQLite as persistent cache, cache invalidation
- Progress reporting: callback signatures in Python and C#

### Research Sections to Read
From vooronderzoek-speckle-transport.md:
- Section 1: Transport Interface
- Section 2: ServerTransport
- Section 3: SQLiteTransport
- Section 4: MemoryTransport and DiskTransport
- Section 5: Send Flow
- Section 6: Receive Flow
- Section 7: Caching and Progress

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Cover BOTH Python and C# transport implementations
```

#### Prompt: speckle-core-api

```
## Task: Create the speckle-core-api skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-core\speckle-core-api\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (GraphQL schema reference: queries, mutations, subscriptions)
3. references/examples.md (working GraphQL + REST examples)
4. references/anti-patterns.md (API misuse patterns)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-core-api
description: >
  Use when connecting to Speckle Server, authenticating, or understanding the GraphQL/REST API surface.
  Prevents confusion between old terminology (Stream/Branch/Commit) and new (Project/Model/Version), and auth scope mismatches.
  Covers GraphQL endpoint, authentication (PAT, OAuth2+PKCE), REST endpoints, terminology mapping, rate limiting, and error handling.
  Keywords: speckle api, graphql, rest, authentication, PAT, oauth, project, stream, model, branch, version, commit.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- GraphQL endpoint: cloud (app.speckle.systems/graphql) vs self-hosted
- Authentication: Personal Access Tokens (PAT) with scopes; OAuth2+PKCE flow; Authorization header format
- Terminology mapping: Project↔Stream, Model↔Branch, Version↔Commit (old↔new)
- REST endpoints: GET /objects/:streamId/:objectId (single), GET /objects/:streamId/:objectId/single (download)
- Rate limiting: behavior and headers
- Error handling: GraphQL error format, HTTP status codes
- API versioning between Speckle Server 2.x and 3.x

### Research Sections to Read
From vooronderzoek-speckle-api.md:
- Section 1: GraphQL Endpoint
- Section 2: Authentication (PAT)
- Section 3: OAuth2+PKCE
- Section 4: Terminology Mapping
- Section 5: REST Endpoints
- Section 6: Rate Limiting
- Section 7: Error Handling
- Section 8: Webhooks (overview only — detail in syntax-webhooks)
- Section 11: API Surface Summary

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Terminology mapping table MUST be prominent (top of Quick Reference)
```

---

### Batch 2

#### Prompt: speckle-syntax-base-objects

```
## Task: Create the speckle-syntax-base-objects skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-syntax\speckle-syntax-base-objects\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (constructor signatures and property tables for all geometry types)
3. references/examples.md (working code: create point, line, mesh, collection, domain objects)
4. references/anti-patterns.md (object creation mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-syntax-base-objects
description: >
  Use when creating Speckle geometry (Point, Line, Mesh, Brep), collections, or domain objects (Wall, Floor, Beam).
  Prevents missing units on geometry, incorrect displayValue wrapping, and broken viewer rendering from unwrapped root objects.
  Covers Base object creation in Python and C#, geometry primitives, typed vs dynamic properties, Collections, displayValue, and Speckle.Objects domain classes.
  Keywords: speckle point, line, mesh, brep, polyline, collection, wall, floor, beam, geometry, displayValue, create object.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Creating Base objects: Python (Base()) and C# (new Base())
- Dynamic properties: setting arbitrary key-value pairs
- Typed properties: subclassing Base with type annotations
- Geometry primitives: Point, Line, Polyline, Mesh, Brep, Arc, Circle, Ellipse (constructor signatures)
- Units: ALWAYS set units on geometry objects; valid unit strings
- displayValue: attaching visual representation for viewer rendering
- Collections: grouping objects with Collection type
- Wrapping in root Base container: required for Speckle viewer to render
- Speckle.Objects domain classes: Wall, Floor, Beam, Column (C# only)

### Research Sections to Read
From vooronderzoek-speckle-object-model.md:
- Section 5: Data Schema Layers
- Section 6: Proxy Types
- Section 7: displayValue
- Section 8: Units

From vooronderzoek-speckle-sdks.md:
- Section 1.5: Python Object Creation
- Section 1.6: Python Geometry Examples
- Section 2.3: C# Object Creation

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- EVERY geometry type MUST have both Python AND C# examples
```

#### Prompt: speckle-syntax-graphql

```
## Task: Create the speckle-syntax-graphql skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-syntax\speckle-syntax-graphql\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (complete GraphQL query/mutation/subscription catalog)
3. references/examples.md (working GraphQL queries with variables)
4. references/anti-patterns.md (GraphQL query mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-syntax-graphql
description: >
  Use when writing GraphQL queries, mutations, or subscriptions against the Speckle Server API.
  Prevents incorrect pagination patterns, missing variable declarations, and deprecated query usage.
  Covers all major queries (activeUser, project, workspace, serverInfo), mutations (CRUD for projects/models/versions/webhooks/tokens), subscriptions, cursor-based pagination, and nested query patterns.
  Keywords: speckle graphql, query, mutation, subscription, pagination, activeUser, project, model, version, cursor.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Queries: activeUser, project (by id), project.models, project.versions, workspace, serverInfo
- Mutations: projectMutations (create/update/delete), modelMutations (create/update/delete), versionMutations (create/delete/moveToModel), webhookCreate/update/delete, apiTokenCreate
- Subscriptions: projectModelsUpdated, projectVersionsUpdated, userProjectsUpdated
- Cursor-based pagination: cursor + limit pattern, hasNextItems, totalCount
- Variables: proper variable declaration and passing
- Error handling: GraphQL error response format, partial success handling
- Nested queries: fetching project with models and versions in one query

### Research Sections to Read
From vooronderzoek-speckle-api.md:
- Section 2: Major Queries
- Section 3: Major Mutations
- Section 4: Subscriptions
- Section 5: Pagination
- Section 6: Error Handling

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All GraphQL examples MUST be syntactically valid
- Include v2 vs v3 query differences where applicable
- Include Critical Warnings section with NEVER rules
- methods.md MUST be a complete catalog (every query, mutation, subscription)
```

#### Prompt: speckle-syntax-webhooks

```
## Task: Create the speckle-syntax-webhooks skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-syntax\speckle-syntax-webhooks\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (webhook GraphQL mutations and event type reference)
3. references/examples.md (working webhook create/update/delete + payload handling)
4. references/anti-patterns.md (webhook configuration mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-syntax-webhooks
description: >
  Use when setting up Speckle webhooks, handling webhook payloads, or automating reactions to Speckle events.
  Prevents incorrect event trigger strings, missing webhook security validation, and exceeded webhook limits.
  Covers webhook lifecycle (create/update/delete), all 14 event types with trigger strings, payload structure, configuration limits, security, and retry behavior.
  Keywords: speckle webhook, event, trigger, payload, webhookCreate, commit_create, stream_update, branch_create.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Webhook CRUD: webhookCreate, webhookUpdate, webhookDelete GraphQL mutations
- Event types: all 14 trigger strings (commit_create, commit_update, commit_receive, commit_delete, stream_update, stream_permissions_add, stream_permissions_remove, branch_create, branch_update, branch_delete, comment_created, comment_archived, comment_replied, stream_delete)
- Payload structure: JSON body format per event type
- Configuration limits: max webhooks per stream, rate limits
- Security: secret-based validation, HMAC signature verification
- Retry behavior: retry count, backoff, failure handling
- WebhookCreateInput type: all fields with types

### Research Sections to Read
From vooronderzoek-speckle-api.md:
- Section 8: Webhooks

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All GraphQL examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Complete event type table with EXACT trigger strings
```

---

### Batch 3

#### Prompt: speckle-syntax-automate

```
## Task: Create the speckle-syntax-automate skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-syntax\speckle-syntax-automate\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (AutomationContext API signatures, FunctionInputs patterns)
3. references/examples.md (working automate function skeletons in Python + C#)
4. references/anti-patterns.md (automate function mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-syntax-automate
description: >
  Use when writing Speckle Automate functions, defining function inputs, or using the AutomationContext API.
  Prevents incorrect input schema definition, missing error reporting, and broken function registration.
  Covers Automate function structure, FunctionInputs (Pydantic/DataAnnotations), AutomationContext API (receive_version, attach_error_to_objects, mark_run_failed/success, store_file_result, set_context_view), and execute_automate_function.
  Keywords: speckle automate, automation context, function inputs, automate function, mark_run_failed, attach_error, store_file_result.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Automate function structure: entry point, registration, execution flow
- FunctionInputs: Python (Pydantic BaseModel) vs C# (DataAnnotations) input definition
- AutomationContext API: receive_version(), attach_error_to_objects(), attach_info_to_objects(), mark_run_failed(), mark_run_success(), store_file_result(), set_context_view()
- execute_automate_function: wrapping function with context injection
- Python vs C# comparison: side-by-side API differences
- Deployment flow overview (detail in impl-automate-functions)

### Research Sections to Read
From vooronderzoek-speckle-automate.md:
- Section 1: Automate Overview
- Section 2: Function Structure
- Section 3: FunctionInputs
- Section 4: AutomationContext API
- Section 5: Execute Pattern
- Section 6: Deployment Overview

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- BOTH Python and C# examples for every API method
```

#### Prompt: speckle-impl-python-sdk

```
## Task: Create the speckle-impl-python-sdk skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-python-sdk\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (SpeckleClient methods, operations, resource modules)
3. references/examples.md (end-to-end Python workflows: auth, create, send, receive)
4. references/anti-patterns.md (Python SDK mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-python-sdk
description: >
  Use when writing Python code with SpecklePy to send, receive, or query Speckle data.
  Prevents auth token confusion, incorrect transport setup, and missing resource module patterns.
  Covers SpecklePy installation, SpeckleClient authentication, resource modules (project, model, version, active_user, server, workspace), operations (send/receive/serialize/deserialize), ServerTransport configuration, and local data paths.
  Keywords: specklepy, python sdk, SpeckleClient, operations.send, operations.receive, ServerTransport, pip install specklepy.
license: MIT
compatibility: "Designed for Claude Code. Requires Python 3.10+, SpecklePy (latest), Speckle Server 2.x/3.x."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Installation: pip install specklepy, Python 3.10+ requirement
- SpeckleClient: constructor (host URL), authenticate_with_token(), authenticate_with_account()
- Resource modules: client.project, client.model, client.version, client.active_user, client.server, client.workspace
- Operations: send(), receive(), serialize(), deserialize() — full signatures
- ServerTransport: 3 auth paths (token, account, client), constructor parameters
- Local data paths: SQLite cache location per OS
- get_default_account(): reading saved credentials from Speckle Manager
- Error handling: SpeckleException types, GraphQL error wrapping

### Research Sections to Read
From vooronderzoek-speckle-sdks.md:
- Section 1: SpecklePy (complete)

From vooronderzoek-speckle-transport.md:
- Section 2: ServerTransport (Python specifics)
- Section 3: SQLiteTransport (Python paths)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- examples.md MUST include a complete end-to-end workflow (auth → create → send → receive)
```

#### Prompt: speckle-impl-sharp-sdk

```
## Task: Create the speckle-impl-sharp-sdk skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-sharp-sdk\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Speckle.Sdk classes, Operations, Helpers API)
3. references/examples.md (end-to-end C# workflows: auth, create, send, receive)
4. references/anti-patterns.md (C# SDK mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-sharp-sdk
description: >
  Use when writing C#/.NET code with Speckle.Sdk to send, receive, or query Speckle data.
  Prevents old vs new SDK confusion, missing IL Repack dependency isolation, and incorrect DI registration.
  Covers Speckle.Sdk NuGet installation, old vs new SDK migration, Client/Account setup, Operations (Send/Receive/Serialize/Deserialize), Helpers (simplified API), IL Repack, Speckle.Objects domain model, and dependency injection patterns.
  Keywords: speckle sdk, csharp, dotnet, Speckle.Sdk, nuget, Operations.Send, Operations.Receive, Helpers, IL Repack, Speckle.Objects.
license: MIT
compatibility: "Designed for Claude Code. Requires .NET Standard 2.0+, Speckle.Sdk (latest), Speckle Server 2.x/3.x."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Installation: NuGet packages (Speckle.Sdk, Speckle.Objects), .NET Standard 2.0
- Old vs new SDK: SpeckleSharp (legacy) vs Speckle.Sdk (current) — migration notes
- Client/Account: creating Client, Account resolution, token auth
- Operations: Send(), Receive(), Serialize(), Deserialize() — full signatures
- Helpers: simplified high-level API for common operations
- IL Repack: dependency isolation for plugin environments (Revit, Rhino)
- Speckle.Objects: domain model classes (Wall, Floor, Beam, Column, etc.)
- Dependency Injection: registering Speckle services in DI container

### Research Sections to Read
From vooronderzoek-speckle-sdks.md:
- Section 2: Speckle Sharp / Speckle.Sdk (complete)

From vooronderzoek-speckle-transport.md:
- Section 2: ServerTransport (C# specifics)
- Section 3: SQLiteTransport (C# paths)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- examples.md MUST include a complete end-to-end workflow (auth → create → send → receive)
- CLEARLY mark old SDK patterns as DEPRECATED
```

---

### Batch 4

#### Prompt: speckle-impl-connectors-overview

```
## Task: Create the speckle-impl-connectors-overview skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-connectors-overview\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (connector architecture API: ToSpeckle, ToHost, conversion interfaces)
3. references/examples.md (connector matrix, conversion pipeline examples)
4. references/anti-patterns.md (connector integration mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-connectors-overview
description: >
  Use when understanding Speckle connector architecture, planning cross-tool data exchange, or debugging conversion pipelines.
  Prevents misunderstanding of the ToSpeckle/ToHost conversion flow, incorrect applicationId assumptions, and missing proxy architecture patterns.
  Covers DUI3 shared UI, conversion pipeline (ToSpeckle/ToHost), supported connectors matrix, connector SDK, proxy architecture, data schema for connectors, applicationId, and units handling.
  Keywords: speckle connector, conversion, ToSpeckle, ToHost, DUI3, applicationId, proxy, data schema, connector matrix.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, Speckle Connectors (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Connector architecture: DUI3 shared UI framework, connector SDK
- Conversion pipeline: ToSpeckle (host→Speckle) and ToHost (Speckle→host) flow
- Supported connectors matrix: all connectors with version ranges and capabilities
- Proxy architecture: how proxies (RenderMaterial, Level, Group) cross application boundaries
- Data schema for connectors: DataObject, displayValue, Collection usage
- applicationId: stability across send/receive cycles, role in federation
- Units handling: how connectors read and write units

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 1: Connector Architecture
- Section 12: Cross-Tool Federation
- Section 13: Data Schema and Proxy Architecture

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Connector support matrix MUST be a complete table with ALL connectors
```

#### Prompt: speckle-impl-viewer

```
## Task: Create the speckle-impl-viewer skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-viewer\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Viewer class API, all extension APIs)
3. references/examples.md (setup, load, filter, select, diff, measure examples)
4. references/anti-patterns.md (viewer integration mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-viewer
description: >
  Use when embedding the Speckle viewer in a web application, loading 3D models, or implementing viewer interactions.
  Prevents missing extension initialization, incorrect loader setup, and broken event handling.
  Covers @speckle/viewer setup, Viewer class lifecycle, SpeckleLoader, UrlHelper, extensions (CameraController, FilteringExtension, SelectionExtension, DiffExtension, MeasurementsTool, SectionTool), events, and custom extension development.
  Keywords: speckle viewer, 3d viewer, webgl, load model, filter, select, diff, measure, section, camera, extension, embed.
license: MIT
compatibility: "Designed for Claude Code. Requires @speckle/viewer (latest), Speckle Server 2.x/3.x."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Setup: npm install @speckle/viewer, container element, initialization
- Viewer class: constructor (container, params), init(), loadObject(), dispose()
- SpeckleLoader + UrlHelper: creating loaders from Speckle URLs
- Extensions: CameraController, FilteringExtension, SelectionExtension, DiffExtension, MeasurementsTool, SectionTool — initialization and API
- Events: ViewerEvent types, addEventListener, removeEventListener
- Rendering pipeline: scene setup, materials, lighting
- Custom extensions: creating and registering extensions

### Research Sections to Read
From vooronderzoek-speckle-sdks.md:
- Section 3: Speckle Viewer (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek (TypeScript/JavaScript)
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- examples.md MUST include a complete setup-to-render workflow
```

#### Prompt: speckle-impl-automate-functions

```
## Task: Create the speckle-impl-automate-functions skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-automate-functions\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (function template structure, CI/CD config, deployment API)
3. references/examples.md (end-to-end function: create, test, deploy, publish)
4. references/anti-patterns.md (automate function development mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-automate-functions
description: >
  Use when building, testing, deploying, or publishing Speckle Automate functions end-to-end.
  Prevents broken CI/CD pipelines, incorrect input schema registration, and missing error reporting in automation runs.
  Covers end-to-end function development, Python+C# templates, local testing, GitHub Actions CI/CD, deployment wizard, Function Library publishing, input schema definition, error reporting, file artifacts, and flatten_base traversal.
  Keywords: speckle automate function, deploy, publish, github actions, ci/cd, function library, local testing, template, flatten_base.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, speckle-automate (Python/C#)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Function templates: Python (speckle-automate) and C# project structure
- Local testing: running functions locally with test data
- GitHub Actions CI/CD: workflow file structure, secrets, triggers
- Deployment wizard: step-by-step deployment to Speckle Automate
- Function Library: publishing functions for reuse
- Input schema: defining and validating FunctionInputs
- Error reporting: attach_error_to_objects, mark_run_failed, result messages
- File artifacts: store_file_result for generated files
- flatten_base: traversing received objects for analysis

### Research Sections to Read
From vooronderzoek-speckle-automate.md:
- Section 3: Function Templates
- Section 4: Local Testing
- Section 5: CI/CD and Deployment
- Section 6: Function Library
- Section 7: Advanced Patterns (flatten_base, file artifacts)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- examples.md MUST include a complete function from template to deployment
```

---

### Batch 5

#### Prompt: speckle-impl-revit

```
## Task: Create the speckle-impl-revit skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-revit\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Revit connector modes, parameter mapping, coordinate systems)
3. references/examples.md (publish/receive workflows, parameter handling)
4. references/anti-patterns.md (Revit connector mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-revit
description: >
  Use when sending or receiving BIM data between Revit and Speckle, configuring parameter mapping, or handling coordinate systems.
  Prevents loss of parametric data on receive (ALWAYS creates Direct Shapes), coordinate system misalignment, and linked model confusion.
  Covers Revit 2022-2026 connector, 3 publishing modes (selection/view/category), Direct Shape receive behavior, parameter mapping, linked models, coordinate systems (Internal Origin/Project Base/Survey Point), rebar, and materials.
  Keywords: speckle revit, revit connector, direct shape, parameter mapping, coordinate system, linked model, publish, receive, BIM.
license: MIT
compatibility: "Designed for Claude Code. Requires Revit 2022-2026, Speckle Connector for Revit (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Revit versions: 2022, 2023, 2024, 2025, 2026 support matrix
- Publishing modes: selection-based, view-based, category-based — when to use each
- Direct Shape on receive: ALWAYS creates Direct Shape geometry (no parametric families)
- Parameter mapping: how Revit parameters map to Speckle properties and back
- Linked models: publishing linked Revit models, limitations
- Coordinate systems: Internal Origin, Project Base Point, Survey Point — which is used when
- Rebar handling: supported rebar types, limitations
- Material handling: how materials transfer, RenderMaterial proxy
- Known limitations: what Revit elements do NOT transfer

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 2: Revit Connector (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Direct Shape limitation MUST be prominently documented (Critical Warning)
```

#### Prompt: speckle-impl-rhino-grasshopper

```
## Task: Create the speckle-impl-rhino-grasshopper skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-rhino-grasshopper\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Rhino connector features, GH component catalog)
3. references/examples.md (Rhino publish/receive, GH component workflows)
4. references/anti-patterns.md (Rhino/GH connector mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-rhino-grasshopper
description: >
  Use when sending geometry from Rhino or Grasshopper to Speckle, or receiving Speckle data into Rhino.
  Prevents missing user strings on receive, broken block handling, and attempting to create native BIM objects from Grasshopper (which is impossible).
  Covers Rhino 7/8 connector (geometry, hatches, text, blocks, user strings, named views, layers), Grasshopper 15+ components (Sign-In, Publish, Load, Query, Filter, Create Collection/Properties/Data Object), 3 object types, and block handling.
  Keywords: speckle rhino, grasshopper, rhino connector, GH component, block, user strings, layers, publish, load, query, filter.
license: MIT
compatibility: "Designed for Claude Code. Requires Rhino 7/8 (Windows), Speckle Connector for Rhino (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Rhino connector: version support (Rhino 7, 8 — Windows only)
- Rhino geometry: all supported geometry types, hatches, text, blocks
- User strings: how Rhino user strings map to Speckle properties
- Named views: sending/receiving named views
- Layers: layer structure mapping to Speckle Collections
- Grasshopper components: complete catalog (Sign-In, Publish, Load, Query, Filter, Create Collection, Create Properties, Create Data Object, etc.)
- GH object types: 3 types of objects in GH workflows
- Block handling: how blocks (instances/definitions) transfer
- Limitation: CANNOT create native BIM objects from Grasshopper

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 3: Rhino Connector (complete)
- Section 4: Grasshopper Connector (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- GH component catalog MUST be complete in methods.md
- BIM object limitation MUST be a Critical Warning
```

#### Prompt: speckle-impl-blender

```
## Task: Create the speckle-impl-blender skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-blender\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Blender connector features, shader types, supported elements)
3. references/examples.md (publish/receive workflows, material handling)
4. references/anti-patterns.md (Blender connector mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-blender
description: >
  Use when exchanging 3D data between Blender and Speckle, handling mesh/curve conversion, or managing materials.
  Prevents attempting Linux usage (unsupported), sending cameras/lights (unsupported), and losing custom properties on receive.
  Covers Blender 4.2-5.0 connector (Win/Mac), mesh and curve support, 4 shader types (Principled/Diffuse/Emission/Glass), Apply Modifiers option, block loading modes, and known limitations (no Linux, no cameras/lights/textures, no custom properties on receive).
  Keywords: speckle blender, blender connector, mesh, curves, materials, shader, principled bsdf, publish, receive.
license: MIT
compatibility: "Designed for Claude Code. Requires Blender 4.2-5.0 (Windows/Mac), Speckle Connector for Blender (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Blender versions: 4.2, 4.3, 4.4, 5.0 — Windows and Mac only (NO Linux)
- Mesh support: all mesh geometry, conversion behavior
- Curve support: supported curve types, conversion behavior
- Shader types: Principled BSDF, Diffuse BSDF, Emission, Glass BSDF — mapping rules
- Apply Modifiers: option behavior, when to enable
- Block loading modes: how Blender instances map to Speckle blocks
- Known limitations: no cameras, no lights, no textures, no custom properties on receive, no Linux

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 5: Blender Connector (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Platform limitation (no Linux) MUST be a Critical Warning
- Unsupported elements MUST be clearly listed
```

---

### Batch 6

#### Prompt: speckle-impl-autocad-civil3d

```
## Task: Create the speckle-impl-autocad-civil3d skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-autocad-civil3d\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (AutoCAD + Civil 3D supported elements, CivilObject types)
3. references/examples.md (publish/receive workflows, XData handling, Civil 3D objects)
4. references/anti-patterns.md (AutoCAD/Civil 3D connector mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-autocad-civil3d
description: >
  Use when exchanging drawing data between AutoCAD or Civil 3D and Speckle, handling solids conversion, or working with Civil 3D infrastructure objects.
  Prevents data loss from 3D solids (converted to mesh), missing XData/Extension Dictionary transfer, and Civil 3D PropertySetDefinition issues.
  Covers AutoCAD 2022-2026 (geometry, hatch, text, blocks, solids-to-mesh, XData, Extension Dictionaries, layers) and Civil 3D (CivilObject types, corridors, featurelines, PropertySetDefinition proxy).
  Keywords: speckle autocad, civil3d, autocad connector, xdata, extension dictionary, civil object, corridor, featureline, layer, block.
license: MIT
compatibility: "Designed for Claude Code. Requires AutoCAD/Civil 3D 2022-2026, Speckle Connector for AutoCAD (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- AutoCAD versions: 2022, 2023, 2024, 2025, 2026
- Geometry support: all standard geometry, hatch, text, blocks, dimensions
- Solids conversion: 3D solids → mesh (data loss warning)
- XData: how AutoCAD XData maps to Speckle properties
- Extension Dictionaries: transfer behavior
- Layer management: layer structure mapping
- Civil 3D: CivilObject types (alignments, profiles, corridors, featurelines, pipe networks)
- PropertySetDefinition: proxy-based transfer, limitations
- No reference point: Civil 3D coordinate handling

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 6: AutoCAD Connector (complete)
- Section 7: Civil 3D Connector (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Solids-to-mesh conversion MUST be a Critical Warning
```

#### Prompt: speckle-impl-tekla

```
## Task: Create the speckle-impl-tekla skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-tekla\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Tekla connector features, TeklaObject type, supported elements)
3. references/examples.md (publish workflows — receive is NOT supported)
4. references/anti-patterns.md (Tekla connector mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-tekla
description: >
  Use when publishing structural steel/concrete data from Tekla Structures to Speckle.
  Prevents attempting to receive data INTO Tekla (publish-only connector), sending assemblies (unsupported), and expecting drawing views.
  Covers Tekla 2023-2025, publish-only behavior, selectable model objects (beams, plates, bolts), TeklaObject type, and known limitations (no assemblies, no drawings, no numbering series, no receive).
  Keywords: speckle tekla, tekla structures, tekla connector, publish only, TeklaObject, structural steel, beam, plate, bolt.
license: MIT
compatibility: "Designed for Claude Code. Requires Tekla Structures 2023-2025, Speckle Connector for Tekla (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Tekla versions: 2023, 2024, 2025
- PUBLISH-ONLY: Tekla connector CANNOT receive data (Critical Warning)
- Selectable model objects: beams, plates, bolts, welds, and other structural elements
- TeklaObject type: Speckle representation of Tekla elements
- Supported elements: complete list of publishable element types
- Known limitations: no assemblies, no drawings, no numbering series, no drawing views, no receive

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 8: Tekla Connector (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- PUBLISH-ONLY limitation MUST be the FIRST Critical Warning
- This is a smaller skill — focus on completeness within limited scope
```

#### Prompt: speckle-impl-powerbi

```
## Task: Create the speckle-impl-powerbi skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-powerbi\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (Power BI helper functions, Data Gateway config)
3. references/examples.md (Power BI data loading and visualization workflows)
4. references/anti-patterns.md (Power BI connector mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-powerbi
description: >
  Use when connecting Power BI to Speckle for BIM data analytics and visualization dashboards.
  Prevents confusing Power BI connector with design connectors (read-only, analytics-focused), and missing Data Gateway setup for scheduled refresh.
  Covers Power BI connector setup, 7 helper functions, Data Gateway configuration for scheduled refresh, read-only data access, and analytics use cases distinct from design connectors.
  Keywords: speckle power bi, powerbi, analytics, dashboard, visualization, data gateway, scheduled refresh, BIM analytics.
license: MIT
compatibility: "Designed for Claude Code. Requires Power BI Desktop, Speckle Connector for Power BI (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Power BI connector: setup, authentication
- 7 helper functions: complete catalog with signatures and descriptions
- Data Gateway: configuration for scheduled refresh in Power BI Service
- Read-only connector: CANNOT write data back to Speckle
- Use case difference: analytics/visualization connector vs design connectors
- Dashboard patterns: common BIM analytics dashboard setups

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 11: Power BI Connector (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Read-only nature MUST be clearly stated upfront
- This is a smaller skill — focus on completeness within limited scope
```

---

### Batch 7

#### Prompt: speckle-impl-federation

```
## Task: Create the speckle-impl-federation skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-federation\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (federation patterns, applicationId rules, proxy reference patterns)
3. references/examples.md (cross-tool workflows: Revit→GH→Revit, multi-model federation)
4. references/anti-patterns.md (federation mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-federation
description: >
  Use when exchanging data between multiple design tools via Speckle, planning federated model workflows, or resolving cross-tool data conflicts.
  Prevents applicationId instability across round-trips, geometry fidelity loss from baking, and broken proxy references in federated views.
  Covers cross-tool data exchange patterns, federated views, proxy-based relationships, applicationId stability, geometry baking for interoperability, asymmetric fidelity, common workflows (Revit to GH to Revit), conflict resolution, and versioning strategies.
  Keywords: speckle federation, cross-tool, data exchange, interoperability, applicationId, geometry baking, federated model, round-trip.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, multiple Speckle Connectors."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Cross-tool data exchange: patterns for moving data between different design tools
- Federated views: combining models from multiple sources in Speckle viewer
- Proxy-based relationships: how proxies maintain cross-application references
- applicationId stability: maintaining object identity across send/receive cycles
- Geometry baking: when and why displayValue is used for interoperability
- Asymmetric fidelity: data loss matrix between connector pairs
- Common workflows: Revit→Grasshopper→Revit, Rhino→Revit, multi-discipline coordination
- Conflict resolution: handling concurrent edits to shared models
- Versioning strategies: branch/model strategies for federated projects

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Section 12: Cross-Tool Federation (complete)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Fidelity loss matrix MUST be included (which data survives between which tools)
```

#### Prompt: speckle-impl-versioning

```
## Task: Create the speckle-impl-versioning skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-impl\speckle-impl-versioning\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (version CRUD GraphQL, DiffExtension API, model management)
3. references/examples.md (create/compare/rollback versions, branch strategies)
4. references/anti-patterns.md (versioning mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-impl-versioning
description: >
  Use when managing Speckle versions (commits), comparing model changes, implementing rollback strategies, or organizing models with branches.
  Prevents version history corruption, incorrect diff interpretation, and orphaned model branches.
  Covers version management (create/compare/rollback), sync strategies, version history traversal, DiffExtension in viewer, branch/model management, and multi-model coordination patterns.
  Keywords: speckle version, commit, branch, model, diff, compare, rollback, history, version management, model management.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Version CRUD: create, list, get, delete versions via GraphQL and SDK
- Version comparison: comparing two versions, identifying changes
- Rollback: receiving a specific historical version
- Sync strategies: manual vs automated version creation
- Version history traversal: navigating commit history
- DiffExtension: visual diff in Speckle viewer between two versions
- Branch/model management: creating, renaming, deleting models (branches)
- Multi-model patterns: organizing large projects with multiple models

### Research Sections to Read
From vooronderzoek-speckle-api.md:
- Section 3: Version/Commit Mutations and Queries

From vooronderzoek-speckle-sdks.md:
- Section 3: Viewer (DiffExtension section)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All code examples verified against vooronderzoek
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Include both GraphQL and SDK (Python + C#) approaches for every operation
```

#### Prompt: speckle-errors-transport

```
## Task: Create the speckle-errors-transport skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-errors\speckle-errors-transport\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (error types, exception classes, retry patterns)
3. references/examples.md (error reproduction and fix patterns)
4. references/anti-patterns.md (transport error-inducing patterns)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-errors-transport
description: >
  Use when debugging Speckle send/receive failures, transport timeout errors, SQLite lock issues, or authentication expiry during transfers.
  Prevents unhandled transport exceptions, SQLite database locks from concurrent access, and silent auth token expiry during long uploads.
  Covers transport failures (network errors, timeout, auth expiry), SQLite lock errors, memory limits, multi-transport errors, batch upload failures, progress reporting errors, and retry strategies.
  Keywords: speckle error, transport error, sqlite lock, timeout, auth expiry, upload failed, receive failed, network error, retry.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Network errors: connection refused, DNS resolution, SSL errors
- Timeout errors: upload/download timeouts, configuring timeout values
- Auth expiry: token expiration during long transfers, refresh patterns
- SQLite lock: concurrent access errors, file locking on Windows
- Memory limits: large object graph OOM errors, chunking strategies
- Multi-transport errors: handling failures in one transport while others succeed
- Batch upload failures: partial upload recovery
- Progress reporting errors: callback exceptions, progress stalling
- Retry strategies: exponential backoff, idempotency

### Research Sections to Read
From vooronderzoek-speckle-transport.md:
- Anti-patterns section (complete)
- Section 2: ServerTransport (error scenarios)
- Section 3: SQLiteTransport (lock scenarios)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- Every error MUST have: symptom, cause, fix pattern
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Decision tree for diagnosing transport errors
```

---

### Batch 8

#### Prompt: speckle-errors-conversion

```
## Task: Create the speckle-errors-conversion skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-errors\speckle-errors-conversion\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (conversion error types, fallback patterns)
3. references/examples.md (error reproduction and fix patterns per connector)
4. references/anti-patterns.md (conversion error-inducing patterns)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-errors-conversion
description: >
  Use when debugging geometry conversion failures, missing properties after receive, or unexpected Direct Shape results in Revit.
  Prevents silent data loss from unsupported geometry types, broken proxy references, and unit mismatch between connectors.
  Covers conversion failures (unsupported geometry, Direct Shape fallback), missing properties on receive, geometry baking data loss, proxy resolution failures, unit mismatch errors, and displayValue rendering issues.
  Keywords: speckle conversion error, unsupported geometry, direct shape, missing properties, unit mismatch, proxy error, displayValue, baking.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Connectors (Revit, Rhino, Blender, AutoCAD)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Unsupported geometry: which geometry types fail in which connectors
- Direct Shape fallback: when and why Revit creates Direct Shapes instead of native elements
- Missing properties on receive: properties that do not survive round-trips
- Geometry baking data loss: what is lost when converting to displayValue mesh
- Proxy resolution failures: broken proxy references across connectors
- Unit mismatch: mismatched units between sending and receiving applications
- displayValue errors: missing or malformed displayValue causing viewer issues
- Connector-specific conversion tables: what converts, what falls back, what fails

### Research Sections to Read
From vooronderzoek-speckle-connectors.md:
- Anti-patterns sections from all connector sections
- Section 2: Revit (conversion limitations)
- Section 3: Rhino (conversion limitations)
- Section 5: Blender (conversion limitations)
- Section 12: Cross-Tool Federation (fidelity loss)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- Every error MUST have: symptom, cause, fix pattern
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Conversion compatibility matrix MUST be included per connector pair
```

#### Prompt: speckle-errors-auth

```
## Task: Create the speckle-errors-auth skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-errors\speckle-errors-auth\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (auth error types, token lifecycle, scope reference)
3. references/examples.md (error reproduction and fix patterns)
4. references/anti-patterns.md (auth error-inducing patterns)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-errors-auth
description: >
  Use when debugging Speckle authentication failures, token expiry issues, or permission denied errors.
  Prevents PAT scope mismatch, OAuth flow misconfiguration, and confusing server vs cloud authentication endpoints.
  Covers auth errors (token expiry, scope mismatch, OAuth flow errors), PAT vs application token confusion, server vs cloud auth differences, refresh token failures, SSO issues, and scope debugging.
  Keywords: speckle auth error, token expired, permission denied, scope mismatch, PAT, oauth error, 401, 403, unauthorized, forbidden.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Token expiry: symptoms, detection, refresh patterns
- Scope mismatch: PAT created with insufficient scopes for operation
- OAuth2+PKCE flow errors: redirect URI mismatch, PKCE verifier errors, state mismatch
- PAT vs application token: when to use which, common confusion points
- Server vs cloud auth: different endpoints, self-hosted configuration
- Refresh token failures: expired refresh tokens, invalid grant errors
- SSO issues: SAML/OIDC integration errors
- Scope debugging: how to check what scopes a token has
- HTTP status codes: 401 vs 403 meaning in Speckle context

### Research Sections to Read
From vooronderzoek-speckle-api.md:
- Section 7: Authentication Errors
- Section 2: PAT Authentication
- Section 3: OAuth2+PKCE
- Anti-patterns section

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- Every error MUST have: symptom, cause, fix pattern
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Decision tree for diagnosing auth errors (401 vs 403 vs token invalid)
```

#### Prompt: speckle-agents-data-validator

```
## Task: Create the speckle-agents-data-validator skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-agents\speckle-agents-data-validator\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (validation rules, property checks, geometry validation patterns)
3. references/examples.md (validation workflow examples)
4. references/anti-patterns.md (validation mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-agents-data-validator
description: >
  Use when validating Speckle objects before sending, checking received data integrity, or auditing model data quality.
  Prevents sending malformed objects that cause viewer rendering failures, missing required properties, and broken proxy references.
  Covers data validation patterns: object schema checking, required property verification, geometry integrity validation, pre-flight checks before send, post-receive validation, proxy reference integrity, and unit consistency checks.
  Keywords: speckle validate, data validation, schema check, property check, geometry integrity, pre-flight, post-receive, quality check.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Object schema validation: checking speckle_type, required Base properties
- Required properties: verifying mandatory properties per object type
- Geometry integrity: validating mesh faces/vertices, closed polylines, valid arcs
- Pre-flight checks: validation before operations.send()
- Post-receive validation: checking received objects for completeness
- Proxy reference integrity: verifying proxy objects resolve correctly
- Unit consistency: checking all geometry objects have consistent units
- Decision trees: when to validate, what to validate, severity levels

### Research Sections to Read
From vooronderzoek-speckle-object-model.md:
- Section 1: Base Class (required properties)
- Section 5: Data Schema Layers (validation rules)
- Section 7: displayValue (validation)
- Section 8: Units (validation)

From vooronderzoek-speckle-connectors.md:
- Section 12: Cross-Tool Federation (data integrity)

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- All validation rules MUST be actionable (check X, if Y then Z)
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- Validation decision tree MUST be included
- Both Python and C# validation code examples
```

---

### Batch 9

#### Prompt: speckle-agents-model-coordinator

```
## Task: Create the speckle-agents-model-coordinator skill

### Output Directory
C:\Users\Freek Heijting\Documents\GitHub\Speckle-Claude-Skill-Package\skills\source\speckle-agents\speckle-agents-model-coordinator\

### Files to Create
1. SKILL.md (main skill file, <500 lines)
2. references/methods.md (decision trees, workflow patterns, connector selection rules)
3. references/examples.md (orchestration workflow examples)
4. references/anti-patterns.md (coordination mistakes)

### Reference Format
Read and follow the structure of:
C:\Users\Freek Heijting\Documents\GitHub\Tauri-2-Claude-Skill-Package\skills\source\tauri-core\tauri-core-architecture\SKILL.md

### YAML Frontmatter
---
name: speckle-agents-model-coordinator
description: >
  Use when planning Speckle workflows across multiple tools, choosing the right connector for a task, or coordinating multi-model federation projects.
  Prevents choosing wrong connectors for tasks, incorrect send/receive sequences, and terminology confusion between old (Stream/Branch/Commit) and new (Project/Model/Version) naming.
  Covers intelligent workflow orchestration: connector selection, send/receive sequence planning, cross-tool federation coordination, terminology resolution, version strategy recommendations, and multi-model coordination patterns.
  Keywords: speckle workflow, orchestrate, coordinator, which connector, federation plan, multi-model, cross-tool, project setup, workflow planning.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, all Speckle Connectors."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

### Scope (EXACT — do not exceed)
- Connector selection: decision tree for choosing the right connector based on task requirements
- Send/receive planning: ordering operations for multi-step workflows
- Cross-tool federation: planning data flow between Revit, Rhino, GH, Blender, AutoCAD, Tekla, Power BI
- Terminology resolution: mapping old↔new terminology in user requests
- Version strategy: recommending branching/model strategies for project types
- Multi-model coordination: organizing multiple models within a project
- Workflow templates: common AEC workflow patterns (design review, clash detection, handoff)
- Skill routing: which skill to load for which user question

### Research Sections to Read
From ALL vooronderzoek files:
- This is a meta-skill that synthesizes knowledge from ALL other skills
- Focus on decision-making patterns, not technical detail
- Reference specific skills for deep-dive content

### Quality Rules
- English only
- SKILL.md < 500 lines; heavy content in references/
- ALWAYS/NEVER deterministic language
- Decision trees MUST cover ALL common workflow scenarios
- Include v2 vs v3 version annotations where applicable
- Include Critical Warnings section with NEVER rules
- This skill MUST reference all other 24 skills by name where appropriate
- methods.md MUST contain complete decision trees (not just guidelines)
```

---

## Appendix: Complete Directory Structure

```
Speckle-Claude-Skill-Package/
├── CLAUDE.md
├── ROADMAP.md
├── REQUIREMENTS.md
├── DECISIONS.md
├── LESSONS.md
├── SOURCES.md
├── WAY_OF_WORK.md
├── CHANGELOG.md
├── INDEX.md
├── OPEN-QUESTIONS.md
├── START-PROMPT.md
├── HANDOFF.md
├── LICENSE
├── .gitignore
├── docs/
│   ├── masterplan/
│   │   ├── raw-masterplan.md
│   │   └── speckle-masterplan.md
│   └── research/
│       ├── vooronderzoek-speckle-object-model.md
│       ├── vooronderzoek-speckle-transport.md
│       ├── vooronderzoek-speckle-api.md
│       ├── vooronderzoek-speckle-sdks.md
│       ├── vooronderzoek-speckle-automate.md
│       └── vooronderzoek-speckle-connectors.md
├── skills/
│   └── source/
│       ├── speckle-core/
│       │   ├── speckle-core-object-model/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-core-transport/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   └── speckle-core-api/
│       │       ├── SKILL.md
│       │       └── references/
│       │           ├── methods.md
│       │           ├── examples.md
│       │           └── anti-patterns.md
│       ├── speckle-syntax/
│       │   ├── speckle-syntax-base-objects/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-syntax-graphql/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-syntax-webhooks/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   └── speckle-syntax-automate/
│       │       ├── SKILL.md
│       │       └── references/
│       │           ├── methods.md
│       │           ├── examples.md
│       │           └── anti-patterns.md
│       ├── speckle-impl/
│       │   ├── speckle-impl-python-sdk/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-sharp-sdk/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-connectors-overview/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-revit/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-rhino-grasshopper/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-blender/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-autocad-civil3d/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-tekla/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-powerbi/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-viewer/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-automate-functions/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-impl-federation/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   └── speckle-impl-versioning/
│       │       ├── SKILL.md
│       │       └── references/
│       │           ├── methods.md
│       │           ├── examples.md
│       │           └── anti-patterns.md
│       ├── speckle-errors/
│       │   ├── speckle-errors-transport/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   ├── speckle-errors-conversion/
│       │   │   ├── SKILL.md
│       │   │   └── references/
│       │   │       ├── methods.md
│       │   │       ├── examples.md
│       │   │       └── anti-patterns.md
│       │   └── speckle-errors-auth/
│       │       ├── SKILL.md
│       │       └── references/
│       │           ├── methods.md
│       │           ├── examples.md
│       │           └── anti-patterns.md
│       └── speckle-agents/
│           ├── speckle-agents-model-coordinator/
│           │   ├── SKILL.md
│           │   └── references/
│           │       ├── methods.md
│           │       ├── examples.md
│           │       └── anti-patterns.md
│           └── speckle-agents-data-validator/
│               ├── SKILL.md
│               └── references/
│                   ├── methods.md
│                   ├── examples.md
│                   └── anti-patterns.md
└── mcp-server/
    └── (planned)
```
