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

# speckle-impl-connectors-overview

## Quick Reference

### Connector Architecture

| Component | Role | Location |
|-----------|------|----------|
| DUI3 (Desktop UI 3) | Shared UI across all connectors | Embedded in host application |
| Conversion Pipeline | ToSpeckle / ToHost object transformation | Connector SDK |
| Transport Layer | Serialization and server communication | Speckle SDK |
| Proxy System | Shared resource references (materials, levels, groups) | Root Collection |
| Speckle Desktop Service | Authentication token management | System service |

### Supported Connectors Matrix

| Connector | Versions | OS | Publish | Load | Native on Load | Schema Type |
|-----------|----------|-----|---------|------|-----------------|-------------|
| Revit | 2022-2026 | Win | Yes | Yes | Direct Shapes | RevitObject |
| Rhino | 7, 8 | Win | Yes | Yes | Geometry | Geometry/Instance |
| Grasshopper | (bundled with Rhino) | Win | Yes | Yes | Geometry | Geometry/Block/Data |
| Blender | 4.2-5.0 | Win/Mac | Yes | Yes | Mesh/Curves | Geometry |
| AutoCAD | 2022-2026 | Win | Yes | Yes | Geometry | Geometry/Instance |
| Civil 3D | 2022-2026 | Win | Yes | Yes | Geometry | Civil3dObject |
| Tekla | 2023-2025 | Win | **Publish only** | No | N/A | TeklaObject |
| Archicad | 27-29 | Win | Yes | Yes | GDL Objects | ArchicadObject |
| SketchUp | 2021-2026 | Win/Mac | Yes | Yes | Components | Geometry |
| Power BI | N/A | Win | No | **Read only** | Tabular + 3D | N/A |

### Critical Warnings

**NEVER** assume native element recreation on load -- Revit ALWAYS creates Direct Shapes, Archicad ALWAYS creates GDL Objects. There is NO native wall/door/floor reconstruction from Speckle data.

**NEVER** assume all connectors support bidirectional data flow -- Tekla is publish-only and Power BI is read-only. ALWAYS verify publish/load capability before designing a workflow.

**NEVER** reference objects by `id` in proxy relationships -- `id` is a content-based hash that changes when data updates. ALWAYS use `applicationId` for cross-version tracking and proxy references.

**NEVER** expect custom properties to round-trip through all connectors -- Revit, Blender, and Archicad do NOT load custom properties back onto received objects. ALWAYS verify property behavior for your specific connector pair.

**NEVER** expect texture support -- Speckle does NOT transfer textures across any connector. Only material properties (color, opacity, metallic, roughness) survive the pipeline.

**NEVER** publish solids from AutoCAD/Civil 3D expecting solid geometry downstream -- solids are ALWAYS converted to Mesh geometry irreversibly.

---

## Conversion Pipeline

### ToSpeckle Flow (Publish)

```
Host Application Object
        |
        v
[1. Selection] --> Manual / View-based / Category-based / All Visible
        |
        v
[2. Conversion] --> Native Object --> Speckle Base Object
        |               |
        |               +--> displayValue: [Mesh, Line, Point]  (interoperable geometry)
        |               +--> properties: { key: value }          (semantic metadata)
        |               +--> applicationId: "native-id"          (stable identifier)
        |               +--> units: "mm" | "m" | "ft" | "in"    (measurement system)
        |
        v
[3. Proxy Extraction] --> Materials, Levels, Groups, Definitions, Colors
        |                   (stored at Root Collection, reference by applicationId)
        |
        v
[4. Transport] --> Serialize + Send to Speckle Server
```

### ToHost Flow (Load/Receive)

```
Speckle Server
        |
        v
[1. Fetch] --> Download objects from server
        |
        v
[2. Conversion] --> Speckle Object --> Host Application Object
        |               |
        |               +--> Attempt native reconstruction (connector-specific)
        |               +--> Fall back to generic representation if native fails
        |
        v
[3. Proxy Resolution] --> Apply materials, assign levels, restore groups
        |
        v
[4. Placement] --> Insert into host application scene/document
```

### Asymmetric Fidelity Rule

Publishing ALWAYS preserves MORE information than loading. A Revit wall published to Speckle retains all parameters, material quantities, and type information. When loaded into Rhino, it becomes geometry with properties as user strings. When loaded back into Revit, it becomes a Direct Shape, NOT a native wall. This asymmetry is fundamental and by design.

---

## Object Types

### Three Object Categories

| Category | Description | Primary Use |
|----------|-------------|-------------|
| Geometry Objects | Pure primitives (Point, Line, Mesh, Brep, Arc, Polyline) | CAD workflows (Rhino, AutoCAD) |
| DataObject | Semantic elements with `properties` + `displayValue` | BIM workflows (Revit, Archicad, Tekla, Civil 3D) |
| Instance Objects | References to Definition proxies via `definitionId` + 4x4 `transform` | Blocks, components, repeated geometry |

### DataObject Extensions by Connector

| Connector | Type | Extra Fields |
|-----------|------|-------------|
| Revit | RevitObject | `type`, `family`, `category`, `level`, `location`, `referencePointTransform`, `views` |
| Archicad | ArchicadObject | `type`, `level`, `location` |
| Civil 3D | Civil3dObject | `type`, `baseCurves` |
| Tekla | TeklaObject | `type`, `properties.Report` |

### displayValue Convention

EVERY connector places interoperable geometry in the `displayValue` array using minimum viable primitives: Mesh, Line, Point. This ensures ANY receiver can render the geometry even without native reconstruction. Brep data MAY be preserved for connectors that support it (Rhino), but Mesh is the universal fallback.

---

## Proxy Architecture

### Five Proxy Types

| Proxy | Purpose | Used By |
|-------|---------|---------|
| RenderMaterial | Color (RGB), opacity, metallic, roughness | All connectors |
| Level | Elevation data and level name | BIM connectors (Revit, Archicad) |
| Group | Functional grouping (objects can belong to multiple groups) | Revit, Rhino, AutoCAD, Civil 3D |
| Definition | Block/component geometry stored once, reused by Instances | Rhino, AutoCAD, Civil 3D |
| Color | Simple hex color (#RRGGBB) | CAD connectors (AutoCAD, Civil 3D) |

### Proxy Structure

Every proxy follows this structure:

```json
{
  "speckle_type": "Objects.Data.RenderMaterialProxy",
  "applicationId": "mat-001",
  "name": "Concrete Gray",
  "value": { "diffuse": 12632256, "opacity": 1.0, "metalness": 0.0, "roughness": 0.8 },
  "objects": ["elem-101", "elem-102", "elem-205"]
}
```

### Proxy Invariants

- Proxies ALWAYS reference objects by `applicationId`, NEVER by `id`
- Proxies NEVER reference other proxies -- no circular references permitted
- Proxies are ALWAYS stored at the Root Collection level
- A single proxy can reference hundreds of objects

---

## Identity System

| Field | Purpose | Stability |
|-------|---------|-----------|
| `id` | Content-based hash (SHA256 of object data) | Changes when ANY data changes |
| `applicationId` | Source application identifier (Revit ElementId, Rhino GUID, AutoCAD Handle) | Stable across publish/load cycles |
| `speckle_type` | Type discriminator (e.g., `"Objects.Data.DataObject:Objects.Data.RevitObject"`) | Fixed per object type |

### applicationId Stability Across Cycles

When a Revit wall is modified and republished:
- `applicationId` remains the same (Revit ElementId persists)
- `id` changes (content hash reflects updated data)
- Proxies continue referencing via the stable `applicationId`

This enables change tracking, version comparison, and proxy resolution across multiple publish cycles.

---

## Units Handling

Every object carries a `units` field. Supported values: `"m"`, `"mm"`, `"cm"`, `"ft"`, `"in"`, `"yd"`.

Unit conversion happens automatically during the conversion pipeline. The connector reads the host application's document units and writes them into each object. On the receiving side, the connector converts incoming units to match the target document.

---

## Collection Hierarchies by Connector

Each connector preserves its native organizational structure:

| Connector | Hierarchy |
|-----------|-----------|
| Revit | File > Level > Category > Type > RevitObject |
| Rhino | File > Layer > Sublayer > Objects |
| AutoCAD | File > Layer > Objects |
| Civil 3D | File > Layer > Objects |
| Archicad | File > Floor > Type > ArchicadObject |
| Tekla | File > Type > TeklaObject |
| Blender | File > Collection > Objects |
| SketchUp | File > Layer > Components |

---

## Connector-Specific Load Behavior

| Connector | What Objects Become on Load |
|-----------|-----------------------------|
| Revit | Direct Shapes (generic models). NEVER native elements. |
| Rhino | Geometry, text, or blocks. Materials and user strings preserved. |
| Grasshopper | Geometry Objects, Block Objects, or Data Objects. NEVER native BIM elements. |
| Blender | Mesh/Curves. Block loading: collection instances (default) or linked duplicates. |
| AutoCAD | Geometry, text, or blocks. Flattened layer structure. Selection Sets created. |
| Civil 3D | Same as AutoCAD (inherits AutoCAD behavior). |
| Archicad | GDL Objects (generic models). Organized in embedded library folders. |
| SketchUp | Components with matching layer structure. Properties as user attributes. |
| Tekla | N/A -- publish-only, no load capability. |
| Power BI | Tabular data + 3D visualization. Read-only. |

---

## Data Federation

### Federated Views

Multiple models from different tools assemble into a single federated view. An architect's Revit model, a structural engineer's Tekla model, and a landscape designer's Rhino model can all coexist in one Speckle project.

### Geometry Baking for Interoperability

All connectors bake geometry into minimum viable interoperable primitives in `displayValue`. This guarantees that ANY receiver can display ANY source geometry regardless of native format support.

### Common Cross-Tool Workflows

1. **Revit to Grasshopper to Revit**: Publish from Revit, load in Grasshopper for parametric analysis, publish back. On return to Revit, objects become Direct Shapes.
2. **Multi-discipline coordination**: Multiple teams publish to the same project. Federated view shows all models together.
3. **Design option comparison**: Publish versions from different tools, compare in viewer.

---

## DUI3 Shared UI

DUI3 (Desktop User Interface 3) provides a consistent interface across all connectors:

- Project and model selection
- Publish and load controls
- Version history navigation
- Account management
- Communicates with Speckle Desktop Service for authentication

EVERY connector uses DUI3. The UI behavior is identical regardless of host application.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Connector API methods, conversion signatures, proxy structures
- [references/examples.md](references/examples.md) -- Cross-tool workflow examples with data flow diagrams
- [references/anti-patterns.md](references/anti-patterns.md) -- Common mistakes with connector workflows

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview.md
- https://docs.speckle.systems/developers/data-schema/concepts.md
- https://docs.speckle.systems/developers/data-schema/proxy-schema.md
- https://docs.speckle.systems/developers/data-schema/connector-index.md
- https://docs.speckle.systems/connectors/revit/revit.md
- https://docs.speckle.systems/connectors/rhino/rhino.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper.md
- https://docs.speckle.systems/connectors/blender.md
- https://docs.speckle.systems/connectors/autocad.md
- https://docs.speckle.systems/connectors/civil3d.md
- https://docs.speckle.systems/connectors/tekla.md
- https://docs.speckle.systems/connectors/archicad.md
- https://docs.speckle.systems/connectors/sketchup.md
- https://docs.speckle.systems/connectors/power-bi/power-bi.md
