# Working Examples (Rhino/Grasshopper Connector)

## Example 1: Publish Geometry with Properties from Grasshopper

**Goal**: Publish a set of building columns with structural properties to Speckle.

### Grasshopper Definition Layout

```
[Brep Param: columns] → [Speckle Geometry Passthrough] → [Create Collection] → [Publish]
                              ↑                                ↑
                    [Create Properties]              [Speckle Model URL]
                    Keys: "material", "height", "load_kn"
                    Values: "S355", 3.5, 450
```

### Step-by-Step

1. **Authenticate**: Place Sign-In component, connect to your Speckle account.
2. **Select model**: Place Speckle Model URL, pick project and model.
3. **Create properties**: Use Create Properties with keys `"material"`, `"height"`, `"load_kn"` and values `"S355"`, `3.5`, `450`.
4. **Wrap geometry**: Connect Brep geometry + properties to Speckle Geometry Passthrough. Set Name to `"Column"`.
5. **Organize**: Connect wrapped objects to Create Collection with name `"Structure | Columns"`.
6. **Publish**: Connect Collection + Model URL to Publish component.

### Result on Server

```
Root Collection
  └── Structure
        └── Columns
              ├── Column (Brep, properties: {material: "S355", height: 3.5, load_kn: 450})
              ├── Column (Brep, properties: {material: "S355", height: 3.5, load_kn: 450})
              └── ...
```

---

## Example 2: Load and Filter Objects from Speckle

**Goal**: Load a Revit model and extract only wall geometry.

### Grasshopper Definition Layout

```
[Speckle Model URL] → [Load] → [Query Objects] → [Filter Objects (by Name: "Wall")] → [Matched]
```

### Step-by-Step

1. **Load model**: Connect Speckle Model URL to Load component.
2. **Query**: Connect Load output to Query Objects. Use the "All Objects" output.
3. **Filter**: Connect to Filter Objects. Right-click to set mode "By Name". Enter filter `"Wall"`.
4. **Use geometry**: The Matched output contains all wall Data Objects. Cast to Mesh or Brep for geometric operations.

### Working with Filtered Data Objects

```
[Matched walls] → [Deconstruct] → Keys: ["type", "family", "category", "level", ...]
                                   Values: ["Basic Wall - 200mm", "Basic Wall", "Walls", "Level 1", ...]
```

ALWAYS use Deconstruct to inspect Data Object fields before assuming property structure.

---

## Example 3: Block Workflow in Grasshopper

**Goal**: Create a tree block definition and place 10 instances along a curve.

### Grasshopper Definition Layout

```
[Tree geometry] → [Block Definition Passthrough] → definition
                       name: "Tree_Maple"                ↓
[Curve] → [Divide Curve (10)] → [Plane to Transform] → [Block Instance Passthrough] → [Create Collection] → [Publish]
```

### Step-by-Step

1. **Create definition**: Connect tree geometry (list of meshes/breps) to Block Definition Passthrough. Name: `"Tree_Maple"`.
2. **Generate transforms**: Divide a placement curve into 10 points. Convert each point/plane to a 4x4 transform matrix.
3. **Create instances**: Connect the definition + each transform to Block Instance Passthrough. This produces 10 instances.
4. **Organize and publish**: Collect instances into a Collection named `"Landscape | Trees"` and publish.

### Result on Server

```
Root Collection
  └── Landscape
        └── Trees
              ├── Instance (definitionId: "Tree_Maple", transform: [1,0,0,x1, ...])
              ├── Instance (definitionId: "Tree_Maple", transform: [1,0,0,x2, ...])
              └── ... (10 instances, 1 definition stored once)
```

---

## Example 4: Round-Trip with Change Tracking

**Goal**: Publish a parametric facade from Grasshopper, then update panel sizes while preserving change tracking.

### Initial Publish

```
[Panel geometry] → [Speckle Geometry Passthrough] → [Create Collection: "Facade | Panels"] → [Publish]
                         name: "Panel_001", "Panel_002", ...
```

### Update with Change Tracking

```
[Speckle Model URL] → [Load] → [Query Objects] → [Filter: "Panel"] → loaded panels
                                                                            ↓
[New geometry] → [Speckle Geometry Passthrough (with loaded panel as input)] → [Create Collection] → [Publish]
```

### Critical Steps

1. **First publish**: Create and publish panels normally.
2. **Reload**: Use Load to fetch the published model.
3. **Filter**: Extract the panel objects using Filter Objects.
4. **Mutate via passthrough**: Feed loaded panels into Speckle Geometry Passthrough as the Geometry input. Update properties or attach new geometry. This preserves `applicationId`.
5. **Re-publish**: The server recognizes updated objects (same `applicationId`, new `id`) and creates a proper version diff.

NEVER create new objects for updates — ALWAYS mutate loaded objects via passthrough nodes.

---

## Example 5: Publish from Rhino with Layer Filtering

**Goal**: Publish only the structural layers from a Rhino model.

### Rhino Workflow

1. Open the Speckle connector panel in Rhino.
2. Sign in to your Speckle account.
3. Select the target project and model.
4. In the **Layer filter** field, type the layer name pattern (e.g., `"Structure"`).
5. Click **Publish**. Only objects on matching layers are sent.

### Result on Server

```
Root Collection
  └── Structure
        ├── Beams (sublayer with beam geometry)
        ├── Columns (sublayer with column geometry)
        └── Foundations (sublayer with foundation geometry)
```

Layer hierarchy is preserved as nested Collections.

---

## Example 6: Loading a Revit Model into Rhino

**Goal**: Receive a Revit architectural model in Rhino for coordination.

### Rhino Workflow

1. Open the Speckle connector panel in Rhino.
2. Select the project and model containing the Revit data.
3. Click **Load** (latest version by default).
4. Objects appear as Rhino geometry organized by the Revit hierarchy:

```
Layers in Rhino:
  └── Revit_File
        └── Level 1
              ├── Walls
              │     └── (Mesh/Brep geometry with user strings: type, family, category, parameters)
              ├── Floors
              └── Doors
```

### Accessing Revit Properties in Rhino

After loading, select any object and open the **Properties** panel > **User Strings** tab:

```
User strings on a loaded wall:
  type:         "Basic Wall - 200mm"
  family:       "Basic Wall"
  category:     "Walls"
  level:        "Level 1"
  area:         "25.5"
  volume:       "5.1"
  material:     "Concrete"
```

All Revit instance and type parameters appear as user strings in Rhino.

---

## Example 7: Multi-Collection Grasshopper Publish

**Goal**: Publish architecture and landscape in separate collections from a single Grasshopper definition.

### Grasshopper Definition Layout

```
[Building geometry] → [Create Collection: "Architecture | Building"]  ─┐
[Road geometry]     → [Create Collection: "Landscape | Roads"]        ─┤→ [Create Collection: "Site Model"] → [Publish]
[Tree instances]    → [Create Collection: "Landscape | Vegetation"]   ─┘
```

### Result on Server

```
Root Collection
  └── Site Model
        ├── Architecture
        │     └── Building (geometry objects)
        ├── Landscape
              ├── Roads (geometry objects)
              └── Vegetation (block instances)
```

ALWAYS organize data into meaningful collections before publishing. Flat lists of objects without collection structure make collaboration difficult.
