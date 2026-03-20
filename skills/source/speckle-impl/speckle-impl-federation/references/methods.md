# methods.md — Federation API Methods and Structures

## Identity Fields

### applicationId

```
Base.applicationId: string | null
```

| Property | Description |
|----------|-------------|
| Type | `string` or `null` |
| Purpose | Stable identifier from the source application for cross-version tracking |
| Assigned by | Source connector during ToSpeckle conversion |
| Used by | Proxy references, change detection, version diffing |

**Source application mapping:**

| Connector | applicationId Source | Example Value |
|-----------|---------------------|---------------|
| Revit | ElementId | `"12345"` |
| Rhino | Object GUID | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| AutoCAD | Handle | `"1A2B"` |
| Civil 3D | Handle | `"3C4D"` |
| Archicad | Element GUID | `"a1b2c3d4-e5f6-..."` |
| Tekla | GUID | `"a1b2c3d4-e5f6-..."` |
| Blender | Object name | `"Cube.001"` |
| SketchUp | Persistent ID | `"42"` |
| Grasshopper | Auto-generated GUID | Changes every solve — UNSTABLE |

### id (Content Hash)

```
Base.id: string
```

| Property | Description |
|----------|-------------|
| Type | `string` |
| Purpose | Content-based hash for deduplication |
| Computed from | All object properties and geometry data |
| Stability | Changes on EVERY modification to any property or geometry |

NEVER use `id` for cross-version tracking. ALWAYS use `applicationId`.

---

## Proxy Structures

### Common Proxy Fields

Every proxy type shares this base structure:

```
Proxy {
  speckle_type: string       // Proxy category identifier
  applicationId: string      // Stable identifier for the proxy itself
  name: string               // Human-readable label
  value: object              // The actual resource data (type varies by proxy)
  objects: string[]           // Array of applicationId strings referencing objects
}
```

### RenderMaterial Proxy

```
RenderMaterial {
  speckle_type: "Objects.Other.RenderMaterialProxy"
  applicationId: string
  name: string                // Material name (e.g., "Brick - Red")
  value: {
    diffuse: int              // ARGB color integer
    opacity: float            // 0.0 (transparent) to 1.0 (opaque)
    metalness: float          // 0.0 to 1.0
    roughness: float          // 0.0 (smooth) to 1.0 (rough)
  }
  objects: string[]           // applicationIds of objects using this material
}
```

Used by: ALL connectors that support materials.

### Level Proxy

```
Level {
  speckle_type: "Objects.BuiltElements.Level"
  applicationId: string
  name: string                // Level name (e.g., "Level 1")
  value: {
    elevation: float          // Height in model units
  }
  objects: string[]           // applicationIds of objects on this level
}
```

Used by: Revit, Archicad (BIM connectors only).

### Group Proxy

```
Group {
  speckle_type: "Objects.Organization.Group"
  applicationId: string
  name: string                // Group name
  value: null                 // Groups have no resource data
  objects: string[]           // applicationIds of grouped objects
}
```

Used by: Revit, Rhino, AutoCAD, Civil 3D.
Note: Objects can belong to multiple groups simultaneously.

### Definition Proxy

```
Definition {
  speckle_type: "Objects.Other.BlockDefinition"
  applicationId: string
  name: string                // Block/component definition name
  value: {
    displayValue: Mesh[]      // Geometry for the definition
  }
  objects: string[]           // applicationIds of instances using this definition
}
```

Used by: Rhino, AutoCAD, Civil 3D, Blender, SketchUp.

### Color Proxy

```
Color {
  speckle_type: "Objects.Other.ColorProxy"
  applicationId: string
  name: string                // Color name or hex value
  value: int                  // ARGB color integer
  objects: string[]           // applicationIds of colored objects
}
```

Used by: AutoCAD, Civil 3D (CAD connectors primarily).

---

## Collection Structure

### Root Collection

```
Collection {
  speckle_type: "Speckle.Core.Models.Collection"
  name: string                // Model name
  elements: Base[]            // Child objects and sub-collections
  collectionType: string      // "model", "layer", "category", etc.
}
```

### Hierarchy Methods

Collections are nested to preserve source application structure:

```
// Revit hierarchy
Collection("Building.rvt", type="model")
  └── Collection("Level 1", type="level")
       └── Collection("Walls", type="category")
            └── Collection("Basic Wall - 200mm", type="type")
                 └── RevitObject(applicationId="12345")

// Rhino hierarchy
Collection("Model.3dm", type="model")
  └── Collection("Architecture", type="layer")
       └── Collection("Facades", type="layer")
            └── Mesh(applicationId="a1b2c3d4-...")
```

---

## DataObject Structure

```
DataObject {
  speckle_type: "Objects.Data.DataObject"
  id: string                  // Content hash
  applicationId: string       // Source application identifier
  units: string               // "m", "mm", "ft", "in"
  displayValue: Geometry[]    // Interoperable primitives (Mesh, Line, Point)
  properties: {               // Metadata dictionary
    [key: string]: any
  }
}
```

### Connector-Specific Extensions

| Type | Extends DataObject With |
|------|------------------------|
| RevitObject | `type`, `family`, `category`, `level`, `location`, `referencePointTransform`, `views` |
| ArchicadObject | `type`, `level`, `location` |
| Civil3dObject | `type`, `baseCurves` |
| TeklaObject | `type`, `properties.Report` |

---

## Instance Object Structure

```
Instance {
  speckle_type: "Objects.Other.Instance"
  applicationId: string
  definitionId: string        // applicationId of the Definition proxy
  transform: float[16]        // 4x4 transformation matrix (row-major)
  units: string
}
```

The `transform` matrix encodes position, rotation, and scale for placing the definition geometry in world space.

---

## Conversion Direction Flags

| Connector | Publish (ToSpeckle) | Load (ToHost) |
|-----------|-------------------|---------------|
| Revit | YES | YES (Direct Shapes only) |
| Rhino | YES | YES (native geometry) |
| Grasshopper | YES | YES (Geometry/Block/Data Objects) |
| Blender | YES | YES (mesh/curves) |
| AutoCAD | YES | YES (geometry) |
| Civil 3D | YES | YES (geometry) |
| Tekla | YES | **NO** |
| Archicad | YES | YES (GDL Objects only) |
| SketchUp | YES | YES (components) |
| Power BI | **NO** | YES (read-only) |

---

## Reference Point Configuration

### Revit Reference Points

```
Publish settings:
  referencePoint: "InternalOrigin" | "ProjectBase" | "SurveyPoint"

Load settings:
  referencePoint: "InternalOrigin" | "ProjectBase" | "SurveyPoint"
```

### referencePointTransform

When publishing from Revit, the `referencePointTransform` field on RevitObject stores a 4x4 matrix encoding the relationship between the chosen reference point and the actual coordinate system. This enables receivers to transform geometry to the correct position.

---

## Power BI Federation Methods

### Speckle.Models.Federate

```
Speckle.Models.Federate(model1, model2, ..., modelN) -> FederatedTable
```

Combines multiple loaded Speckle models into a single dataset for unified analysis and 3D visualization.

### Speckle.Objects.Properties

```
Speckle.Objects.Properties(model) -> PropertiesTable
```

Extracts flattened property tables from nested object structures. Eliminates manual navigation of deeply nested property dictionaries.

### Speckle.Utils.ExpandRecord

```
Speckle.Utils.ExpandRecord(recordColumn) -> ExpandedColumns
```

Expands nested record columns into separate flat columns for Power BI analysis.
