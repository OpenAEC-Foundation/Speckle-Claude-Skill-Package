# speckle-impl-revit — Methods Reference

## RevitObject Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Content-based hash. Changes when object data changes. |
| `applicationId` | string | Yes | Revit ElementId. Stable across versions. Used by proxy references. |
| `speckle_type` | string | Yes | `"Objects.Data.DataObject:Objects.Data.RevitObject"` |
| `type` | string | Yes | Element type name (e.g., "Basic Wall - 200mm"). NEVER the Revit TypeId. |
| `family` | string | Yes | Family classification name |
| `category` | string | Yes | Revit category (Walls, Doors, Windows, Floors, etc.) |
| `level` | string | No | Associated building level name |
| `location` | Point/Curve | No | Element placement geometry |
| `referencePointTransform` | float[16] | No | 4x4 transformation matrix from reference point settings |
| `displayValue` | array | Yes | Array of Mesh/Line/Point geometry for visual representation |
| `properties` | dict | Yes | All captured parameters (instance + type + material quantities) |
| `views` | Camera[] | No | 3D perspective view cameras (only on root-level objects) |
| `units` | string | Yes | Measurement unit (typically `"mm"` or `"ft"` depending on Revit project units) |

## Properties Dictionary Structure

The `properties` field contains nested dictionaries organized by parameter group:

```
properties
├── Instance Properties
│   ├── Mark: "W-101"
│   ├── Comments: "Exterior wall"
│   └── ... (all instance parameters)
├── Type Properties
│   ├── Width: 200
│   ├── Function: "Exterior"
│   └── ... (all type parameters)
├── Material Quantities
│   ├── Concrete - Cast-in-Place
│   │   ├── Volume: 2.45
│   │   └── Area: 12.3
│   └── ... (per-material breakdowns)
└── Structural Material Properties
    ├── Density: 2400
    ├── Compressive Strength: 30
    └── ... (where applicable)
```

## Publishing Settings API

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| Include Linked Models | ON / OFF | ON | Linked Revit files published as separate File collections |
| Reference Point | Internal Origin / Project Base / Survey Point | Internal Origin | Coordinate system base for published geometry |
| Send Rebars As Volumetric | ON / OFF | OFF | Rebar export format (curves vs. solids) |

## Receive Settings API

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| Receive Blocks as Families | ON / OFF | OFF | Block instances loaded as Revit families |
| Reference Point | Internal Origin / Project Base / Survey Point | Internal Origin | Coordinate alignment for received geometry |

## RenderMaterial Proxy Fields

| Field | Type | Description |
|-------|------|-------------|
| `speckle_type` | string | Proxy category identifier |
| `applicationId` | string | Stable material identifier |
| `name` | string | Material display name |
| `value.diffuse` | int | RGB color as integer |
| `value.opacity` | float | 0.0 (transparent) to 1.0 (opaque) |
| `value.metalness` | float | Metallic appearance factor |
| `value.roughness` | float | Surface roughness factor |
| `objects` | string[] | Array of `applicationId` values referencing elements using this material |

## Level Proxy Fields

| Field | Type | Description |
|-------|------|-------------|
| `speckle_type` | string | Proxy category identifier |
| `applicationId` | string | Stable level identifier |
| `name` | string | Level name (e.g., "Level 1", "Ground Floor") |
| `value.elevation` | float | Level elevation in project units |
| `objects` | string[] | Array of `applicationId` values referencing elements on this level |

## Group Proxy Fields

| Field | Type | Description |
|-------|------|-------------|
| `speckle_type` | string | Proxy category identifier |
| `applicationId` | string | Stable group identifier |
| `name` | string | Group name |
| `objects` | string[] | Array of `applicationId` values referencing grouped elements |

## Collection Hierarchy Structure

Revit publishes with this EXACT hierarchy:

```
Root Collection
├── [Revit File Name]           (File collection)
│   ├── Level 1                 (Level collection)
│   │   ├── Walls               (Category collection)
│   │   │   ├── Basic Wall      (Type collection)
│   │   │   │   ├── RevitObject (element)
│   │   │   │   └── RevitObject (element)
│   │   │   └── Curtain Wall    (Type collection)
│   │   │       └── RevitObject (element)
│   │   ├── Floors              (Category collection)
│   │   │   └── ...
│   │   └── Doors               (Category collection)
│   │       └── ...
│   └── Level 2                 (Level collection)
│       └── ...
├── [Linked File Name]          (File collection, when linked models enabled)
│   └── ...
├── RenderMaterial proxies      (at root level)
├── Level proxies               (at root level)
└── Group proxies               (at root level)
```

## Coordinate System Transform

The `referencePointTransform` is a 4x4 matrix stored as a 16-element float array in row-major order:

```
[m00, m01, m02, m03,
 m10, m11, m12, m13,
 m20, m21, m22, m23,
 m30, m31, m32, m33]
```

- Elements m03, m13, m23 contain the translation offset
- The rotation submatrix (m00-m22) encodes orientation differences between reference points
- Identity matrix `[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]` means Internal Origin with no offset
