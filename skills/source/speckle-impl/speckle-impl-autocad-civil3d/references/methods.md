# Object Schemas and Property Structures (AutoCAD / Civil 3D)

## AutoCAD Geometry Object Schema

All AutoCAD geometry objects share this base structure:

```json
{
  "id": "<content-hash>",
  "speckle_type": "Objects.Geometry.<Type>",
  "applicationId": "<AutoCAD Handle>",
  "units": "mm",
  "properties": {}
}
```

### Supported Geometry Types

| speckle_type | AutoCAD Source | Fields |
|-------------|---------------|--------|
| `Objects.Geometry.Point` | POINT | `x`, `y`, `z` |
| `Objects.Geometry.Line` | LINE | `start`, `end` (Point objects) |
| `Objects.Geometry.Arc` | ARC | `startPoint`, `midPoint`, `endPoint`, `radius` |
| `Objects.Geometry.Circle` | CIRCLE | `center`, `radius`, `plane` |
| `Objects.Geometry.Ellipse` | ELLIPSE | `center`, `firstRadius`, `secondRadius`, `plane` |
| `Objects.Geometry.Polyline` | LWPOLYLINE / POLYLINE | `value` (flat coordinate array), `closed` |
| `Objects.Geometry.Polycurve` | SPLINE / complex curves | `segments` (array of curve objects) |
| `Objects.Geometry.Mesh` | 3DSOLID / 3DFACE / MESH | `vertices`, `faces`, `colors` |

### Mesh Schema (Solids Conversion Target)

When a 3D solid converts to mesh, the resulting object follows this schema:

```json
{
  "speckle_type": "Objects.Geometry.Mesh",
  "applicationId": "<original solid Handle>",
  "vertices": [x0, y0, z0, x1, y1, z1, ...],
  "faces": [3, i0, i1, i2, 4, i0, i1, i2, i3, ...],
  "colors": [-1, -1, -1, ...],
  "units": "mm"
}
```

The `faces` array uses a prefix encoding: `3` = triangle (3 indices follow), `4` = quad (4 indices follow).

The `vertices` array is a flat list of coordinates: every 3 consecutive numbers form one vertex (x, y, z).

---

## Hatch Object Schema

```json
{
  "speckle_type": "Objects.Geometry.Hatch",
  "applicationId": "<Handle>",
  "pattern": "ANSI31",
  "scale": 1.0,
  "rotation": 0.0,
  "loops": [
    {
      "type": "Outer",
      "curve": { "speckle_type": "Objects.Geometry.Polyline", "...": "..." }
    }
  ],
  "units": "mm"
}
```

---

## Text Object Schema

```json
{
  "speckle_type": "Objects.Other.Text",
  "applicationId": "<Handle>",
  "value": "Text content here",
  "height": 2.5,
  "rotation": 0.0,
  "position": { "speckle_type": "Objects.Geometry.Point", "x": 0, "y": 0, "z": 0 },
  "units": "mm"
}
```

---

## Instance Object Schema (Block References)

```json
{
  "speckle_type": "Objects.Data.InstanceObject",
  "applicationId": "<Insert Handle>",
  "definitionId": "<applicationId of Definition proxy>",
  "transform": [
    1.0, 0.0, 0.0, 10.0,
    0.0, 1.0, 0.0, 20.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
  ],
  "units": "mm"
}
```

The `transform` is a 4x4 matrix in row-major order encoding position, rotation, and scale.

---

## Definition Proxy Schema (Block Definitions)

```json
{
  "speckle_type": "Objects.Data.DefinitionProxy",
  "applicationId": "<Block definition handle>",
  "name": "BlockName",
  "objects": ["1A3", "2B5", "3C7"],
  "value": {
    "displayValue": [
      { "speckle_type": "Objects.Geometry.Mesh", "...": "..." }
    ]
  }
}
```

The `objects` array contains `applicationId` strings of all Instance objects referencing this definition.

---

## Color Proxy Schema

```json
{
  "speckle_type": "Objects.Data.ColorProxy",
  "applicationId": "<generated>",
  "name": "Color-255-0-0",
  "value": "#FF0000",
  "objects": ["1A3", "2B5"]
}
```

---

## RenderMaterial Proxy Schema

```json
{
  "speckle_type": "Objects.Data.RenderMaterialProxy",
  "applicationId": "<generated>",
  "name": "Steel_Brushed",
  "value": {
    "diffuse": "#808080",
    "opacity": 1.0,
    "metalness": 0.8,
    "roughness": 0.4
  },
  "objects": ["3C7", "4D9"]
}
```

---

## Civil3dObject Schema

```json
{
  "speckle_type": "Objects.Data.DataObject:Objects.Data.Civil3dObject",
  "applicationId": "<Handle>",
  "type": "Alignment",
  "displayValue": [
    { "speckle_type": "Objects.Geometry.Mesh", "...": "visual mesh" }
  ],
  "baseCurves": [
    { "speckle_type": "Objects.Geometry.Polycurve", "...": "design curve" }
  ],
  "properties": {
    "ExtensionDictionary": {},
    "XData": {},
    "PropertySets": {
      "Alignment Properties": {
        "StartStation": 0.0,
        "EndStation": 1250.0,
        "Length": 1250.0
      }
    },
    "PartData": {}
  },
  "units": "m"
}
```

### Civil3dObject Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Entity type designation (Alignment, Corridor, Pipe, etc.) |
| `displayValue` | array | Yes | Visual geometry for rendering |
| `baseCurves` | array | No | Fundamental design curves (not all types have these) |
| `properties` | object | Yes | All metadata including PropertySets, PartData, XData |

---

## PropertySetDefinition Proxy Schema (Civil 3D Only)

```json
{
  "speckle_type": "Objects.Data.PropertySetDefinitionProxy",
  "applicationId": "<generated>",
  "name": "Pipe Properties",
  "value": {
    "definitions": [
      { "name": "InnerDiameter", "type": "Real", "default": 0.0 },
      { "name": "OuterDiameter", "type": "Real", "default": 0.0 },
      { "name": "Material", "type": "Text", "default": "" },
      { "name": "SlopePercent", "type": "Real", "default": 0.0 }
    ]
  },
  "objects": ["5E1", "6F2", "7G3"]
}
```

This proxy encodes the SCHEMA of a Property Set — field names, data types, and defaults. The actual values are stored in each Civil3dObject's `properties.PropertySets` dictionary.

---

## Properties Field Structure

The `properties` field for AutoCAD/Civil 3D objects contains up to four sections:

```json
{
  "properties": {
    "ExtensionDictionary": {
      "<DictionaryName>": {
        "<Key>": "<Value>"
      }
    },
    "XData": {
      "<RegisteredAppName>": {
        "values": ["<mixed types>"]
      }
    },
    "PropertySets": {
      "<PropertySetName>": {
        "<FieldName>": "<Value>"
      }
    },
    "PartData": {
      "<PartDataField>": "<Value>"
    }
  }
}
```

| Section | Present In | Description |
|---------|-----------|-------------|
| ExtensionDictionary | AutoCAD + Civil 3D | Named dictionaries with key-value pairs |
| XData | AutoCAD + Civil 3D | Registered application data arrays |
| PropertySets | Civil 3D only | Structured property sets by definition name |
| PartData | Civil 3D only | Entity-specific part information |

---

## Units

| AutoCAD Unit | Speckle `units` Value |
|-------------|----------------------|
| Millimeters | `"mm"` |
| Centimeters | `"cm"` |
| Meters | `"m"` |
| Inches | `"in"` |
| Feet | `"ft"` |

Unit conversion is automatic during the Speckle conversion pipeline. ALWAYS verify the `units` field when processing numerical geometry data.
