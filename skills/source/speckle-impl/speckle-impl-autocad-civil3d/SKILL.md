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

# speckle-impl-autocad-civil3d

## Quick Reference

### Supported Versions

| Application | Versions | OS |
|-------------|----------|-----|
| AutoCAD | 2022, 2023, 2024, 2025, 2026 | Windows only |
| Civil 3D | 2022, 2023, 2024, 2025, 2026 | Windows only |

### Data Schema Hierarchy

```
AutoCAD:   File > Layer > Objects
Civil 3D:  File > Layer > Objects (inherits AutoCAD structure)
```

### Publishable Content (AutoCAD)

| Content Type | Supported | Notes |
|-------------|-----------|-------|
| Geometry (lines, arcs, polylines, circles) | Yes | All standard geometry types |
| Hatch objects | Yes | Pattern and boundary preserved |
| Text objects (single-line, multi-line) | Yes | Content and formatting |
| Block references | Yes | Converted to Instance + Definition proxies |
| 3D Solids | **Mesh only** | ALWAYS converted to Mesh — irreversible |
| Colors | Yes | Via Color proxy |
| Render materials | Yes | Via RenderMaterial proxy |
| XData (Extended Data) | Yes | Appears in `properties` field |
| Extension Dictionaries | Yes | Appears in `properties` field |
| Layers | Yes | Preserved as Collection hierarchy |

### Publishable Content (Civil 3D — Additional)

| Content Type | Supported | Notes |
|-------------|-----------|-------|
| Alignments | Yes | Civil3dObject with `baseCurves` |
| Corridors | Yes | Civil3dObject with corridor featurelines and codes |
| Featurelines | Yes | Civil3dObject with `baseCurves` |
| Pipe Networks | Yes | Civil3dObject with network part specifications |
| Surfaces (TIN/Grid) | Yes | Civil3dObject with surface statistics |
| Catchments | Yes | Civil3dObject with hydrological/hydraulic properties |
| Profiles | Yes | Civil3dObject with `baseCurves` |
| Property Sets | Yes | Organized by name in `properties` |
| Part Data | Yes | Entity-specific information in `properties` |

### Critical Warnings

**NEVER** expect 3D solids to survive the Speckle pipeline as solids. AutoCAD and Civil 3D connectors ALWAYS convert solids to Mesh geometry during publishing. This conversion is irreversible. If downstream workflows require solid geometry (boolean operations, mass properties from solids), this pipeline is NOT suitable.

**NEVER** assume XData or Extension Dictionary data transfers automatically to the receiving application. This data appears in the Speckle `properties` field and is visible in the web viewer, but the receiving connector may NOT attach it to loaded objects.

**NEVER** expect coordinate system alignment options in Civil 3D. Unlike the Revit connector, Civil 3D has NO reference point publishing configuration. Objects publish using the drawing's World Coordinate System.

**NEVER** rely on color display without verifying viewer settings. AutoCAD/Civil 3D colors require Shaded view mode in the Speckle viewer to display correctly.

---

## AutoCAD Object Model in Speckle

### Identity Mapping

| AutoCAD Concept | Speckle Field | Purpose |
|----------------|---------------|---------|
| Handle | `applicationId` | Stable cross-version tracking |
| Content hash | `id` | Deduplication (changes when data changes) |
| Entity type | `speckle_type` | Type discriminator |

The `applicationId` maps to the AutoCAD Handle — a persistent hexadecimal identifier that remains stable across saves and edits. ALWAYS use `applicationId` for cross-version object tracking, NEVER use `id`.

### Geometry Objects

AutoCAD geometry publishes as Speckle Geometry Objects — pure geometric primitives without semantic metadata:

- **Point**, **Line**, **Arc**, **Circle**, **Ellipse**
- **Polyline**, **Polycurve** (complex curves)
- **Mesh** (including converted solids)
- **Hatch** (pattern fills with boundary geometry)
- **Text** (single-line and multi-line)

### Block Architecture

AutoCAD blocks map to Speckle's Instance + Definition pattern:

```
Block Reference (Insert) → Instance Object
  - definitionId: references a Definition proxy
  - transform: 4x4 matrix (position, rotation, scale)

Block Definition → Definition Proxy (at Root Collection level)
  - name: block name
  - value: definition geometry (displayValue)
  - objects: array of applicationId strings for all instances
```

ALWAYS expect blocks to decompose into this two-part structure. A single Definition proxy serves all Instance objects that reference the same block.

### Layer Mapping

AutoCAD layers map directly to Speckle Collections:

```
Drawing.dwg
└── Layer: "A-WALL"
    ├── Line object (applicationId: "1A3")
    └── Polyline object (applicationId: "1B7")
└── Layer: "S-BEAM"
    └── Mesh object (applicationId: "2C4")
```

Layer properties (color, linetype) are NOT preserved as layer metadata. Object-level color assignments transfer via Color proxies.

### Custom Properties (XData and Extension Dictionaries)

XData and Extension Dictionaries appear in the `properties` dictionary of each object:

```json
{
  "speckle_type": "Objects.Geometry.Line",
  "applicationId": "1A3F",
  "properties": {
    "ExtensionDictionary": {
      "MyCustomDict": {
        "ProjectCode": "P-2024-001",
        "Phase": "Construction"
      }
    },
    "XData": {
      "APPNAME": {
        "values": ["custom_data_1", 42.5]
      }
    }
  }
}
```

ALWAYS check the `properties` field for custom data. Extension Dictionaries are nested by dictionary name; XData is nested by registered application name.

### Proxy Types (AutoCAD)

| Proxy Type | Purpose | Stored At |
|-----------|---------|-----------|
| RenderMaterial | RGB color, opacity, metallic, roughness | Root Collection |
| Color | Hex color assignments (#RRGGBB) | Root Collection |
| Group | Functional grouping | Root Collection |
| Definition | Block geometry for reuse by Instances | Root Collection |

---

## Civil 3D Object Model in Speckle

### Civil3dObject

Civil3dObject extends DataObject with infrastructure-specific fields:

```json
{
  "speckle_type": "Objects.Data.DataObject:Objects.Data.Civil3dObject",
  "applicationId": "3F7A",
  "type": "Alignment",
  "displayValue": [
    { "speckle_type": "Objects.Geometry.Mesh", "...": "visual representation" }
  ],
  "baseCurves": [
    { "speckle_type": "Objects.Geometry.Polycurve", "...": "fundamental curve" }
  ],
  "properties": {
    "PropertySets": {
      "Alignment Properties": {
        "StartStation": 0.0,
        "EndStation": 1250.0,
        "Length": 1250.0
      }
    },
    "PartData": { "...": "entity-specific data" }
  }
}
```

### Key Distinction: displayValue vs. baseCurves

| Field | Content | Purpose |
|-------|---------|---------|
| `displayValue` | Mesh/visual geometry | What you SEE in the viewer |
| `baseCurves` | Curve geometry array | The FUNDAMENTAL curve of the civil entity |

**ALWAYS** use `baseCurves` when you need the geometric definition of an alignment, profile, or featureline. The `displayValue` contains the visual representation (a mesh for most Civil 3D objects), which is NOT the same as the design curve.

### Civil 3D Entity Types

| Entity Type | `type` Value | Has `baseCurves` | Key Properties |
|------------|-------------|-------------------|----------------|
| Alignment | `"Alignment"` | Yes | StartStation, EndStation, Length |
| Profile | `"Profile"` | Yes | Station/elevation data |
| Corridor | `"Corridor"` | No | Featurelines, codes, regions |
| Featureline | `"FeatureLine"` | Yes | 3D polyline geometry |
| Pipe Network | `"Pipe"` / `"Structure"` | Varies | Network part specifications |
| Surface | `"TinSurface"` / `"GridSurface"` | No | Surface statistics (area, min/max elevation) |
| Catchment | `"Catchment"` | No | Hydrological and hydraulic properties |
| Parcel | `"Parcel"` | Yes | Area, perimeter |

### Corridor Data Structure

Corridors are complex Civil 3D objects. In Speckle, corridor data includes:

- Featureline geometry for each corridor code point
- Corridor codes identifying each featureline's role
- Region definitions

ALWAYS expect corridor featurelines to be accessed through `properties`, NOT as direct child objects. Corridors do NOT contain nested Civil3dObjects.

### Property Sets

Civil 3D Property Sets publish as structured dictionaries inside `properties`:

```json
{
  "properties": {
    "PropertySets": {
      "Pipe Properties": {
        "InnerDiameter": 0.3,
        "OuterDiameter": 0.35,
        "Material": "PVC",
        "SlopePercent": 2.0
      }
    }
  }
}
```

Each Property Set is keyed by its definition name. Values include strings, numbers, and booleans.

### PropertySetDefinition Proxy (Civil 3D Only)

Civil 3D adds a fifth proxy type not present in standard AutoCAD:

| Proxy Type | Purpose | Stored At |
|-----------|---------|-----------|
| PropertySetDefinition | Encodes Civil 3D property set structures | Root Collection |

This proxy stores the schema of each Property Set — field names, data types, default values. It references objects that use the property set via the standard `objects` array of `applicationId` strings.

### Proxy Types (Civil 3D — Full Set)

| Proxy Type | Purpose |
|-----------|---------|
| RenderMaterial | Material properties |
| Color | Hex color assignments |
| Group | Functional grouping |
| Definition | Block geometry reuse |
| PropertySetDefinition | Property set schema (Civil 3D exclusive) |

---

## Publishing Workflow

### AutoCAD Publishing Steps

1. Open the Speckle connector panel in AutoCAD
2. Select a Speckle project and model
3. Choose objects to publish (manual selection or all visible)
4. Click Publish — all selected objects convert to Speckle schema
5. Layers become Collections; blocks split into Instance + Definition

### Civil 3D Publishing Steps

1. Same UI as AutoCAD (Civil 3D connector extends AutoCAD connector)
2. Civil 3D entities automatically convert to Civil3dObject type
3. Property Sets, Part Data, and class-specific properties captured automatically
4. Standard AutoCAD objects (lines, blocks) publish as standard Geometry Objects

### What Publishes Automatically

- All geometry with layer assignment
- Colors (object-level and layer-level via proxy)
- Render materials
- XData and Extension Dictionaries
- Block references as Instance + Definition
- Civil 3D: Property Sets, Part Data, network specifications, surface statistics

### What Does NOT Publish

- Layer properties (linetype, lineweight as layer metadata)
- Layout/paper space content (model space only)
- OLE objects
- External references (xrefs) as linked data
- Coordinate system/reference point configuration (Civil 3D limitation)

---

## Loading (Receiving) Workflow

### Loading Behavior

| Aspect | Behavior |
|--------|----------|
| Geometry | Loads as native AutoCAD geometry (lines, arcs, meshes) |
| Text | Loads as text objects |
| Blocks | Loads as block references |
| Layer structure | Flattened to match browser viewer display |
| Render materials | Preserved |
| Colors | Preserved via proxy |
| Selection management | Objects loaded into their own Selection Set |
| Custom properties | NOT loaded onto objects |

### Layer Flattening on Load

When loading into AutoCAD/Civil 3D, the layer structure is FLATTENED to match what the Speckle web viewer displays. Nested Collection hierarchies from other connectors (e.g., Revit's Level > Category > Type) collapse into a flat layer structure.

### Selection Set

All loaded objects are placed into a dedicated Selection Set. This enables easy selection of all Speckle-loaded objects without manual picking. ALWAYS use this Selection Set for post-load operations.

---

## Cross-Application Exchange

### AutoCAD/Civil 3D as Publisher

| Receiving App | Result | Notes |
|--------------|--------|-------|
| Revit | Direct Shapes | All geometry becomes generic models |
| Rhino | Native geometry | Lines, meshes, blocks preserved |
| Grasshopper | Geometry/Data Objects | Civil3dObject accessible as Data Object |
| Blender | Mesh/curves | Standard geometry conversion |
| Power BI | Tabular + 3D | Property Sets queryable in Power BI |
| Web viewer | Full fidelity | All properties visible, 3D visualization |

### AutoCAD/Civil 3D as Receiver

| Source App | Result | Notes |
|-----------|--------|-------|
| Revit | Geometry + layers | RevitObject displayValue as meshes |
| Rhino | Geometry + layers | Direct geometry mapping |
| Tekla | Geometry + layers | TeklaObject displayValue as meshes |
| Any source | Flat layers | Hierarchy always flattened |

### Asymmetric Fidelity

Publishing from AutoCAD/Civil 3D preserves MORE information than loading into it. A Civil 3D alignment with Property Sets, station data, and profile geometry publishes as a rich Civil3dObject. When loaded into Rhino, it becomes geometry with properties as user strings — the native Civil 3D semantics are lost. When loaded back into Civil 3D, it becomes standard geometry, NOT a native alignment.

---

## Reference Links

- [references/methods.md](references/methods.md) — Object schemas, property structures, proxy definitions for AutoCAD and Civil 3D
- [references/examples.md](references/examples.md) — Working data examples for publish, load, and cross-application workflows
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do, with explanations

### Official Sources

- https://docs.speckle.systems/connectors/autocad.md
- https://docs.speckle.systems/connectors/civil3d.md
- https://docs.speckle.systems/developers/data-schema/connectors/autocad-schema.md
- https://docs.speckle.systems/developers/data-schema/connectors/civil3d-schema.md
- https://docs.speckle.systems/developers/data-schema/object-schema.md
- https://docs.speckle.systems/developers/data-schema/proxy-schema.md
