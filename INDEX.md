# Speckle Skill Package — Skill Index

> ~22 deterministic skills for Speckle data platform interaction with Claude.
> Each skill is self-contained, English-only, and follows ALWAYS/NEVER deterministic language.

---

## Skills by Category

### Core (3 skills) — Foundation knowledge

These skills define the fundamental concepts every other skill builds on: object model, transport system, and API surface.

| # | Skill | Path | Status | Description |
|---|-------|------|--------|-------------|
| 1 | speckle-core-object-model | `skills/source/speckle-core/` | NOT STARTED | Speckle Base object hierarchy, dynamic properties, detaching/chunking, hashing, object serialization/deserialization, and the object graph structure. |
| 2 | speckle-core-transport | `skills/source/speckle-core/` | NOT STARTED | Transport abstraction layer: ServerTransport, SQLiteTransport, MemoryTransport. Send/receive operations, object storage, caching strategy, and transport composition. |
| 3 | speckle-core-api | `skills/source/speckle-core/` | NOT STARTED | Speckle Server GraphQL API: authentication (tokens, OAuth), streams/projects, branches/models, commits/versions, user management, server info, and REST endpoints for object upload/download. |

---

### Syntax (4 skills) — How to work with Speckle

These skills cover the mechanics of constructing objects, queries, webhooks, and automation functions.

| # | Skill | Path | Status | Description |
|---|-------|------|--------|-------------|
| 4 | speckle-syntax-base-objects | `skills/source/speckle-syntax/` | NOT STARTED | Built-in object types: Point, Line, Mesh, Brep, Curve, Polyline, Surface, Vector, Plane, Box, Circle, Arc, Polycurve. Geometry primitives, units system, and custom object creation with dynamic properties. |
| 5 | speckle-syntax-graphql | `skills/source/speckle-syntax/` | NOT STARTED | GraphQL query and mutation patterns: stream CRUD, branch operations, commit operations, object queries, user queries, subscriptions for real-time updates, pagination, and error handling. |
| 6 | speckle-syntax-webhooks | `skills/source/speckle-syntax/` | NOT STARTED | Webhook configuration, event types (commit_create, commit_update, stream_update, branch_create, etc.), payload structure, authentication, retry behavior, and integration patterns. |
| 7 | speckle-syntax-automate | `skills/source/speckle-syntax/` | NOT STARTED | Speckle Automate function definition, AutomateFunction SDK, trigger configuration, input schemas, result reporting (pass/fail/warning), object-level results, and deployment patterns. |

---

### Implementation (10 skills) — SDK and connector recipes

Each implementation skill provides complete, ready-to-use patterns for a specific SDK or connector.

| # | Skill | Path | Status | Description |
|---|-------|------|--------|-------------|
| 8 | speckle-impl-python-sdk | `skills/source/speckle-impl/` | NOT STARTED | SpecklePy complete usage: client initialization, authentication, stream/branch/commit operations, send/receive objects, operations module, transports, and working code examples. |
| 9 | speckle-impl-sharp-sdk | `skills/source/speckle-impl/` | NOT STARTED | Speckle Sharp complete usage: Client, Account, Transport, Operations.Send/Receive, object serialization, .NET integration patterns, and NuGet package references. |
| 10 | speckle-impl-connectors | `skills/source/speckle-impl/` | NOT STARTED | Connector architecture overview: send/receive workflow, element conversion pipeline, connector settings, selection filters, mapping rules, and common patterns across all connectors. |
| 11 | speckle-impl-revit | `skills/source/speckle-impl/` | NOT STARTED | Revit connector: supported element types, family/type mapping, parameter handling, view-based sending, receive behavior (create/update/delete), linked models, and Revit API interaction. |
| 12 | speckle-impl-rhino-grasshopper | `skills/source/speckle-impl/` | NOT STARTED | Rhino connector and Grasshopper components: geometry type support, layer mapping, user attributes, Grasshopper node types (Send, Receive, Create Stream, etc.), custom objects, and data trees. |
| 13 | speckle-impl-blender | `skills/source/speckle-impl/` | NOT STARTED | Blender connector: mesh/curve support, material handling, collection mapping, modifier handling, scene setup, and Blender-specific conversion rules. |
| 14 | speckle-impl-viewer | `skills/source/speckle-impl/` | NOT STARTED | @speckle/viewer setup: embedding, loading objects, camera control, selection, filtering, measurements, section planes, diffing, extensions API, and custom rendering. |
| 15 | speckle-impl-automate-functions | `skills/source/speckle-impl/` | NOT STARTED | Building Automate functions: project setup (Python/C#), function registration, input parameter definition, traversal of received data, result reporting, CI/CD deployment, and testing strategies. |
| 16 | speckle-impl-federation | `skills/source/speckle-impl/` | NOT STARTED | Data federation patterns: multi-model coordination, cross-stream references, model merging, clash detection approaches, and federated model views. |
| 17 | speckle-impl-versioning | `skills/source/speckle-impl/` | NOT STARTED | Version management: commit strategies, branch workflows, diff/compare between versions, rollback patterns, and collaboration workflows with multiple users. |

---

### Errors (3 skills) — Diagnosis and anti-patterns

These skills provide systematic diagnostic approaches for common Speckle errors.

| # | Skill | Path | Status | Description |
|---|-------|------|--------|-------------|
| 18 | speckle-errors-transport | `skills/source/speckle-errors/` | NOT STARTED | Transport error diagnosis: connection failures, timeout issues, object too large, serialization errors, caching problems, and server communication errors. |
| 19 | speckle-errors-conversion | `skills/source/speckle-errors/` | NOT STARTED | Conversion error diagnosis: unsupported element types, geometry conversion failures, unit mismatch, data loss during conversion, connector-specific conversion errors. |
| 20 | speckle-errors-auth | `skills/source/speckle-errors/` | NOT STARTED | Authentication and authorization errors: token expiry, scope issues, permission denied, OAuth flow errors, personal access token management, and server connection issues. |

---

### Agents (2 skills) — Intelligent orchestration

These skills orchestrate the other skills, providing pipelines for model coordination and data validation.

| # | Skill | Path | Status | Description |
|---|-------|------|--------|-------------|
| 21 | speckle-agents-model-coordinator | `skills/source/speckle-agents/` | NOT STARTED | Orchestrator for multi-discipline model coordination: intent parsing, discipline identification, data routing, federation strategy, and cross-model validation. |
| 22 | speckle-agents-data-validator | `skills/source/speckle-agents/` | NOT STARTED | Validation pipeline for Speckle data: object schema validation, geometry checks, property completeness, cross-reference integrity, and standardized validation reports. |

---

## Totals

| Category | Skills | Status |
|----------|--------|--------|
| Core | 3 | 0/3 |
| Syntax | 4 | 0/4 |
| Implementation | 10 | 0/10 |
| Errors | 3 | 0/3 |
| Agents | 2 | 0/2 |
| **Total** | **22** | **0/22** |

---

## Skill Dependencies

```
agents/model-coordinator  ──> ALL impl/* skills (routes by use case)
agents/model-coordinator  ──> agents/data-validator (post-coordination validation)
agents/data-validator     ──> errors/* (references error patterns)

impl/* skills             ──> core/object-model (base object hierarchy)
impl/* skills             ──> core/transport (send/receive operations)
impl/* skills             ──> core/api (server communication)

syntax/base-objects       ──> core/object-model (object hierarchy)
syntax/graphql            ──> core/api (API surface)
syntax/webhooks           ──> core/api (server events)
syntax/automate           ──> core/api (server integration)

errors/transport          ──> core/transport (transport diagnostics)
errors/conversion         ──> core/object-model (object diagnostics)
errors/auth               ──> core/api (authentication diagnostics)
```

---

**Version:** 0.1.0 — Bootstrap complete, all skills NOT STARTED.
