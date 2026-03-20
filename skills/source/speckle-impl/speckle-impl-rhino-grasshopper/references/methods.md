# Component and Method Reference (Rhino/Grasshopper Connector)

## Rhino Connector Operations

### Publish Settings

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| Layer filter | Text field | Empty (all layers) | Restricts publishing to matching layers |
| Include visualization properties | Boolean | Off | Adds vertex normals, colors, texture coordinates |

### Load Settings

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| Version selection | Dropdown | Latest | Load specific version or latest |

### Published Object Properties

Every Rhino object published to Speckle carries:

```
name:           string    — Rhino object name
color:          object    — Display color (RGB)
renderMaterial: object    — Render material reference (via RenderMaterial proxy)
userStrings:    dict      — Key-value pairs from Rhino user strings
units:          string    — Document units ("m", "mm", "ft", "in")
applicationId:  string    — Rhino GUID (stable across versions)
```

---

## Grasshopper Components — Detailed Signatures

### Sign-In

```
Inputs:  (none — opens authentication dialog)
Outputs: Account (Speckle account object)
```

ALWAYS place this component first in any Grasshopper definition that interacts with Speckle.

---

### Speckle Model URL

```
Inputs:  (none — opens project/model selector)
Outputs: Model URL (string — full Speckle model URL)
```

Right-click the component to switch between authenticated accounts.

---

### Create Collection

```
Inputs:
  Name:     string    — Collection name (use TAB+pipe for nesting: "Parent | Child")
  Objects:  list      — Geometry, Block, or Data objects to include
  (repeat input pairs for multiple collections)

Outputs:
  Collection: object  — Hierarchical collection ready for Publish
```

Rules:
- Empty inputs are ALWAYS excluded automatically
- Nested sub-collections use pipe separator: `"Level 1 | Level 2 | Level 3"`
- Maps directly to Rhino layer hierarchy on load

---

### Publish

```
Inputs:
  Collection: object  — From Create Collection component
  Model URL:  string  — From Speckle Model URL component
  Message:    string  — (optional) Version message

Outputs:
  Version URL: string — URL of the published version
```

ALWAYS connect both Collection and Model URL before triggering publish.

---

### Create Properties

```
Inputs:
  Key 1:   string    — Property name
  Value 1: any       — Property value (string, number, boolean, vector, plane, list, nested dict)
  Key 2:   string    — (additional pairs as needed)
  Value 2: any

Outputs:
  Properties: dict   — Property dictionary for attachment to objects
```

Supported value types:
- `string` — Text values
- `number` — Integer or floating-point
- `boolean` — True/False
- `Vector3d` — Grasshopper vector
- `Plane` — Grasshopper plane
- `List` — Array of any supported type
- `dict` — Nested property dictionary (from another Create Properties)

---

### Speckle Properties Passthrough

```
Inputs:
  Object:     object  — Existing Speckle object (loaded or created)
  Properties: dict    — From Create Properties
  Mode:       enum    — Merge (default), Remove, Replace

Outputs:
  Object: object      — Modified object with updated properties
```

Modes:
- **Merge**: Adds new properties, keeps existing. NEVER overwrites existing keys.
- **Remove**: Deletes specified property keys from object.
- **Replace**: Replaces ALL properties with the new dictionary. Destructive.

---

### Load

```
Inputs:
  Model URL: string   — From Speckle Model URL component
  Version:   string   — (optional) Specific version ID. Defaults to latest.

Outputs:
  Data: object         — Full model data tree
```

---

### Query Objects

```
Inputs:
  Data: object         — From Load component

Outputs:
  All Objects: list    — Flattened list of all objects
  Meshes:      list    — (expandable) Mesh geometry only
  Curves:      list    — (expandable) Curve geometry only
  Points:      list    — (expandable) Point geometry only
  Breps:       list    — (expandable) Brep geometry only
```

Expandable outputs appear when clicking the expand arrow on the component.

---

### Collection Selector

```
Inputs:
  Data: object         — From Load component

Outputs:
  Selection: list      — Objects from selected collection(s)
```

Search pattern syntax:
- `?` — Match single character
- `<pattern` — Starts with pattern
- `pattern>` — Ends with pattern
- `pattern1;pattern2` — Match multiple patterns (OR)

---

### Expand Collection

```
Inputs:
  Collection: object   — A collection from Load, Collection Selector, or previous Expand

Outputs:
  Items: list          — Direct children (objects and sub-collections)
```

Use iteratively to traverse deep hierarchies one level at a time.

---

### Deconstruct

```
Inputs:
  Object: object       — Any Speckle object

Outputs:
  Keys:   list[string] — Field names
  Values: list[any]    — Field values
  Types:  list[string] — Field type names
```

---

### Speckle Geometry Passthrough

```
Inputs:
  Geometry:   geometry  — Native GH geometry OR existing Speckle Geometry
  Name:       string    — (optional) Object name
  Properties: dict      — (optional) From Create Properties
  Color:      color     — (optional) Display color
  Material:   material  — (optional) Render material

Outputs:
  Object: object        — Speckle Geometry Object with metadata
```

---

### Block Definition Passthrough

```
Inputs:
  Geometry: list[geometry] — List of geometry objects forming the block
  Name:     string         — Definition name

Outputs:
  Definition: object       — Block definition for use in Block Instance Passthrough
```

---

### Block Instance Passthrough

```
Inputs:
  Definition: object       — From Block Definition Passthrough
  Transform:  transform    — 4x4 transformation matrix

Outputs:
  Instance: object         — Block instance positioned by transform
```

---

### Data Object Passthrough

```
Inputs:
  Geometry:   list[geometry] — List of geometry objects
  Properties: dict           — From Create Properties
  Name:       string         — (optional) Object name

Outputs:
  Object: object             — Data Object with geometry and properties
```

---

### Filter Objects

```
Inputs:
  Objects: list              — List of Speckle objects to filter
  Filter:  string            — Filter value

Filter modes (selectable via right-click):
  - By Name
  - By Property Key
  - By Material Name
  - By Application ID
  - By Speckle ID

Outputs:
  Matched:   list            — Objects matching filter
  Unmatched: list            — Objects not matching filter
```

---

## Rhino Proxy Structures

### RenderMaterial Proxy

```json
{
  "speckle_type": "Objects.Data.RenderMaterialProxy",
  "applicationId": "material-guid",
  "name": "Concrete Grey",
  "value": {
    "diffuse": { "r": 180, "g": 180, "b": 180 },
    "opacity": 1.0,
    "metallic": 0.0,
    "roughness": 0.8
  },
  "objects": ["obj-guid-1", "obj-guid-2"]
}
```

### Definition Proxy (Blocks)

```json
{
  "speckle_type": "Objects.Data.DefinitionProxy",
  "applicationId": "block-def-guid",
  "name": "Tree_Type_A",
  "value": {
    "displayValue": [{ "speckle_type": "Objects.Geometry.Mesh", "...": "..." }]
  },
  "objects": ["instance-guid-1", "instance-guid-2"]
}
```

### Instance Object

```json
{
  "speckle_type": "Objects.Data.InstanceObject",
  "definitionId": "block-def-guid",
  "transform": [1,0,0,5, 0,1,0,10, 0,0,1,0, 0,0,0,1],
  "applicationId": "instance-guid",
  "units": "m"
}
```
