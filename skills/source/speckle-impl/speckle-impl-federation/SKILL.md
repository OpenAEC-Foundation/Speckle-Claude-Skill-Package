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

# speckle-impl-federation

## Quick Reference

### Federation Architecture

| Concept | Description | Key Constraint |
|---------|-------------|----------------|
| Federated View | Multiple models from different tools loaded into one Speckle project | Each model retains its source hierarchy |
| applicationId | Stable cross-version identifier from the source application | NEVER use content-based `id` for tracking — it changes on every data update |
| displayValue | Interoperable geometry primitives (Mesh, Line, Point) | ALWAYS the universal fallback — Brep only for Rhino-capable receivers |
| Proxy | Relationship container linking objects to shared resources | Proxies reference objects by `applicationId`, NEVER by `id` |
| Asymmetric Fidelity | Publishing preserves MORE data than loading can reconstruct | ALWAYS plan for information loss on the receiving side |
| Collections | Hierarchical containers preserving source application structure | Each connector writes its own hierarchy pattern |

### Fidelity Loss Matrix

This matrix defines EXACTLY what happens when data moves between tool pairs. Every cell describes the receiving outcome.

| Source \ Target | Revit | Rhino | Grasshopper | Blender | AutoCAD | Archicad | SketchUp | Power BI |
|-----------------|-------|-------|-------------|---------|---------|----------|----------|----------|
| **Revit** | Direct Shapes | Geometry + user strings | Data Objects | Mesh + materials | Geometry + layers | GDL Objects | Components | Tabular + 3D |
| **Rhino** | Direct Shapes | Native geometry | Geometry Objects | Mesh + curves | Geometry + layers | GDL Objects | Components | Tabular + 3D |
| **Grasshopper** | Direct Shapes | Geometry | Geometry Objects | Mesh + curves | Geometry + layers | GDL Objects | Components | Tabular + 3D |
| **Blender** | Direct Shapes | Mesh + curves | Data Objects | Native mesh | Geometry + layers | GDL Objects | Components | Tabular + 3D |
| **AutoCAD** | Direct Shapes | Geometry | Geometry Objects | Mesh (no solids) | Geometry + layers | GDL Objects | Components | Tabular + 3D |
| **Tekla** | Direct Shapes | Geometry | Data Objects | Mesh | Geometry + layers | GDL Objects | Components | Tabular + 3D |
| **Archicad** | Direct Shapes | Geometry + user strings | Data Objects | Mesh + materials | Geometry + layers | GDL Objects | Components | Tabular + 3D |

**Reading this matrix**: Find the source tool in rows, target tool in columns. The cell describes what the target tool produces when loading from that source.

### Critical Warnings

**NEVER** assume native element recreation on load. Revit ALWAYS creates Direct Shapes. Archicad ALWAYS creates GDL Objects. There is NO native wall, door, or floor reconstruction in ANY connector.

**NEVER** rely on content-based `id` for cross-version tracking. The `id` is a hash of the object's content — it changes every time the object is modified. ALWAYS use `applicationId` for stable tracking.

**NEVER** assume bidirectional capability. Tekla is publish-only. Power BI is load-only (read-only visualization). ALWAYS verify connector direction before planning a workflow.

**NEVER** expect custom properties to survive a full round-trip. Revit, Blender, and Archicad do NOT load custom properties onto received objects. Properties are preserved in Speckle's data model and visible in the web viewer, but the host application may silently drop them.

**NEVER** expect textures to transfer. Speckle does NOT support textures across ANY connector. Only material properties (color, opacity, metallic, roughness) transfer via RenderMaterial proxies.

---

## Federated View Patterns

### Pattern 1: Multi-Discipline Coordination

Multiple teams publish to the same Speckle project from different tools. The federated view shows all models together in the web viewer or Power BI.

```
Architect (Revit)     ──publish──> Speckle Project / architecture
Structural (Tekla)    ──publish──> Speckle Project / structure
MEP (Revit)           ──publish──> Speckle Project / mep
Landscape (Rhino)     ──publish──> Speckle Project / landscape
                                        │
                                        ▼
                              Federated View (Viewer / Power BI)
```

Each model retains its source hierarchy in Collections:
- Architecture: File > Level > Category > Type (Revit pattern)
- Structure: File > Type (Tekla pattern)
- Landscape: File > Layer > Sublayer (Rhino pattern)

### Pattern 2: Design Iteration (Revit to Grasshopper to Revit)

The most common cross-tool workflow in AEC:

```
Step 1: Publish from Revit
        Revit wall (ElementId=12345) → RevitObject with applicationId="12345"
        Properties: type, family, category, level, material quantities
        Geometry: displayValue = [Mesh]

Step 2: Load in Grasshopper
        RevitObject → Data Object (castable to geometry if single displayValue)
        Properties accessible via Deconstruct component
        applicationId preserved: "12345"

Step 3: Modify in Grasshopper
        Use Passthrough nodes to mutate the loaded object
        ALWAYS preserve applicationId — NEVER create new objects from scratch
        Publish back to Speckle

Step 4: Load in Revit
        Modified object → Direct Shape (NOT a native wall)
        Original wall parameters are LOST as native Revit properties
        Properties visible only as Speckle metadata
```

**Key rule**: On return to Revit, objects ALWAYS become Direct Shapes. The native Revit "wall-ness" is permanently lost after a round-trip through any other tool.

### Pattern 3: Design Option Comparison

Publish multiple versions from different tools or iterations. Compare in the web viewer using version history.

```
Option A (Revit v1)   ──publish──> Model / design-options  (version 1)
Option B (Revit v2)   ──publish──> Model / design-options  (version 2)
Option C (Rhino)      ──publish──> Model / design-options  (version 3)
```

The viewer displays version history with diff capabilities. Each version is immutable — previous versions are NEVER overwritten.

---

## applicationId Stability Rules

The `applicationId` is the ONLY stable identifier across versions. These rules are non-negotiable:

### Source Application Mapping

| Connector | applicationId Source | Format | Stability |
|-----------|---------------------|--------|-----------|
| Revit | ElementId | Integer string (e.g., "12345") | Stable within project file; changes on copy/paste to new project |
| Rhino | Object GUID | UUID (e.g., "a1b2c3d4-...") | Stable within file |
| AutoCAD | Handle | Hex string (e.g., "1A2B") | Stable within file |
| Civil 3D | Handle | Hex string | Stable within file |
| Archicad | Element GUID | UUID | Stable within project |
| Tekla | GUID | UUID | Stable within model |
| Blender | Object name | String | Stable only if user does not rename |
| SketchUp | Persistent ID | Integer | Stable within file |

### Grasshopper applicationId Problem

Grasshopper parameters generate NEW GUIDs on every Grasshopper solve cycle. This breaks change tracking completely.

**Solution**: ALWAYS use Passthrough nodes to mutate existing loaded objects. Passthrough nodes preserve the original `applicationId` from the source application. NEVER create new objects from scratch in Grasshopper if you need change tracking.

### Proxy Reference Integrity

Proxies (RenderMaterial, Level, Group, Definition, Color) reference objects by `applicationId`:

```
RenderMaterial Proxy:
  applicationId: "mat-brick-red"
  objects: ["12345", "12346", "12347"]   ← these are applicationIds of objects
```

If an object's `applicationId` changes (e.g., Grasshopper regenerates it), the proxy reference breaks silently. The object loses its material/level/group association with NO error message.

---

## Geometry Baking Strategy

### The displayValue Contract

Every DataObject MUST include `displayValue` — an array of interoperable geometry primitives:

| Primitive | Used By | Description |
|-----------|---------|-------------|
| Mesh | ALL connectors | Universal fallback — triangulated geometry with optional vertex colors |
| Line | Most connectors | Straight line segment between two points |
| Point | Most connectors | Single coordinate in 3D space |
| Polyline | Most connectors | Connected sequence of line segments |
| Arc | Some connectors | Circular arc defined by plane, radius, angles |
| Brep | Rhino, Grasshopper | NURBS boundary representation — ONLY useful for Rhino-ecosystem receivers |

### Baking Rules

1. **Mesh is king**: ANY receiver can display a Mesh. ALWAYS include Mesh geometry in `displayValue` for maximum interoperability.
2. **Brep is bonus**: Include Brep data ONLY when the source application natively works with NURBS. Rhino and Grasshopper can use it; all other connectors ignore it and fall back to Mesh.
3. **Solids vanish**: AutoCAD and Civil 3D solids are ALWAYS converted to Mesh during publishing. This conversion is irreversible. NEVER plan a workflow that requires solid geometry to survive the Speckle pipeline.
4. **Units travel with objects**: Every geometry object carries a `units` field. Unit conversion happens automatically during the conversion pipeline. NEVER assume all objects share the same unit system in a federated model.

### What Survives Cross-Tool Exchange

| Data Type | Survives? | Notes |
|-----------|-----------|-------|
| Mesh geometry | ALWAYS | Universal primitive |
| Brep geometry | Rhino ecosystem only | Other tools get Mesh fallback |
| Material properties | ALWAYS (via proxy) | Color, opacity, metallic, roughness |
| Textures | NEVER | Not supported in any connector |
| Custom properties | Varies by target | Revit, Blender, Archicad DROP on load |
| Level associations | BIM connectors only | Via Level proxy |
| Block/Instance definitions | Most connectors | Via Definition proxy |
| Named views | Perspective only | No orthographic/plan/section views |
| Element categories | Source-specific | Lost on cross-tool transfer |
| Native type information | NEVER on load | Direct Shapes / GDL Objects only |

---

## Conflict Resolution

### Version Conflicts

When multiple users publish to the same model from different tools:

1. **No automatic merge**: Speckle does NOT merge versions. Each publish creates a new version. The latest version replaces the previous one for that model.
2. **Branch strategy**: Use separate models (branches) per discipline. Federate at the project level, not the model level.
3. **Version history**: All previous versions are preserved and accessible. NEVER rely on overwriting — Speckle is append-only for versions.

### Coordinate System Alignment

| Connector | Reference Point Options | Default |
|-----------|------------------------|---------|
| Revit | Internal Origin, Project Base, Survey Point | Internal Origin |
| Archicad | Project Origin | Project Origin |
| Rhino | World Origin | World Origin |
| AutoCAD | World Origin | World Origin |
| Civil 3D | World Origin (NO reference point option) | World Origin |
| Blender | World Origin | World Origin |

**Critical rule**: ALWAYS align reference points BEFORE publishing to a federated project. Misaligned reference points cause models to appear in wrong positions. The most common mistake is mixing Revit's Internal Origin with Survey Point across different Revit files in the same project.

### Duplicate Object Resolution

When the same physical element exists in multiple source models (e.g., a shared wall between architect and structural engineer):

1. **No deduplication**: Speckle does NOT deduplicate across models. Both versions exist in the federated view.
2. **applicationId collision**: Different tools assign different `applicationId` values to the same physical element. There is NO automatic cross-tool identity matching.
3. **Manual coordination**: Teams MUST agree on ownership boundaries. One discipline owns each element category.

---

## Versioning Strategies for Federation

### Strategy 1: Model-Per-Discipline

```
Project/
├── architecture/    ← Revit (architect)
├── structure/       ← Tekla (structural engineer)
├── mep/             ← Revit (MEP engineer)
├── landscape/       ← Rhino (landscape architect)
└── coordination/    ← Federated analysis results
```

Each discipline publishes to its own model. Federation happens at the project level. This is the RECOMMENDED approach for multi-discipline projects.

### Strategy 2: Model-Per-Zone

```
Project/
├── building-a/      ← Multiple disciplines for Building A
├── building-b/      ← Multiple disciplines for Building B
└── site/            ← Site-wide elements
```

Useful for large campus projects where zone-based coordination matters more than discipline-based.

### Strategy 3: Version Tagging Convention

ALWAYS establish a version naming convention before starting federated workflows:

```
[DISCIPLINE]-[PHASE]-[DATE]-[DESCRIPTION]
Examples:
  ARCH-SD-20260320-initial-layout
  STRUCT-DD-20260320-column-grid-update
  MEP-CD-20260320-duct-routing-v2
```

---

## Collection Hierarchy Preservation

Each connector writes a specific hierarchy pattern into Speckle Collections. Understanding this is essential for navigating federated data:

| Connector | Hierarchy Pattern | Example Path |
|-----------|-------------------|--------------|
| Revit | File > Level > Category > Type | `Building.rvt / Level 1 / Walls / Basic Wall - 200mm` |
| Rhino | File > Layer > Sublayer | `Model.3dm / Architecture / Facades / Glass Panels` |
| AutoCAD | File > Layer | `Site.dwg / Boundaries` |
| Civil 3D | File > Layer | `Roads.dwg / Alignment-Centerlines` |
| Archicad | File > Floor > Type | `Building.pln / Ground Floor / Wall` |
| Tekla | File > Type | `Structure.db1 / Beam` |
| Grasshopper | User-defined Collections | `analysis / load-paths / primary` |

**Key insight**: Consumers of federated data can navigate using the source application's familiar hierarchy. A structural engineer browsing the architect's model sees Revit's Level > Category > Type structure intact.

---

## Power BI Federation

Power BI is the primary tool for federated model analysis. It provides unique federation capabilities:

### Manual Federation Function

```
Speckle.Models.Federate(model1, model2, ..., modelN)
```

This function combines multiple loaded models into a single federated dataset for unified querying and 3D visualization.

### Federation Analysis Workflow

1. Load each discipline model using the Power BI Connector
2. Use `Speckle.Models.Federate()` to combine datasets
3. Cross-reference properties across disciplines using shared spatial coordinates
4. Visualize federated model in the 3D Viewer Visual
5. Build dashboards comparing metrics across disciplines

### Power BI Limitations in Federation

- Read-only: CANNOT modify or publish data back
- Tabular data model: Complex nested properties require `Speckle.Utils.ExpandRecord()`
- No clash detection: Spatial analysis must be done manually or via Automate

---

## Reference Links

- [references/methods.md](references/methods.md) — Federation API methods, proxy structures, collection operations
- [references/examples.md](references/examples.md) — Complete federation workflow examples with code
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do in federated workflows

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview.md
- https://docs.speckle.systems/developers/data-schema/proxy-schema.md
- https://docs.speckle.systems/developers/data-schema/connector-index.md
- https://docs.speckle.systems/connectors/revit/revit.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper.md
- https://docs.speckle.systems/connectors/power-bi/power-bi.md
