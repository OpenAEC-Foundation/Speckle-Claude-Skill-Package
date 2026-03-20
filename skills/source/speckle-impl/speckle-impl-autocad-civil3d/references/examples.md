# Working Data Examples (AutoCAD / Civil 3D)

## Example 1: AutoCAD Line with Extension Dictionary

A simple line object published from AutoCAD with custom data attached via Extension Dictionary:

```json
{
  "id": "a1b2c3d4e5f6",
  "speckle_type": "Objects.Geometry.Line",
  "applicationId": "1A3F",
  "units": "mm",
  "start": {
    "speckle_type": "Objects.Geometry.Point",
    "x": 0.0,
    "y": 0.0,
    "z": 0.0,
    "units": "mm"
  },
  "end": {
    "speckle_type": "Objects.Geometry.Point",
    "x": 5000.0,
    "y": 0.0,
    "z": 0.0,
    "units": "mm"
  },
  "properties": {
    "ExtensionDictionary": {
      "ProjectData": {
        "ProjectCode": "P-2024-001",
        "Phase": "Construction",
        "Grid": "A1"
      }
    }
  }
}
```

**Key points:**
- `applicationId` "1A3F" is the AutoCAD Handle — stable across saves
- Extension Dictionary data is nested under the dictionary name "ProjectData"
- All coordinates use the `units` specified at the object level

---

## Example 2: 3D Solid Published as Mesh

A 3D solid in AutoCAD (e.g., a concrete column) ALWAYS converts to Mesh on publish:

```json
{
  "id": "f7e8d9c0b1a2",
  "speckle_type": "Objects.Geometry.Mesh",
  "applicationId": "2B7C",
  "units": "mm",
  "vertices": [
    0.0, 0.0, 0.0,
    300.0, 0.0, 0.0,
    300.0, 300.0, 0.0,
    0.0, 300.0, 0.0,
    0.0, 0.0, 3000.0,
    300.0, 0.0, 3000.0,
    300.0, 300.0, 3000.0,
    0.0, 300.0, 3000.0
  ],
  "faces": [
    4, 0, 1, 2, 3,
    4, 4, 5, 6, 7,
    4, 0, 1, 5, 4,
    4, 1, 2, 6, 5,
    4, 2, 3, 7, 6,
    4, 3, 0, 4, 7
  ],
  "colors": [],
  "properties": {
    "XData": {
      "STRUCTURAL": {
        "values": ["Column", "C-01", 300.0, 300.0, 3000.0]
      }
    }
  }
}
```

**Key points:**
- The original solid is gone — only mesh remains
- `vertices` is a flat array: every 3 numbers = one vertex (x, y, z)
- `faces` uses prefix encoding: `4` means quad (4 vertex indices follow)
- XData from the original solid is preserved in `properties`
- No way to recover the original solid from this mesh

---

## Example 3: Block Reference (Instance + Definition)

A block reference in AutoCAD splits into an Instance object and a Definition proxy:

**Instance Object (the block insert):**
```json
{
  "speckle_type": "Objects.Data.InstanceObject",
  "applicationId": "3D9E",
  "definitionId": "4F0A",
  "transform": [
    1.0, 0.0, 0.0, 15000.0,
    0.0, 1.0, 0.0, 8000.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
  ],
  "units": "mm"
}
```

**Definition Proxy (at Root Collection):**
```json
{
  "speckle_type": "Objects.Data.DefinitionProxy",
  "applicationId": "4F0A",
  "name": "CHAIR_OFFICE",
  "objects": ["3D9E", "5G1B", "6H2C"],
  "value": {
    "displayValue": [
      {
        "speckle_type": "Objects.Geometry.Mesh",
        "vertices": [0, 0, 0, 500, 0, 0, 500, 500, 0, 0, 500, 0],
        "faces": [4, 0, 1, 2, 3],
        "units": "mm"
      }
    ]
  }
}
```

**Key points:**
- `definitionId` on the Instance matches `applicationId` on the Definition
- The transform matrix places the block at position (15000, 8000, 0)
- Three instances ("3D9E", "5G1B", "6H2C") share the same definition
- Definition geometry is stored ONCE, referenced by all instances

---

## Example 4: Civil 3D Alignment

A horizontal alignment from Civil 3D with Property Sets:

```json
{
  "speckle_type": "Objects.Data.DataObject:Objects.Data.Civil3dObject",
  "applicationId": "7I3D",
  "type": "Alignment",
  "displayValue": [
    {
      "speckle_type": "Objects.Geometry.Mesh",
      "vertices": [0, 0, 0, 100, 0, 0, 100, 5, 0, 0, 5, 0],
      "faces": [4, 0, 1, 2, 3],
      "units": "m"
    }
  ],
  "baseCurves": [
    {
      "speckle_type": "Objects.Geometry.Polycurve",
      "segments": [
        {
          "speckle_type": "Objects.Geometry.Line",
          "start": { "x": 0, "y": 0, "z": 0 },
          "end": { "x": 50, "y": 0, "z": 0 }
        },
        {
          "speckle_type": "Objects.Geometry.Arc",
          "startPoint": { "x": 50, "y": 0, "z": 0 },
          "midPoint": { "x": 65, "y": 10, "z": 0 },
          "endPoint": { "x": 80, "y": 20, "z": 0 },
          "radius": 50.0
        },
        {
          "speckle_type": "Objects.Geometry.Line",
          "start": { "x": 80, "y": 20, "z": 0 },
          "end": { "x": 130, "y": 20, "z": 0 }
        }
      ],
      "units": "m"
    }
  ],
  "properties": {
    "PropertySets": {
      "Alignment Properties": {
        "Name": "Main Road CL",
        "StartStation": 0.0,
        "EndStation": 145.5,
        "Length": 145.5,
        "DesignSpeed": 80
      }
    }
  },
  "units": "m"
}
```

**Key points:**
- `displayValue` contains a flat mesh ribbon for VISUAL display
- `baseCurves` contains the ACTUAL alignment geometry (tangent-arc-tangent)
- ALWAYS use `baseCurves` for geometric analysis, NOT `displayValue`
- Property Sets provide design parameters organized by set name

---

## Example 5: Civil 3D Pipe Network Element

A pipe from a storm drainage network:

```json
{
  "speckle_type": "Objects.Data.DataObject:Objects.Data.Civil3dObject",
  "applicationId": "8J4E",
  "type": "Pipe",
  "displayValue": [
    {
      "speckle_type": "Objects.Geometry.Mesh",
      "vertices": [0, 0, -2, 50, 0, -2.5, 50, 0.15, -2.5, 0, 0.15, -2],
      "faces": [4, 0, 1, 2, 3],
      "units": "m"
    }
  ],
  "baseCurves": [
    {
      "speckle_type": "Objects.Geometry.Line",
      "start": { "x": 0, "y": 0, "z": -2.0 },
      "end": { "x": 50, "y": 0, "z": -2.5 },
      "units": "m"
    }
  ],
  "properties": {
    "PropertySets": {
      "Pipe Properties": {
        "InnerDiameter": 0.3,
        "OuterDiameter": 0.35,
        "Material": "PVC",
        "SlopePercent": 1.0,
        "FlowDirection": "StartToEnd"
      }
    },
    "PartData": {
      "PartDescription": "300mm PVC Pipe",
      "PartFamily": "Storm Drain Pipe",
      "WallThickness": 0.025
    }
  },
  "units": "m"
}
```

**Key points:**
- `baseCurves` contains the pipe centerline
- `PropertySets` and `PartData` are separate sections within `properties`
- Part data contains catalogue-level information from the Civil 3D parts list

---

## Example 6: AutoCAD Hatch Object

A cross-hatched area published from AutoCAD:

```json
{
  "speckle_type": "Objects.Geometry.Hatch",
  "applicationId": "9K5F",
  "pattern": "ANSI31",
  "scale": 1.0,
  "rotation": 45.0,
  "loops": [
    {
      "type": "Outer",
      "curve": {
        "speckle_type": "Objects.Geometry.Polyline",
        "value": [0, 0, 0, 1000, 0, 0, 1000, 1000, 0, 0, 1000, 0],
        "closed": true,
        "units": "mm"
      }
    }
  ],
  "units": "mm"
}
```

---

## Example 7: Layer Structure as Collections

How AutoCAD layers map to Speckle Collections in the published data:

```
Root Collection: "Drawing.dwg"
├── Collection: "A-WALL"
│   ├── Line (applicationId: "1A3F")
│   ├── Polyline (applicationId: "2B4G")
│   └── Mesh (applicationId: "3C5H")  ← was a 3D solid
├── Collection: "S-BEAM"
│   ├── Mesh (applicationId: "4D6I")
│   └── Mesh (applicationId: "5E7J")
├── Collection: "C-ROAD"
│   └── Civil3dObject (applicationId: "6F8K")  ← alignment
├── [Proxies at Root Level]
│   ├── Color Proxy: #FF0000 → objects: ["1A3F", "2B4G"]
│   ├── RenderMaterial Proxy: "Steel" → objects: ["4D6I", "5E7J"]
│   ├── Definition Proxy: "CHAIR_OFFICE" → objects: ["7G9L"]
│   └── PropertySetDefinition Proxy: "Pipe Properties" → objects: ["8H0M"]
```

**Key points:**
- Each AutoCAD layer becomes a Speckle Collection
- Proxies are ALWAYS at the Root Collection level, never nested in layer collections
- Objects reference proxies via `applicationId`, proxies reference objects in their `objects` array

---

## Example 8: Cross-Application Workflow — Civil 3D to Grasshopper

When loading a Civil 3D alignment in Grasshopper:

1. Use **Load** component with the model URL
2. Use **Query Objects** to get all objects
3. Civil3dObject arrives as a Data Object in Grasshopper
4. Use **Deconstruct** to access fields:

```
Input: Civil3dObject (Data Object)

Deconstruct outputs:
  - type: "Alignment"
  - displayValue: [Mesh]  ← visual geometry, castable to Mesh
  - baseCurves: [Polycurve]  ← design geometry, castable to Curve
  - properties: Record
    └── PropertySets: Record
        └── "Alignment Properties": Record
            ├── StartStation: 0.0
            ├── EndStation: 145.5
            └── Length: 145.5
```

ALWAYS cast `baseCurves` to Curve for geometric operations. Casting `displayValue` gives you a mesh ribbon, which is NOT useful for alignment-based design.
