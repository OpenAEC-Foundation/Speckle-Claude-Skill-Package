# Conversion Methods Reference

## displayValue Structure

Every DataObject uses `displayValue` to carry renderable geometry. This is the ONLY geometry field that ALL connectors can consume.

### Schema

```json
{
  "displayValue": [
    {
      "speckle_type": "Objects.Geometry.Mesh",
      "vertices": [x0, y0, z0, x1, y1, z1, ...],
      "faces": [n, i0, i1, ..., in],
      "colors": [argb0, argb1, ...],
      "units": "m"
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `vertices` | `number[]` | Yes | Flat array of vertex coordinates (x, y, z triples) |
| `faces` | `number[]` | Yes | Face definitions: first number is vertex count (3=tri, 4=quad), followed by vertex indices |
| `colors` | `number[]` | No | Per-vertex ARGB colors as 32-bit integers |
| `textureCoordinates` | `number[]` | No | UV coordinates (NOT transferred by any connector) |
| `units` | `string` | Yes | Measurement unit for vertex coordinates |

### Face Array Encoding

The `faces` array uses a prefix encoding:

```
[3, 0, 1, 2]           → Triangle with vertices 0, 1, 2
[4, 0, 1, 2, 3]        → Quad with vertices 0, 1, 2, 3
[3, 0, 1, 2, 3, 2, 3, 4]  → Triangle + triangle
```

ALWAYS use triangles (prefix 3) for maximum compatibility. Some receivers do not support quads.

---

## Proxy Resolution Methods

### RenderMaterial Proxy

```json
{
  "speckle_type": "Objects.Other.RenderMaterialProxy",
  "applicationId": "mat-concrete-01",
  "name": "Concrete",
  "value": {
    "diffuse": 4289374890,
    "opacity": 1.0,
    "metalness": 0.0,
    "roughness": 0.8
  },
  "objects": ["elem-001", "elem-002", "elem-003"]
}
```

**Resolution**: The connector iterates `objects`, finds elements with matching `applicationId`, and applies the material defined in `value`.

### Level Proxy (Revit/Archicad only)

```json
{
  "speckle_type": "Objects.BuiltElements.LevelProxy",
  "applicationId": "level-01",
  "name": "Level 1",
  "value": {
    "elevation": 0.0,
    "units": "m"
  },
  "objects": ["elem-001", "elem-005"]
}
```

**Resolution**: Objects are associated with building levels. On receive, the connector uses this to place objects in the correct floor context.

### Definition Proxy (Block/Component)

```json
{
  "speckle_type": "Objects.Other.DefinitionProxy",
  "applicationId": "block-def-A",
  "name": "Chair",
  "value": {
    "displayValue": [{ "speckle_type": "Objects.Geometry.Mesh", "...": "..." }]
  },
  "objects": ["inst-001", "inst-002"]
}
```

**Resolution**: Instance objects reference `definitionId` matching the proxy's `applicationId`. The proxy stores geometry once; instances provide transform matrices for placement.

### Group Proxy

```json
{
  "speckle_type": "Objects.Other.GroupProxy",
  "applicationId": "group-structural",
  "name": "Structural Elements",
  "value": null,
  "objects": ["elem-001", "elem-007", "elem-012"]
}
```

**Resolution**: Groups organize objects logically. Objects can belong to multiple groups simultaneously.

### Color Proxy (CAD connectors only)

```json
{
  "speckle_type": "Objects.Other.ColorProxy",
  "applicationId": "color-red",
  "name": "Red",
  "value": "#FF0000",
  "objects": ["elem-003", "elem-004"]
}
```

**Resolution**: Applies simple color assignments. Used by AutoCAD and Civil 3D connectors.

---

## Unit Conversion Methods

### Supported Unit Strings

| String | Unit | To Meters Factor |
|--------|------|:----------------:|
| `"m"` | Meters | 1.0 |
| `"mm"` | Millimeters | 0.001 |
| `"cm"` | Centimeters | 0.01 |
| `"ft"` | Feet | 0.3048 |
| `"in"` | Inches | 0.0254 |
| `"yd"` | Yards | 0.9144 |
| `"km"` | Kilometers | 1000.0 |

### Conversion Formula

```
target_value = source_value * (source_to_meters / target_to_meters)
```

Example: Convert 1000mm to feet:
```
1000 * (0.001 / 0.3048) = 3.2808 ft
```

Unit conversion is automatic in the connector pipeline. Manual conversion is ONLY needed when accessing raw vertex data via the GraphQL API or SpecklePy.

---

## Connector Conversion Entry Points

### SpecklePy — Manual Conversion

```python
from specklepy.objects.geometry import Mesh, Point, Line
from specklepy.objects import Base

# Create a mesh for displayValue
mesh = Mesh()
mesh.vertices = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]
mesh.faces = [4, 0, 1, 2, 3]
mesh.units = "m"

# Create a DataObject with displayValue
obj = Base()
obj.speckle_type = "Objects.Data.DataObject"
obj.displayValue = [mesh]
obj.properties = {"category": "Walls", "height": 3.0}
obj.units = "m"
```

### GraphQL — Query Object with displayValue

```graphql
query {
  stream(id: "stream-id") {
    object(id: "object-id") {
      data
      children(limit: 100) {
        objects {
          data
        }
      }
    }
  }
}
```

The `data` field returns the full JSON object including `displayValue`, `properties`, `units`, and all other fields. Parse this to diagnose conversion issues.

---

## Revit Reference Point Transform

Revit objects carry a `referencePointTransform` field — a 4x4 transformation matrix encoding the offset between the chosen reference point (Internal Origin, Project Base, Survey Point) and the object's position.

```json
{
  "referencePointTransform": [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    10.5, 20.3, 0, 1
  ]
}
```

The last row (10.5, 20.3, 0) represents the translation offset. When loading into another application, this transform MUST be applied to position objects correctly. Misapplication or ignoring this matrix is the primary cause of positioning errors in federated models.
