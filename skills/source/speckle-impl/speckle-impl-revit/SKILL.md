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

# speckle-impl-revit

## Critical Warnings

**ALWAYS** expect Direct Shapes on receive. Speckle NEVER creates native Revit elements (walls, doors, floors, beams) when loading data into Revit. Every received object becomes a Direct Shape (generic model). There is NO native element reconstruction. Plan workflows with this constraint from the start.

**NEVER** rely on custom properties surviving a round-trip back into Revit. Custom properties from Speckle model objects CANNOT be loaded into Revit. Properties are preserved in Speckle's data model and visible in the web viewer, but Revit does NOT attach them to received Direct Shapes.

**NEVER** expect plans, sections, elevations, or orthographic 3D views to publish. Revit ONLY publishes 3D perspective views. All 2D documentation views and orthographic 3D views are silently excluded.

**ALWAYS** verify reference point alignment between publish and receive operations. Mismatched reference point settings (Internal Origin vs. Project Base vs. Survey Point) cause objects to appear at incorrect positions. Use the SAME setting on both ends of the workflow.

**NEVER** assume object categories can be modified after loading. Direct Shapes receive a default category assignment that CANNOT be changed post-load.

---

## Quick Reference

### Supported Versions

| Revit Version | Connector Support | OS |
|---------------|-------------------|-----|
| 2022 | Yes | Windows only |
| 2023 | Yes | Windows only |
| 2024 | Yes | Windows only |
| 2025 | Yes | Windows only |
| 2026 | Yes | Windows only |

### Data Schema Hierarchy

```
File > Level > Category > Type > RevitObject
```

### RevitObject Schema

RevitObject extends DataObject with these connector-specific fields:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Element type name (e.g., "Basic Wall - 200mm"). This is the type NAME, NEVER the Revit TypeId. |
| `family` | string | Family classification |
| `category` | string | Revit category (Walls, Doors, Windows, etc.) |
| `level` | string | Associated building level |
| `location` | Point or Curve | Element position geometry |
| `referencePointTransform` | 4x4 matrix | Transformation based on reference point settings during publish |
| `views` | Camera[] | Saved 3D perspective view cameras |
| `displayValue` | Mesh[] | Visual geometry (meshes, lines, points) |
| `properties` | dict | All captured parameters and metadata |

### Proxy Types Used by Revit

| Proxy Type | Purpose |
|------------|---------|
| RenderMaterial | Color (RGB), opacity, metallic, roughness for element materials |
| Level | Elevation data and level names for floor associations |
| Group | Functional grouping of elements |

---

## Publishing (Revit to Speckle)

### Three Publishing Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Manual Selection** | Select specific elements in the Revit viewport before publishing | Targeted exports, quick sharing of specific elements |
| **View-Based** | Filter and publish elements visible in a specific Revit view | Discipline-specific exports, filtered model sharing |
| **Category-Based** | Publish all elements belonging to selected categories | Full-model exports by element type |

All modes publish visible elements from the Model category (walls, floors, beams, columns) plus visible gridlines from the Annotation category.

### Publishing Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Include Linked Models | ON | Linked models appear as separate File collections in Speckle |
| Reference Point | Internal Origin | Coordinate base: Internal Origin, Project Base, or Survey Point |
| Send Rebars As Volumetric | OFF | Exports rebars as solids instead of curves. WARNING: significant performance impact when enabled. |

### Properties Captured on Publish

Every published RevitObject includes:

- **Element metadata**: Element ID, category, workset
- **Instance parameters**: All instance-level parameter values
- **Type parameters**: All type-level parameter values
- **Material quantities**: Volume and area per material
- **Structural material properties**: Density, compressive strength (where applicable)

### 3D View Publishing Rules

- ONLY 3D perspective views are published
- Plans are NEVER published
- Sections are NEVER published
- Elevations are NEVER published
- Orthographic 3D views are NEVER published
- Published views appear as Camera objects in the `views` field

---

## Receiving (Speckle to Revit)

### Direct Shape Behavior

ALL received objects become Direct Shapes. This is a fundamental architectural constraint of the Speckle Revit connector:

| Source Object | Result in Revit |
|--------------|-----------------|
| Revit wall | Direct Shape |
| Revit door | Direct Shape |
| Rhino Brep | Direct Shape |
| Grasshopper geometry | Direct Shape |
| Tekla beam | Direct Shape |
| IFC element | Direct Shape |

There are ZERO exceptions. Native element reconstruction does NOT exist.

### Receive Settings

| Setting | Description |
|---------|-------------|
| Receive Blocks as Families | Toggle for block instance handling — loads blocks as Revit families |
| Reference Point | Align received geometry to Internal Origin, Project Base, or Survey Point |

### Material Handling on Receive

- Existing Revit materials with matching names are REUSED (not duplicated)
- Direct Shapes allow material editing after loading
- Family-based blocks (when "Receive Blocks as Families" is ON) also allow material editing

### View Creation on Receive

3D views from the source model are automatically created as 3D views in Revit.

---

## Coordinate Systems

### Three Reference Points

| Reference Point | Description | When to Use |
|-----------------|-------------|-------------|
| **Internal Origin** | Revit's absolute internal coordinate origin (0,0,0) | Default. Use when all teams agree on Internal Origin placement. |
| **Project Base** | User-defined project reference point | Use for site-specific positioning across disciplines. |
| **Survey Point** | Real-world survey coordinate reference | Use when geo-referencing is required (civil/infrastructure projects). |

### Coordination Rules

1. **ALWAYS** use the same reference point on publish AND receive
2. The `referencePointTransform` field on RevitObject stores the 4x4 transformation matrix applied during publish
3. Mismatched reference points between source and destination cause positional offset errors
4. When federating models from multiple Revit files, ALL files MUST use the same reference point setting

### Linked Model Coordinate Handling

When "Include Linked Models" is ON:
- Each linked model publishes as a separate File collection
- Linked models inherit the reference point setting of the host file
- Verify that linked files share the same coordinate system before publishing

---

## Linked Models

### Publishing Linked Models

- Enabled by default ("Include Linked Models" toggle)
- Each linked Revit file appears as a separate File collection in Speckle
- Linked model elements are published with their own properties and metadata
- The host file's reference point setting applies to all linked models

### Common Linked Model Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Offset positioning | Different shared coordinates in linked files | ALWAYS verify shared coordinates before publishing |
| Missing linked content | Linked file not loaded in Revit | Ensure all linked files are loaded (not unloaded) before publishing |
| Duplicate elements | Overlapping elements between host and linked files | Review model scope before publishing |

---

## Rebar Handling

### Two Rebar Modes

| Mode | Setting | Output | Performance |
|------|---------|--------|-------------|
| Default (curves) | "Send Rebars As Volumetric" OFF | Rebar centerline curves | Fast |
| Volumetric (solids) | "Send Rebars As Volumetric" ON | Rebar solid geometry | Slow — significant performance impact |

### When to Use Volumetric Rebars

- Use volumetric mode ONLY when visual solid representation is required (e.g., clash detection, visualization)
- NEVER use volumetric mode for large models with thousands of rebars — performance will degrade severely
- Default curve mode is sufficient for quantity takeoffs and structural analysis workflows

---

## Materials

### Material Properties Published

| Property | Type | Description |
|----------|------|-------------|
| Color (RGB) | integer | Red, green, blue color values |
| Opacity | float | Material transparency (0.0 = transparent, 1.0 = opaque) |
| Metallic | float | Metallic appearance factor |
| Roughness | float | Surface roughness factor |

### Material Round-Trip Rules

- Materials publish as RenderMaterial proxies with color, opacity, metallic, and roughness
- On receive, existing Revit materials with matching names are reused
- Material editing is possible on Direct Shapes and family-based blocks
- Textures are NEVER transferred — Speckle does NOT support texture mapping

---

## Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| No native element recreation on receive | ALL objects become Direct Shapes | Accept this constraint; use Speckle for coordination, not round-trip editing |
| No custom property import on receive | Speckle properties not attached to Revit elements | View properties in Speckle web viewer; use Power BI for property analysis |
| No 2D view publishing | Plans, sections, elevations excluded | Export 2D documentation through other channels (PDF, DWG) |
| Categories fixed after load | Cannot reclassify Direct Shapes | Plan category assignments before loading |
| No nested RevitObjects | Geometry exclusively in `displayValue` | Access child elements through collection hierarchy, not object nesting |
| `type` field is name, not TypeId | Cannot programmatically match Revit TypeIds | Use `type` for display only; match by family + type name combination |
| No texture support | Only basic material properties transfer | Apply textures manually in the receiving application |
| Volumetric rebar performance | Large rebar models slow significantly | Use curve mode for large models; volumetric only for targeted exports |

---

## Revit-Specific Workflow Patterns

### Pattern 1: Revit to Grasshopper to Revit

1. Publish from Revit (any mode) with correct reference point
2. Load in Grasshopper → objects become Data Objects
3. Manipulate geometry/properties in Grasshopper
4. Publish back from Grasshopper
5. Load in Revit → ALL objects become Direct Shapes (no native walls/floors)

### Pattern 2: Multi-Discipline Coordination

1. Each discipline publishes from Revit to the same Speckle project
2. ALL teams MUST use the same reference point setting
3. Federated model visible in web viewer
4. Use Power BI connector for cross-discipline quantity analysis

### Pattern 3: Design Review with External Teams

1. Publish model from Revit (view-based mode for filtered content)
2. External teams view in Speckle web viewer (no Revit license needed)
3. Comments and issues tracked in Speckle
4. Properties visible in viewer despite no Revit access

---

## Reference Links

- [references/methods.md](references/methods.md) -- Connector settings, RevitObject fields, and proxy references
- [references/examples.md](references/examples.md) -- Step-by-step publishing and receiving workflows
- [references/anti-patterns.md](references/anti-patterns.md) -- Common mistakes and misconceptions

### Official Sources

- https://docs.speckle.systems/connectors/revit/revit.md
- https://docs.speckle.systems/developers/data-schema/connectors/revit-schema.md
- https://docs.speckle.systems/developers/data-schema/overview.md
- https://docs.speckle.systems/developers/data-schema/proxy-schema.md
