---
name: speckle-agents-model-coordinator
description: >
  Use when planning complex Speckle workflows, choosing the right connector for a task, or coordinating multi-tool data exchange.
  Prevents incorrect connector selection, terminology confusion (Stream vs Project), and broken cross-tool federation workflows.
  Covers intelligent workflow orchestration, connector selection decision trees, send/receive sequence planning, cross-tool federation coordination, terminology resolution, version strategy recommendations, and multi-model coordination.
  Keywords: speckle workflow, orchestrate, coordinate, connector selection, federation, multi-tool, cross-tool, planning, strategy, which connector, how to combine tools, exchange data.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, any Speckle Connector."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-agents-model-coordinator

This is the META-AGENT skill. It references ALL other skills in the package and helps Claude orchestrate complex Speckle workflows by selecting the right skills, connectors, and strategies.

## Skill Package Map

Use this map to determine which skill to consult for a given task.

| Task Domain | Skill | When to Use |
|-------------|-------|-------------|
| Object model basics | `speckle-core-object-model` | Understanding Base objects, serialization, `id` vs `applicationId` |
| GraphQL/REST API | `speckle-core-api` | Authentication, API calls, terminology mapping |
| Transport layer | `speckle-core-transport` | Sending/receiving objects, ServerTransport, local cache |
| Base object creation | `speckle-syntax-base-objects` | Creating custom Speckle objects, property attachment |
| GraphQL queries | `speckle-syntax-graphql` | Writing queries/mutations, pagination, subscriptions |
| Webhooks | `speckle-syntax-webhooks` | Server-side event notifications |
| Automate syntax | `speckle-syntax-automate` | Writing Automate function definitions |
| Python SDK | `speckle-impl-python-sdk` | SpecklePy operations, authentication, send/receive |
| C# SDK | `speckle-impl-sharp-sdk` | Speckle.Sdk operations in .NET |
| Connectors overview | `speckle-impl-connectors-overview` | Conversion pipeline, proxy architecture, connector matrix |
| Revit connector | `speckle-impl-revit` | Revit-specific publish/load, Direct Shapes, reference points |
| Rhino/Grasshopper | `speckle-impl-rhino-grasshopper` | Rhino/GH publish/load, passthrough nodes, block instances |
| Blender connector | `speckle-impl-blender` | Blender-specific publish/load, shader restrictions |
| AutoCAD/Civil 3D | `speckle-impl-autocad-civil3d` | AutoCAD and Civil 3D publish/load, solid-to-mesh |
| Tekla connector | `speckle-impl-tekla` | Tekla publish-only workflows, model viewport requirement |
| Power BI connector | `speckle-impl-powerbi` | Read-only visualization, federated dashboards |
| Viewer embedding | `speckle-impl-viewer` | @speckle/viewer setup, extensions, filtering |
| Automate functions | `speckle-impl-automate-functions` | Building and deploying Automate functions |
| Federation | `speckle-impl-federation` | Cross-tool exchange, fidelity matrix, proxy integrity |
| Versioning | `speckle-impl-versioning` | Version CRUD, model organization, diff/compare |
| Transport errors | `speckle-errors-transport` | Debugging send/receive failures, timeout issues |

---

## Terminology Resolution

ALWAYS use current terminology. Resolve legacy terms immediately when encountered.

| User Says | Correct Term | API Parameter Name | Notes |
|-----------|--------------|--------------------|-------|
| Stream | **Project** | `stream_id` / `projectId` | SDK params still use `stream_id` |
| Branch | **Model** | `branch_name` / `modelId` | Legacy `branch_name` in SpecklePy |
| Commit | **Version** | `commit_id` / `versionId` | GraphQL uses both schemas |
| Collaborator | **Project Collaborator** | varies | Role-based access |

When a user mentions "stream", ALWAYS translate to "project" in your response and note the mapping. When writing code, use the parameter name the SDK expects (which may still be `stream_id`).

---

## Connector Selection Decision Tree

Follow this tree to select the correct connector for any workflow.

### Step 1: What is the source application?

| Application | Connector | Direction | Skill |
|-------------|-----------|-----------|-------|
| Revit | Revit Connector | Publish + Load | `speckle-impl-revit` |
| Rhino | Rhino Connector | Publish + Load | `speckle-impl-rhino-grasshopper` |
| Grasshopper | GH Connector (bundled with Rhino) | Publish + Load | `speckle-impl-rhino-grasshopper` |
| Blender | Blender Connector | Publish + Load | `speckle-impl-blender` |
| AutoCAD | AutoCAD Connector | Publish + Load | `speckle-impl-autocad-civil3d` |
| Civil 3D | Civil 3D Connector | Publish + Load | `speckle-impl-autocad-civil3d` |
| Tekla | Tekla Connector | **Publish ONLY** | `speckle-impl-tekla` |
| Archicad | Archicad Connector | Publish + Load | `speckle-impl-connectors-overview` |
| SketchUp | SketchUp Connector | Publish + Load | `speckle-impl-connectors-overview` |
| Power BI | Power BI Connector | **Load ONLY** (read) | `speckle-impl-powerbi` |
| Python script | SpecklePy | Publish + Load | `speckle-impl-python-sdk` |
| .NET application | Speckle.Sdk | Publish + Load | `speckle-impl-sharp-sdk` |
| Web application | @speckle/viewer | View only | `speckle-impl-viewer` |

### Step 2: What is the data flow direction?

```
Is data going INTO Speckle?
  YES --> Use "Publish" (ToSpeckle conversion)
          Consult the source connector skill
  NO  --> Is data coming OUT of Speckle?
          YES --> Use "Load" (ToHost conversion)
                  Consult the target connector skill
                  CHECK: Does the target connector support Load?
                    Tekla: NO (publish-only)
                    Power BI: read-only (no write-back)
          NO  --> Is this viewing/analysis only?
                  YES --> Use Viewer or Power BI
                  NO  --> Use GraphQL API for metadata operations
```

### Step 3: Check fidelity constraints

Before confirming a workflow, ALWAYS check:

1. **Native reconstruction**: Loading into Revit ALWAYS creates Direct Shapes. Loading into Archicad ALWAYS creates GDL Objects. NEVER promise native element recreation.
2. **Property survival**: Custom properties are DROPPED on load by Revit, Blender, and Archicad. Properties persist in Speckle but NOT in the host application.
3. **Geometry conversion**: AutoCAD/Civil 3D solids become Mesh irreversibly. Brep geometry only survives in the Rhino ecosystem.
4. **Texture loss**: Textures NEVER transfer. Only RenderMaterial properties (color, opacity, metallic, roughness) survive.

---

## Workflow Planning Templates

### Template 1: Revit to Grasshopper Analysis

**Use case**: Extract Revit geometry for parametric analysis in Grasshopper, optionally push results back.

```
Step 1: Publish from Revit
  Connector: Revit
  Skill: speckle-impl-revit
  Settings: Set reference point (Internal Origin recommended)
  Output: RevitObjects with displayValue, properties, applicationIds

Step 2: Load in Grasshopper
  Connector: Grasshopper (bundled with Rhino)
  Skill: speckle-impl-rhino-grasshopper
  Input: Speckle Receive component → project URL or model URL
  Output: Data Objects (geometry + properties accessible via Deconstruct)

Step 3: Analyze/Modify in Grasshopper
  ALWAYS use Passthrough nodes to preserve applicationId
  NEVER create new objects from scratch (breaks change tracking)

Step 4 (optional): Publish results back
  Connector: Grasshopper Send component
  Output: Modified objects retain applicationId for version tracking

Step 5 (optional): Load back in Revit
  WARNING: All objects become Direct Shapes
  Native Revit properties are LOST as editable parameters
```

**Error recovery**: If Grasshopper loses applicationId, check that Passthrough nodes are used. If objects appear at wrong position in Revit, verify reference point settings match between publish and load.

### Template 2: Multi-Discipline Coordination

**Use case**: Multiple teams working in different tools, need a shared federated view.

```
Step 1: Establish project structure
  Skill: speckle-impl-versioning
  Create ONE project with separate models per discipline:
    architecture/    (Revit - architect)
    structure/       (Tekla - structural engineer)
    mep/             (Revit - MEP engineer)
    landscape/       (Rhino - landscape)

Step 2: Align coordinate systems BEFORE publishing
  Skill: speckle-impl-federation
  CRITICAL: All Revit files MUST use the same reference point setting
  Rhino/AutoCAD: Use World Origin (default)
  Revit: Choose ONE setting (Survey Point recommended for geo-referenced)

Step 3: Each discipline publishes to their model
  Each team uses their respective connector
  ALWAYS include descriptive version messages
  ALWAYS set sourceApplication for audit trail

Step 4: Federated view
  Option A: Speckle Web Viewer (load multiple models)
  Option B: Power BI with Speckle.Models.Federate() function
  Option C: Custom viewer using @speckle/viewer

Step 5: Coordination review
  Use viewer filtering to isolate disciplines
  Use version diff to track changes between reviews
```

**Error recovery**: If models appear misaligned, check reference point settings per connector. If a discipline cannot see another's data, verify project permissions.

### Template 3: Design Option Comparison

**Use case**: Compare multiple design iterations or alternatives.

```
Step 1: Choose model organization
  Option A: Single model, multiple versions (same tool, sequential iterations)
  Option B: Multiple models (different tools or parallel alternatives)

Step 2: Publish each option
  Each publish creates an immutable version
  ALWAYS use descriptive version messages:
    "[DISCIPLINE]-[PHASE]-[DATE]-[DESCRIPTION]"
    Example: "ARCH-SD-20260320-courtyard-option-a"

Step 3: Compare in viewer
  Skill: speckle-impl-viewer (DiffExtension)
  Skill: speckle-impl-versioning (version comparison)
  Load two versions side-by-side or use diff overlay

Step 4: Document decision
  Version history preserves all options permanently
  Previous versions are NEVER overwritten
```

### Template 4: Automated Quality Check

**Use case**: Run automated checks on every new version.

```
Step 1: Create Automate function
  Skill: speckle-syntax-automate
  Skill: speckle-impl-automate-functions
  Write a function that validates incoming data

Step 2: Configure trigger
  Trigger: "version created" on target model
  The function runs automatically on each new version

Step 3: Access version data
  Use automation_context to get the triggering version
  Traverse objects, check properties, validate geometry

Step 4: Report results
  Attach results to the version as Automate run output
  Results visible in the web UI alongside the version
```

---

## Version Strategy Decision Matrix

| Scenario | Model Strategy | Version Naming | Skill |
|----------|---------------|----------------|-------|
| Single-discipline, sequential | One model, many versions | `[DATE]-[DESCRIPTION]` | `speckle-impl-versioning` |
| Multi-discipline coordination | One model per discipline | `[DISCIPLINE]-[PHASE]-[DATE]` | `speckle-impl-federation` |
| Design alternatives (same tool) | One model, tagged versions | `option-[LETTER]-[DATE]` | `speckle-impl-versioning` |
| Design alternatives (different tools) | One model per alternative | `[TOOL]-option-[LETTER]` | `speckle-impl-federation` |
| Campus/multi-building | One model per zone | `[ZONE]-[DISCIPLINE]` | `speckle-impl-federation` |
| CI/CD automated pipeline | Dedicated automation model | `auto-[TIMESTAMP]-[HASH]` | `speckle-impl-automate-functions` |

---

## Cross-Tool Fidelity Quick Reference

What survives when data moves between tools:

| Data Type | Survives? | Constraint |
|-----------|-----------|------------|
| Mesh geometry | ALWAYS | Universal primitive for all connectors |
| Brep/NURBS geometry | Rhino ecosystem ONLY | All other connectors get Mesh fallback |
| Material properties | ALWAYS | Color, opacity, metallic, roughness via RenderMaterial proxy |
| Textures | NEVER | Not supported in any connector |
| Custom properties | VARIES | Revit, Blender, Archicad DROP on load |
| Level associations | BIM connectors ONLY | Via Level proxy |
| Block/Instance definitions | Most connectors | Via Definition proxy |
| Named views | 3D perspective ONLY | No plans, sections, elevations |
| Native type info | NEVER on load | Direct Shapes / GDL Objects only |
| applicationId | ALWAYS preserved in Speckle | May break in Grasshopper without Passthrough nodes |

---

## Error Recovery Playbook

### Workflow step fails: objects appear at wrong position

1. **Diagnose**: Reference point mismatch between source and target
2. **Check**: Revit reference point setting (Internal Origin / Project Base / Survey Point)
3. **Fix**: Republish with consistent reference point across all files
4. **Skill**: `speckle-impl-revit`, `speckle-impl-federation`

### Workflow step fails: send/receive timeout or network error

1. **Diagnose**: Large model, network issues, or server resource limits
2. **Check**: Object count (>100k objects may timeout), network connectivity
3. **Fix**: Break model into smaller selections, increase timeout, verify server URL
4. **Skill**: `speckle-errors-transport`, `speckle-core-transport`

### Workflow step fails: objects lose properties after round-trip

1. **Diagnose**: Target connector drops custom properties on load
2. **Check**: Fidelity matrix — does the target connector preserve properties?
3. **Fix**: Accept limitation or use Power BI / Viewer for property inspection
4. **Skill**: `speckle-impl-federation`

### Workflow step fails: Grasshopper loses change tracking

1. **Diagnose**: New GUIDs generated on every solve cycle
2. **Check**: Are Passthrough nodes used to mutate loaded objects?
3. **Fix**: ALWAYS use Passthrough nodes; NEVER create objects from scratch
4. **Skill**: `speckle-impl-rhino-grasshopper`

### Workflow step fails: authentication error

1. **Diagnose**: Token expired, wrong scope, or server URL mismatch
2. **Check**: PAT validity, required scopes (`streams:read`, `streams:write`)
3. **Fix**: Generate new PAT with correct scopes, verify server URL
4. **Skill**: `speckle-core-api`

### Workflow step fails: version creation returns error

1. **Diagnose**: Object not uploaded before version creation, or model does not exist
2. **Check**: Was `send()` / object upload completed before `version.create`?
3. **Fix**: ALWAYS upload objects first, then create version referencing the object hash
4. **Skill**: `speckle-impl-versioning`, `speckle-core-transport`

---

## Coordination Rules

These rules are NON-NEGOTIABLE when orchestrating multi-tool workflows:

1. **ALWAYS** resolve terminology first. If the user says "stream", translate to "project" and confirm.
2. **ALWAYS** check connector direction (publish/load) before planning a workflow. Tekla is publish-only. Power BI is read-only.
3. **ALWAYS** verify fidelity constraints before promising data survival across tools.
4. **ALWAYS** align reference points before federated publishing. Misalignment causes silent positioning errors.
5. **ALWAYS** use Passthrough nodes in Grasshopper to preserve applicationId.
6. **ALWAYS** create versions with descriptive messages and sourceApplication metadata.
7. **NEVER** promise native element recreation on load. Direct Shapes and GDL Objects are the only outcomes.
8. **NEVER** assume properties survive a full round-trip without checking the connector pair.
9. **NEVER** plan workflows that depend on texture transfer.
10. **NEVER** plan workflows that require solid geometry to survive the Speckle pipeline from AutoCAD/Civil 3D.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Orchestration methods, skill routing logic, workflow sequencing
- [references/examples.md](references/examples.md) -- Complete multi-step workflow examples with skill delegation
- [references/anti-patterns.md](references/anti-patterns.md) -- What NOT to do when coordinating Speckle workflows

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview.md
- https://docs.speckle.systems/developers/data-schema/connector-index.md
- https://docs.speckle.systems/connectors/revit/revit.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper.md
- https://docs.speckle.systems/connectors/power-bi/power-bi.md
- https://speckle.guide/dev/python.html
