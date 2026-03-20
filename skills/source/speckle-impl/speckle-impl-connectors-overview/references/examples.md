# examples.md — Cross-Tool Workflow Examples

## Example 1: Revit to Grasshopper Parametric Analysis

### Workflow

1. Architect publishes Revit model to Speckle
2. Structural engineer loads model in Grasshopper
3. Engineer performs parametric analysis on structural elements
4. Engineer publishes modified geometry back to Speckle
5. Architect loads result in Revit as Direct Shapes

### Data Flow

```
Revit (Publish)
  |
  +--> RevitObject {
  |      type: "Basic Wall - 200mm",
  |      category: "Walls",
  |      level: "Level 1",
  |      displayValue: [Mesh(vertices, faces)],
  |      properties: { "Width": 200, "Height": 3000 },
  |      applicationId: "1234567"
  |    }
  |
  v
Speckle Server (stores full RevitObject with all metadata)
  |
  v
Grasshopper (Load via Load + Query Objects)
  |
  +--> Data Object (geometry + properties as user strings)
  |    Cast to Mesh for geometric operations
  |    Access properties via Deconstruct component
  |
  v
Grasshopper (Modify + Publish via Create Collection + Publish)
  |
  +--> Geometry Object or Data Object
  |    (original RevitObject metadata NOT preserved unless using passthrough)
  |
  v
Speckle Server
  |
  v
Revit (Load)
  |
  +--> Direct Shape (generic model)
       Category: default
       NO native wall parameters
       NO type information
```

### Key Points

- Properties flow downstream but NEVER reconstruct native elements upstream
- Use Grasshopper passthrough nodes to preserve `applicationId` for change tracking
- The return trip to Revit ALWAYS produces Direct Shapes

---

## Example 2: Multi-Discipline Federation in Power BI

### Workflow

1. Architect publishes from Revit (structural model)
2. MEP engineer publishes from Revit (mechanical model)
3. Landscape designer publishes from Rhino (site model)
4. Project manager creates federated view in Power BI

### Power BI Data Loading

```
-- Load architectural model
let
    Source = Speckle.GetObjects("https://app.speckle.systems", "project-id", "model-id-arch"),
    Properties = Speckle.Objects.Properties(Source)
in
    Properties

-- Load MEP model
let
    Source = Speckle.GetObjects("https://app.speckle.systems", "project-id", "model-id-mep"),
    Properties = Speckle.Objects.Properties(Source)
in
    Properties

-- Federate models for 3D viewer
let
    Federated = Speckle.Models.Federate({ArchModel, MEPModel, SiteModel})
in
    Federated
```

### Key Points

- Power BI is read-only -- it NEVER publishes data back
- `Speckle.Objects.Properties` flattens nested property structures
- `Speckle.Models.Federate` combines multiple models for the 3D Viewer Visual
- Data Gateway required ONLY for scheduled refresh in Power BI Service

---

## Example 3: Rhino Block Definitions to AutoCAD

### Data Flow

```
Rhino (Publish)
  |
  +--> Definition Proxy {
  |      name: "Window_Type_A",
  |      applicationId: "def-guid-001",
  |      displayValue: [Mesh(window geometry)],
  |      objects: ["inst-001", "inst-002", "inst-003"]
  |    }
  |
  +--> Instance Object {
  |      definitionId: "def-guid-001",
  |      transform: [1,0,0,0, 0,1,0,0, 0,0,1,0, 5000,0,3000,1],
  |      applicationId: "inst-001"
  |    }
  |
  v
Speckle Server
  |
  v
AutoCAD (Load)
  |
  +--> Block Definition "Window_Type_A"
  +--> Block Reference at position (5000, 0, 3000)
       with identity rotation
```

### Key Points

- Definition geometry is stored ONCE and referenced by multiple Instances
- The 4x4 transform matrix encodes position, rotation, and scale
- AutoCAD correctly reconstructs block definitions and references from Definition/Instance proxies
- Colors applied via Color proxy (hex), materials via RenderMaterial proxy

---

## Example 4: Grasshopper Collection Hierarchy

### Creating Organized Collections

```
Grasshopper Component Chain:

[Geometry] --> [Create Properties] --> [Speckle Geometry Passthrough]
                                              |
                                              v
                                    [Create Collection] (name: "Walls")
                                              |
                                              v
                                    [Create Collection] (name: "Level 1")
                                              |
                                              v
                                    [Publish] + [Speckle Model URL]
```

### Result in Speckle

```
Root Collection
  └── Level 1 (Collection)
       └── Walls (Collection)
            ├── Wall_001 (Geometry Object with properties)
            ├── Wall_002 (Geometry Object with properties)
            └── Wall_003 (Geometry Object with properties)
```

### Key Points

- Collections nest via connecting output of one Create Collection to input of another
- The Speckle Model URL component requires Sign-In first
- Nested collection names can use TAB+pipe syntax for auto-naming
- Empty inputs are ALWAYS excluded from published collections

---

## Example 5: Tekla to Speckle for QA Review

### Workflow

1. Structural engineer publishes Tekla model
2. QA reviewer inspects in Speckle web viewer
3. Data analyst extracts quantities in Power BI

### Published Data Structure

```
Root Collection
  └── Tekla File (Collection)
       ├── Beam (Collection)
       │    ├── TeklaObject {
       │    │    type: "Beam",
       │    │    displayValue: [Brep(beam geometry)],
       │    │    properties: {
       │    │      Report: {
       │    │        PROFILE: "HEA300",
       │    │        MATERIAL: "S355",
       │    │        LENGTH: 6000,
       │    │        WEIGHT: 532.4,
       │    │        PART_POS: "B1"
       │    │      }
       │    │    }
       │    │  }
       │    └── ...
       └── Column (Collection)
            └── ...
```

### Key Points

- Tekla is publish-only -- there is NO load/receive capability
- ALL Tekla metadata is confined to `properties.Report`
- ALWAYS publish from model viewport -- drawing views are NOT supported
- Assemblies, drawings, and numbering series are NOT published

---

## Example 6: Archicad to Revit Coordination

### Data Flow

```
Archicad (Publish)
  |
  +--> ArchicadObject {
  |      type: "Wall",
  |      level: "Ground Floor",
  |      location: Point(0, 0, 0),
  |      displayValue: [Mesh(wall geometry)],
  |      properties: {
  |        "IFC": { "Pset_WallCommon": { "IsExternal": true, "LoadBearing": true } },
  |        "Classifications": { "IFC Type": "IfcWall", "IFC Category": "IfcWallStandardCase" },
  |        "Volume": 2.4,
  |        "Area": 12.0
  |      }
  |    }
  |
  v
Speckle Server
  |
  v
Revit (Load)
  |
  +--> Direct Shape (generic model)
       Default category
       NO IFC properties attached to Revit element
       NO custom property import
       Mesh geometry only
```

### Key Points

- Archicad exports rich IFC classifications and property sets
- On load in Revit, ALL custom properties are lost -- they exist only in Speckle's data model
- Reference point misalignment between Archicad and Revit causes positioning errors
- Floor plan views in Archicad show only cut lines at cut plane, NO projection lines

---

## Example 7: Blender Visualization Workflow

### Supported Material Pipeline

```
Blender (Publish with supported shaders)
  |
  +--> Principled BSDF --> Full material properties transfer
  +--> Diffuse BSDF     --> Color and basic properties transfer
  +--> Emission          --> Emission color transfer
  +--> Glass BSDF        --> Transparency properties transfer
  |
  +--> Any other shader  --> Falls back to basic material attributes
  |
  v
Speckle Server
  |
  v
Any Connector (Load)
  |
  +--> RenderMaterial applied with color, opacity, metalness, roughness
       NO textures -- texture UV mapping does NOT survive the pipeline
```

### Key Points

- ALWAYS use one of the four supported shader types for predictable material transfer
- Apply Modifiers setting must be enabled to publish geometry with modifiers baked in
- Block loading options: collection instances (default) or linked duplicates
- Material modifications on loaded objects persist across version updates
- NO camera, light, or texture support in Blender connector

---

## Example 8: Civil 3D Property Sets

### Published Data with Property Sets

```
Civil3dObject {
  type: "Pipe",
  displayValue: [Mesh(pipe geometry)],
  baseCurves: [Line(pipe centerline)],
  properties: {
    "Pipe Properties": {
      "Inner Diameter": 300,
      "Outer Diameter": 350,
      "Material": "Concrete",
      "Slope": 0.02
    },
    "Part Data": {
      "Domain": "Pipe",
      "Part Family": "Concrete Pipe",
      "Part Size": "300mm"
    }
  }
}
```

### Key Points

- `baseCurves` contains the fundamental curve geometry, DISTINCT from `displayValue`
- Property sets are organized by name in the `properties` dictionary
- Civil 3D extends AutoCAD -- ALL AutoCAD geometry types are supported
- Solids are ALWAYS converted to Mesh (irreversible)
- PropertySetDefinition proxy encodes property set structures (unique to Civil 3D)
- No reference point publishing option -- no coordinate alignment controls
