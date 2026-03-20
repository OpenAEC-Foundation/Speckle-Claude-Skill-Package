# methods.md — Connector API Methods and Structures

## Conversion Pipeline Methods

### ToSpeckle Conversion (Publish)

Every connector implements this conversion flow:

```
ConvertToSpeckle(nativeObject) -> Base
```

| Step | Input | Output | Description |
|------|-------|--------|-------------|
| Selection | User interaction | Native object list | Manual, view-based, category-based, or all-visible selection |
| Conversion | Native object | Speckle Base Object | Maps native properties to `properties`, geometry to `displayValue` |
| Proxy extraction | Collection of Base Objects | Proxy objects at root | Extracts shared resources (materials, levels, groups, definitions, colors) |
| Transport | Serialized objects | Server response | Sends to configured Speckle server |

### ToHost Conversion (Load/Receive)

```
ConvertToHost(speckleObject) -> NativeObject
```

| Step | Input | Output | Description |
|------|-------|--------|-------------|
| Fetch | Server URL + version ID | Speckle object tree | Downloads from server |
| Conversion | Speckle Base Object | Native application object | Attempts native reconstruction, falls back to generic |
| Proxy resolution | Proxy references | Applied materials/levels/groups | Resolves `applicationId` references to shared resources |
| Placement | Converted objects | Scene insertion | Places objects in host application document |

---

## Object Schema Structures

### Base Object (All Objects)

```
Base {
  id: string               // Content-based SHA256 hash
  applicationId: string    // Source application identifier (stable)
  speckle_type: string     // Type discriminator
  units: string            // "m" | "mm" | "cm" | "ft" | "in" | "yd"
}
```

### DataObject (BIM Elements)

```
DataObject extends Base {
  displayValue: Base[]     // Array of interoperable geometry (Mesh, Line, Point)
  properties: object       // Metadata dictionary (key-value pairs)
}
```

### RevitObject

```
RevitObject extends DataObject {
  type: string                    // Element type name (e.g., "Basic Wall - 200mm")
  family: string                  // Family classification
  category: string                // Revit category (Walls, Doors, Windows)
  level: string                   // Associated building level
  location: Point | Curve         // Element position geometry
  referencePointTransform: float[16]  // 4x4 matrix from reference point settings
  views: Camera[]                 // Saved 3D perspective views
}
```

### ArchicadObject

```
ArchicadObject extends DataObject {
  type: string                    // Element category name
  level: string                   // Floor/level association
  location: Point | Curve         // Placement geometry
}
```

### Civil3dObject

```
Civil3dObject extends DataObject {
  type: string                    // Entity type designation
  baseCurves: Curve[]             // Fundamental curves (distinct from displayValue)
}
```

### TeklaObject

```
TeklaObject extends DataObject {
  type: string                    // Element category (Beam, Column, Plate)
  properties.Report: object       // Aggregated Tekla report data
}
```

### Instance Object

```
InstanceObject extends Base {
  definitionId: string            // References a Definition proxy
  transform: float[16]           // 4x4 transformation matrix for placement
}
```

---

## Proxy Structures

### Common Proxy Structure

```
Proxy {
  speckle_type: string            // Proxy category identifier
  applicationId: string           // Stable cross-version identifier
  name: string                    // Human-readable label
  value: object                   // Actual resource data (type-specific)
  objects: string[]               // Array of applicationId strings referencing consumers
}
```

### RenderMaterial Proxy

```
RenderMaterialProxy {
  speckle_type: "Objects.Data.RenderMaterialProxy"
  value: {
    diffuse: int                  // RGB color as integer
    opacity: float                // 0.0 to 1.0
    metalness: float              // 0.0 to 1.0
    roughness: float              // 0.0 to 1.0
  }
}
```

### Level Proxy

```
LevelProxy {
  speckle_type: "Objects.Data.LevelProxy"
  value: {
    elevation: float              // Height value in document units
    name: string                  // Level name (e.g., "Level 1")
  }
}
```

### Group Proxy

```
GroupProxy {
  speckle_type: "Objects.Data.GroupProxy"
  value: null                     // Groups have no resource data
  objects: string[]               // Objects can belong to multiple groups
}
```

### Definition Proxy

```
DefinitionProxy {
  speckle_type: "Objects.Data.DefinitionProxy"
  value: {
    displayValue: Base[]          // Block/component geometry stored once
  }
}
```

### Color Proxy

```
ColorProxy {
  speckle_type: "Objects.Data.ColorProxy"
  value: string                   // Hex color (#RRGGBB)
}
```

### PropertySetDefinition Proxy (Civil 3D Only)

```
PropertySetDefinitionProxy {
  speckle_type: "Objects.Data.PropertySetDefinitionProxy"
  value: object                   // Civil 3D property set structure
}
```

---

## Connector-Specific Publish Settings

### Revit Publish Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Include linked models | On | Linked models appear as separate File collections |
| Reference point | Internal Origin | Options: Internal Origin, Project Base, Survey Point |
| Send Rebars As Volumetric | Off | Exports rebars as solids (performance impact) |

### Rhino Publish Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Layer filtering | None | Selective publish by layer |
| Include visualization properties | Off | Vertex normals, colors, texture coordinates |

### Blender Publish Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Apply Modifiers | Off | Publish with modifiers applied to geometry |

### Archicad Publish Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Property extraction | On | Disable for faster publishing |
| Filter | None | By views or element types |

---

## Connector-Specific Load Settings

### Revit Load Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Receive Blocks as Families | Off | Block instances become families instead of direct shapes |
| Reference point alignment | Internal Origin | Source, Internal Origin, Project Base, Survey Point |

### Blender Load Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Block mode | Collection instances | Options: collection instances, linked duplicates |

---

## Power BI Helper Functions

| Function | Purpose |
|----------|---------|
| `Speckle.Projects.Issues` | Fetch issues from project/model/version |
| `Speckle.Objects.Properties` | Extract object properties (flat access) |
| `Speckle.Objects.CompositeStructure` | Extract layered structures (Revit/Archicad only) |
| `Speckle.Objects.MaterialQuantities` | Access material quantities per object |
| `Speckle.Models.MaterialQuantities` | Expand material quantities across columns |
| `Speckle.Models.Federate` | Manually federate multiple loaded models |
| `Speckle.Utils.ExpandRecord` | Expand record columns into fields |

---

## Proxy Usage by Connector

| Connector | RenderMaterial | Level | Group | Definition | Color | PropertySetDefinition |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Revit | X | X | X | - | - | - |
| Rhino | X | - | X | X | X | - |
| Grasshopper | X | - | X | X | X | - |
| AutoCAD | X | - | X | X | X | - |
| Civil 3D | X | - | X | X | X | X |
| Tekla | X | - | - | - | - | - |
| Archicad | X | - | - | - | - | - |
| Blender | X | - | - | - | - | - |
| SketchUp | X | - | - | - | - | - |

---

## Blender Recognized Shader Types

| Shader | Supported |
|--------|-----------|
| Principled | Yes |
| Diffuse | Yes |
| Emission | Yes |
| Glass | Yes |
| All others | Falls back to basic material attributes |
