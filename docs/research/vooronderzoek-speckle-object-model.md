# Vooronderzoek: Speckle Object Model

> Status: RAW — not yet processed into core files
> Date: 2026-03-20
> Sources: Speckle official docs, SpecklePy source code, Speckle.Sdk source code

---

## 1. The Base Class — Foundation of All Speckle Objects

Every Speckle object inherits from the `Base` class. This is the universal ancestor for all data flowing through the Speckle ecosystem, whether it represents a point, a wall, a commit root, or a custom domain object. The Base class is implemented in both the C# SDK (`Speckle.Sdk`) and the Python SDK (`SpecklePy`), with slightly different mechanisms but identical semantics.

### 1.1 Core Properties

The Base class defines four primary properties that exist on every Speckle object:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` (nullable) | A unique SHA256-based hash computed from the serialized object content. This field is `null` until the object has been serialized or deserialized from a source. It is NOT user-assigned — it is always computed. |
| `applicationId` | `string` (nullable) | An optional secondary identifier that stores the host application's native object ID (e.g., a Revit ElementId). This enables round-trip tracking: when you send an object from Revit and receive it back, the connector can match it to the original element. |
| `speckle_type` | `string` | A discriminator string derived from the class hierarchy. In C#, it is automatically computed via `TypeLoader.GetFullTypeString()` combining assembly name and inheritance chain. In Python, it is set as a class-level attribute on each dataclass. Examples: `"Base"`, `"Objects.Geometry.Mesh"`, `"Objects.Data.DataObject"`. |
| `totalChildrenCount` | `int` | An integer tracking the total number of detachable child objects in the decomposition tree. This is computed recursively and is used by the server and transports for progress reporting. |

### 1.2 C# Base Class Declaration

```csharp
[Serializable]
public class Base : DynamicBase, ISpeckleObject
{
    public string id { get; set; }
    public string applicationId { get; set; }
    public string speckle_type => TypeLoader.GetFullTypeString(GetType());
    public int totalChildrenCount { get; set; }

    public string GetId(bool decompose = false) { ... }
    public int GetTotalChildrenCount() { ... }
}
```

The C# `Base` inherits from `DynamicBase`, which inherits from `DynamicObject`, enabling the dictionary-like dynamic property access pattern.

### 1.3 Python Base Class Declaration

```python
@dataclass(kw_only=True)
class Base(_RegisteringBase):
    speckle_type = "Base"
    id: Union[str, None] = None
    applicationId: Union[str, None] = None
```

Key Python methods:
- `get_id(decompose=False)` — computes the SHA256 hash via serialization (expensive for large objects)
- `get_children_count()` — counts all descendant Base objects
- `get_member_names()` — returns all properties (dynamic + typed)
- `get_typed_member_names()` — returns only class-defined, type-hinted properties
- `get_dynamic_member_names()` — returns only runtime-added properties
- `get_serializable_attributes()` — returns properties marked for serialization
- `validate_prop_name(name)` — validates dynamic property names (no empty strings, no consecutive `@`, no `.` or `/`)
- `of_type(speckle_type, **kwargs)` — factory method to create a Base with a specific speckle_type

## 2. Identity: How the `id` Hash Is Computed

Speckle objects are content-addressed. The `id` is a deterministic hash computed from the serialized JSON representation of the object's properties. This means:

1. Two objects with identical properties ALWAYS produce the same `id`
2. Changing ANY property produces a different `id`
3. Objects are effectively immutable once their `id` is set — modifying a property conceptually creates a new object
4. The `id` is only populated AFTER serialization or when the object is deserialized from storage

### 2.1 Hash Computation Flow

In C#:
```csharp
public string GetId(bool decompose = false)
```
This method creates a `SpeckleObjectSerializer`, serializes the object, and returns the computed hash. The `decompose` parameter controls whether detached children are separated during serialization. This has a "tangible computational cost" for large object hierarchies — calling `GetId()` on a root object with thousands of children triggers full recursive serialization.

In Python:
```python
def get_id(self, decompose: bool = False) -> str
```
Equivalent behavior — serializes the object and returns the hash. The documentation warns about the computational cost for large hierarchies.

### 2.2 Property Name Conventions Affecting Hashing

- Properties prefixed with `__` (double underscore) are IGNORED during hashing and serialization entirely
- Properties prefixed with `@` are detached but still contribute to the parent's hash via their child `id` reference
- Standard properties are serialized inline and directly contribute to the hash

## 3. Dynamic vs Typed Properties

The Speckle object model supports a hybrid approach: strongly-typed properties defined in class declarations, plus arbitrary dynamic properties added at runtime.

### 3.1 Typed Properties

Defined in class declarations. In C#, these are standard C# properties. In Python, these are dataclass fields with type hints.

```csharp
// C# typed property
public class Wall : Base
{
    public double height { get; set; }
    public double baseOffset { get; set; }
    [DetachProperty]
    public List<Base> displayValue { get; set; }
}
```

```python
# Python typed property
@dataclass(kw_only=True)
class DataObject(Base):
    speckle_type = "Objects.Data.DataObject"
    name: str = ""
    properties: Dict[str, object] = field(default_factory=dict)
    displayValue: List[Base] = field(default_factory=list)
```

### 3.2 Dynamic Properties

Added at runtime using dictionary-style access. These are fully serialized and transmitted, just like typed properties.

```csharp
// C# dynamic properties
var myObject = new Base();
myObject["customProperty"] = "hello";
myObject["@detachedMesh"] = someMesh;  // @ prefix = detached

// Also via dynamic casting
((dynamic)myObject).anotherProp = 42;
```

```python
# Python dynamic properties
my_object = Base()
my_object["customProperty"] = "hello"
my_object["@detachedMesh"] = some_mesh
```

### 3.3 Property Name Validation

Both SDKs validate dynamic property names. The Python SDK's `validate_prop_name()` prohibits:
- Empty strings
- Consecutive `@` symbols (`@@`)
- Names containing `.` or `/`

The C# SDK uses `IsPropNameValid()` with similar restrictions.

## 4. The Detaching Mechanism

Detaching is Speckle's key optimization for large data sets. When a property is detached, instead of being serialized inline within the parent object, the child object is serialized separately and stored independently. The parent stores only a reference (the child's `id`).

### 4.1 Two Ways to Detach

**Method 1: `@` Prefix on dynamic property names**
```csharp
myBeam["@displayMesh"] = GetElementMesh(revitBeam);
```
Any dynamic property whose name starts with `@` is automatically detached during serialization. The `@` is stripped from the final property name.

**Method 2: `[DetachProperty]` attribute on typed properties (C# only)**
```csharp
[DetachProperty]
public List<Base> displayValue { get; set; }
```
This attribute marks a typed property for detachment. In Python, detachment is controlled by metadata on the dataclass field.

### 4.2 What Detaching Does

Without detaching:
```json
{
  "id": "abc123",
  "speckle_type": "Objects.BuiltElements.Wall",
  "displayValue": [
    { "id": "mesh1", "speckle_type": "Objects.Geometry.Mesh", "vertices": [...], "faces": [...] }
  ]
}
```

With detaching:
```json
{
  "id": "abc123",
  "speckle_type": "Objects.BuiltElements.Wall",
  "displayValue": [
    { "referencedId": "mesh1", "speckle_type": "reference" }
  ]
}
```

The mesh object `mesh1` is stored separately in the transport. Benefits:
- **Deduplication**: If the same mesh is referenced by multiple objects, it is stored only once
- **Lazy loading**: Clients can load the parent without loading heavy geometry
- **Transfer efficiency**: Only changed objects need to be re-sent

## 5. The Chunking Mechanism

Chunking splits large flat arrays (like mesh vertices or face indices) into smaller segments for efficient transport and storage.

### 5.1 C# `[Chunkable]` Attribute

```csharp
[Chunkable(31250)]
[DetachProperty]
public List<double> vertices { get; set; }
```

The `[Chunkable(size)]` attribute tells the serializer to split the list into chunks of `size` elements. Each chunk is stored as a separate detached object. This prevents single objects from becoming excessively large (e.g., a mesh with millions of vertices).

### 5.2 Impact on Transport

Without chunking, a mesh with 10 million vertices would produce a single serialized object of hundreds of megabytes. With chunking at size 31,250:
- The vertices list is split into ~320 chunks
- Each chunk is a separate object with its own `id`
- The parent mesh references the chunks
- Chunks can be transferred in parallel
- Only modified chunks need re-sending on updates

### 5.3 In Python

SpecklePy marks properties as chunkable and detachable via dataclass field metadata, achieving the same effect:
```python
vertices: List[float] = field(default_factory=list)  # marked chunkable in metadata
faces: List[int] = field(default_factory=list)        # marked chunkable in metadata
```

## 6. Decomposition: Composed vs Decomposed States

Speckle objects exist in two conceptual states:

### 6.1 Composed State
The object is a single nested JSON structure. All children are inline. This is what you work with in memory — a Python/C# object tree where you traverse properties directly.

### 6.2 Decomposed State
The object is flattened into many independent objects, each identified by its `id`. The root object references children via their IDs. This is the storage/transport representation. Decomposition happens during serialization (the `Send` operation) and recomposition happens during deserialization (the `Receive` operation).

The `GetId(decompose=true)` and `GetTotalChildrenCount()` methods work with the decomposed representation. The `totalChildrenCount` property on the root object tells transports how many separate objects to expect.

## 7. Data Schema Layers

The Speckle data schema is organized in five hierarchical layers, from lowest to highest:

### Layer 1: Properties and Geometries (Base Objects)
The atomic level. Key-value pairs representing data (strings, numbers, booleans) and geometry primitives (Point, Line, Mesh). These are the building blocks.

### Layer 2: DataObjects
Semantic objects representing BIM elements or domain entities. A `DataObject` wraps properties and geometry:

```python
@dataclass(kw_only=True)
class DataObject(Base):
    speckle_type = "Objects.Data.DataObject"
    name: str = ""
    properties: Dict[str, object] = field(default_factory=dict)
    displayValue: List[Base] = field(default_factory=list)  # detachable
```

The `displayValue` property holds geometry primitives (meshes, lines, points) that represent the visual form of the object. A wall's `displayValue` contains meshes, but the meshes themselves do not "know" they represent a wall.

Application-specific subclasses:
- `QgisObject(DataObject)` — speckle_type: `"Objects.Data.QgisObject"`, adds `type: str`
- `BlenderObject(DataObject)` — speckle_type: `"Objects.Data.BlenderObject"`, adds `type: str`

### Layer 3: Collections
Hierarchical groupings that organize objects into a tree structure:

```csharp
public class Collection : Base
{
    public string name { get; set; }
    public string collectionType { get; set; }
    public List<Base> elements { get; set; }
}
```

Collections MUST form a true directed tree (no cycles, no shared parents). Other Speckle objects may form directed acyclic graphs (DAGs), but collections are strictly tree-structured.

### Layer 4: Root Collection
The top-level container — the root of the commit tree. When you send data to Speckle, you send a root Collection that contains all other collections and objects.

### Layer 5: Proxies
Cross-cutting relationships that don't fit into the tree hierarchy. Proxies reference objects by their `applicationId` and store shared metadata.

## 8. Proxy Types

Proxies enable many-to-many relationships in a tree-structured data model. Each proxy holds a list of `objects` (applicationIds of the objects it relates to) and a `value` describing the shared attribute.

### 8.1 ColorProxy
```python
speckle_type = "Speckle.Core.Models.Proxies.ColorProxy"
objects: List[str]   # applicationIds of colored objects
value: int           # color as integer (ARGB)
name: Optional[str]  # human-readable color name
```

### 8.2 GroupProxy
```python
speckle_type = "Speckle.Core.Models.Proxies.GroupProxy"
objects: List[str]   # applicationIds of grouped objects
name: str            # group name
```

### 8.3 InstanceProxy
```python
speckle_type = "Speckle.Core.Models.Instances.InstanceProxy"
definitionId: str        # references an InstanceDefinitionProxy
transform: List[float]   # 4x4 transformation matrix as flat list
maxDepth: int            # nesting depth
```

### 8.4 InstanceDefinitionProxy
```python
speckle_type = "Speckle.Core.Models.Instances.InstanceDefinitionProxy"
objects: List[str]   # applicationIds of objects in the definition
maxDepth: int        # nesting depth
name: str            # definition name
```

### 8.5 LevelProxy
```python
speckle_type = "Objects.Other.LevelProxy"
objects: List[str]       # applicationIds of objects on this level
value: Base              # level data (elevation, name, etc.)
applicationId: str       # the level's own applicationId
```

### 8.6 RenderMaterialProxy
```python
speckle_type = "Objects.Other.RenderMaterialProxy"
objects: List[str]          # applicationIds of objects with this material
value: RenderMaterial       # the material definition
```

All proxy classes inherit from `Base`, use `@dataclass(kw_only=True)`, and mark their `objects` list as detachable.

## 9. The displayValue Mechanism

The `displayValue` property is the universal visual representation mechanism in Speckle. Every semantic object (wall, beam, column, etc.) stores its visual geometry in `displayValue` as an array of geometry primitives.

### 9.1 Key Rules
- `displayValue` ALWAYS contains geometry primitives (Mesh, Line, Point, etc.)
- A single DataObject can have MULTIPLE geometry objects in `displayValue`
- The geometry in `displayValue` is agnostic to the semantic meaning — a Mesh in a wall's displayValue is just a mesh
- `displayValue` is ALWAYS marked as detachable for efficient transport
- Applications that understand the semantic type (e.g., Revit receiving a Wall) MAY reconstruct native geometry; applications that do not (e.g., a web viewer) use `displayValue` for rendering

### 9.2 Example
```json
{
  "speckle_type": "Objects.BuiltElements.Wall",
  "height": 3.0,
  "baseOffset": 0.0,
  "displayValue": [
    {
      "speckle_type": "Objects.Geometry.Mesh",
      "vertices": [0, 0, 0, 1, 0, 0, 1, 0, 3, 0, 0, 3],
      "faces": [4, 0, 1, 2, 3],
      "units": "m"
    }
  ]
}
```

## 10. Geometry Types

SpecklePy exposes 17 geometry types through `specklepy.objects.geometry`:

| Type | speckle_type | Key Properties |
|------|-------------|----------------|
| **Point** | `Objects.Geometry.Point` | `x`, `y`, `z` (float), `units` |
| **Vector** | `Objects.Geometry.Vector` | `x`, `y`, `z` (float), `units` |
| **Line** | `Objects.Geometry.Line` | `start` (Point), `end` (Point), `units` |
| **Polyline** | `Objects.Geometry.Polyline` | connected line segments, `units` |
| **Arc** | `Objects.Geometry.Arc` | circular arc, `units` |
| **Circle** | `Objects.Geometry.Circle` | full circle, `units` |
| **Ellipse** | `Objects.Geometry.Ellipse` | elliptical curve, `units` |
| **Curve** | `Objects.Geometry.Curve` | parametric/NURBS curve, `units` |
| **Polycurve** | `Objects.Geometry.Polycurve` | composite curve segments, `units` |
| **Spiral** | `Objects.Geometry.Spiral` | spiral geometry, `units` |
| **Plane** | `Objects.Geometry.Plane` | origin (Point), normal (Vector), xdir, ydir |
| **Box** | `Objects.Geometry.Box` | basePlane, xSize, ySize, zSize, area, volume |
| **Mesh** | `Objects.Geometry.Mesh` | `vertices`, `faces`, `colors`, `textureCoordinates`, `vertexNormals` |
| **Surface** | `Objects.Geometry.Surface` | NURBS surface, `units` |
| **ControlPoint** | `Objects.Geometry.ControlPoint` | weighted control point |
| **PointCloud** | `Objects.Geometry.PointCloud` | large point collection |
| **Region** | `Objects.Geometry.Region` | bounded planar region |

### 10.1 Mesh In Detail

The Mesh class is the most important geometry type, as it serves as the universal visual representation for BIM elements.

```python
@dataclass(kw_only=True)
class Mesh(Base):  # implements IHasArea, IHasVolume, IHasUnits
    speckle_type = "Objects.Geometry.Mesh"
    vertices: List[float]           # flat array: [x0,y0,z0, x1,y1,z1, ...]
    faces: List[int]                # face definitions: [n, i0, i1, ..., n, i0, i1, ...]
    colors: List[int]               # optional per-vertex ARGB colors
    textureCoordinates: List[float] # optional UV coordinates
    vertexNormals: List[float]      # optional normal vectors
```

**Vertex encoding**: Every 3 consecutive values in `vertices` represent one point (x, y, z). The `vertices_count` property returns `len(vertices) // 3`.

**Face encoding**: Each face starts with the vertex count `n`, followed by `n` vertex indices:
- Triangle: `[3, 0, 1, 2]`
- Quad: `[4, 0, 1, 2, 3]`
- N-gon: `[n, i0, i1, ..., i(n-1)]`

**Key methods**:
- `get_point(index)` — returns vertex as Point object
- `get_points()` — returns all vertices as Point objects
- `get_face_vertices(face_index)` — retrieves vertices for a specific face
- `calculate_area()` — computes surface area via cross products
- `calculate_volume()` — computes volume for closed meshes via scalar triple product
- `is_closed()` — verifies mesh closure (each edge appears exactly twice)

Both `vertices` and `faces` are marked as chunkable and detachable for efficient transport of large meshes.

### 10.2 Units

Every geometry object includes a `units` field. Supported values:
- `"m"` — meters (most common, server default)
- `"mm"` — millimeters
- `"cm"` — centimeters
- `"ft"` — feet
- `"in"` — inches

Unit conversion is handled by connectors during the conversion to/from native application formats. The server stores geometry in whatever units the sender specified.

## 11. The Objects Kit: Built Elements

Beyond geometry, Speckle provides higher-level semantic types in the Objects kit:

### 11.1 Organization
- **Geometry namespace** (`Objects.Geometry.*`): Points, lines, meshes, surfaces
- **BuiltElements namespace** (`Objects.BuiltElements.*`): Walls, floors, beams, columns, rooms, etc.
- **Other namespace** (`Objects.Other.*`): Render materials, levels, misc

### 11.2 Built Element Pattern

Every built element follows the same pattern:
1. Inherits from `Base`
2. Defines semantic properties (height, width, material, etc.)
3. Has a `displayValue` property (detached) containing geometry primitives
4. Has an optional `bbox` property for bounding box

Example (C#):
```csharp
public class Box : Base, IHasVolume, IHasArea, IHasBoundingBox
{
    public Plane basePlane { get; set; }
    public Interval xSize { get; set; }
    public Interval ySize { get; set; }
    public Interval zSize { get; set; }
    public double area { get; set; }
    public double volume { get; set; }
}
```

### 11.3 Converters

Connectors implement converters to translate between native and Speckle representations:
- `ConvertToSpeckle`: Native application object → Speckle Base object
- `ConvertToNative`: Speckle Base object → Native application object

## 12. Instance and Definition Pattern

For repeated geometry (e.g., 1000 identical chairs), Speckle uses the Instance/Definition pattern:

1. An `InstanceDefinitionProxy` stores the geometry once, referencing the objects that compose the definition
2. Multiple `InstanceProxy` objects reference the same `definitionId` with different `transform` matrices (4x4 transformation as a flat 16-element list)
3. This achieves massive deduplication — 1000 chairs become 1 definition + 1000 lightweight transform references

## 13. Coordinate System and Transforms

- All geometry uses a right-handed coordinate system
- Geometry in `displayValue` uses local space relative to the DataObject
- Instance transforms are 4x4 matrices stored as flat 16-element float lists
- Collections may contribute additional transforms via parent hierarchy
- The viewer reconstructs world-space positions by composing transforms up the tree

---

## Anti-Patterns and Common Mistakes

### A-001: Calling `GetId()` in a Loop
**Mistake**: Computing the hash of a large object inside a loop (e.g., to check for duplicates).
**Why it's wrong**: `GetId()` triggers full recursive serialization. For an object with 10,000 children, this is extremely expensive.
**Correct approach**: Serialize once, store the id, and reuse it.

### A-002: Modifying Objects After Getting Their ID
**Mistake**: Calling `GetId()`, then modifying a property, then assuming the id is still valid.
**Why it's wrong**: The id is a content hash. ANY property change invalidates it.
**Correct approach**: Always call `GetId()` AFTER all modifications are complete.

### A-003: Using `.` or `/` in Dynamic Property Names
**Mistake**: `myObj["path/to/property"] = value` or `myObj["some.nested.prop"] = value`.
**Why it's wrong**: These characters are prohibited in property names and will raise validation errors.
**Correct approach**: Use camelCase names without special path separators.

### A-004: Not Detaching Large Geometry
**Mistake**: Storing large meshes as inline (non-detached) properties.
**Why it's wrong**: This creates massive single objects that cannot be deduplicated or lazily loaded.
**Correct approach**: ALWAYS use detached properties for geometry (`displayValue` is detached by default).

### A-005: Creating Cycles in Collections
**Mistake**: Having Collection A contain Collection B, which also contains Collection A.
**Why it's wrong**: Collections MUST form a strict tree. Cycles will cause infinite recursion during traversal.
**Correct approach**: Ensure collections form a directed tree with no shared parents.

### A-006: Forgetting Units on Geometry
**Mistake**: Creating geometry objects without setting the `units` field.
**Why it's wrong**: Without units, receiving applications cannot correctly scale geometry. A wall that should be 3 meters tall might appear as 3 millimeters.
**Correct approach**: ALWAYS set `units` on every geometry object.

### A-007: Using `totalChildrenCount` Before Serialization
**Mistake**: Reading `totalChildrenCount` before the object has been serialized.
**Why it's wrong**: This property is only populated during serialization. Before that, it is 0 or stale.
**Correct approach**: Use `GetTotalChildrenCount()` for an accurate count, or read after serialization.

### A-008: Assuming `applicationId` is Globally Unique
**Mistake**: Using `applicationId` as a unique key across different source applications.
**Why it's wrong**: `applicationId` is unique within a single source application. Two different Revit models may have elements with the same ElementId.
**Correct approach**: Use `id` (content hash) for global uniqueness. Use `applicationId` only for round-trip matching within the same source.

---

## Open Questions for Skills

1. **How exactly does the serializer handle circular references in non-collection objects?** The docs say collections must be trees, but other objects can be DAGs. What happens with actual cycles?

2. **What is the exact chunk size used for mesh vertices/faces?** The C# code shows `[Chunkable(31250)]` — is this consistent across SDKs?

3. **How do connectors decide which properties go into `properties` dict vs typed fields?** When converting a Revit wall, which parameters become typed properties and which go into the generic `properties` dictionary?

4. **What is the complete list of supported units?** The docs mention m, mm, ft, in — are there others (cm, km, yd)?

5. **How does the viewer handle missing `displayValue`?** If a DataObject has no geometry in `displayValue`, does the viewer skip it silently or show a placeholder?

6. **What is the exact hashing algorithm?** SHA256 is implied but not explicitly documented. Is it SHA256 of the JSON string? With what encoding?

7. **How are Brep objects handled in practice?** The geometry schema mentions Brep but it is rarely used in displayValue — do connectors always tessellate to Mesh instead?

---

## Sources Consulted

| Source | URL | Accessed |
|--------|-----|----------|
| Speckle Data Schema Overview | https://docs.speckle.systems/developers/data-schema/overview | 2026-03-20 |
| Speckle Geometry Schema | https://docs.speckle.systems/developers/data-schema/geometry-schema | 2026-03-20 |
| Speckle Base Object Guide | https://speckle.guide/dev/base.html | 2026-03-20 |
| Speckle Objects Kit Guide | https://speckle.guide/dev/objects.html | 2026-03-20 |
| SpecklePy Base class source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/objects/base.py | 2026-03-20 |
| SpecklePy Geometry __init__ | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/objects/geometry/__init__.py | 2026-03-20 |
| SpecklePy Mesh source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/objects/geometry/mesh.py | 2026-03-20 |
| SpecklePy Proxies source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/objects/proxies.py | 2026-03-20 |
| SpecklePy DataObjects source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/objects/data_objects.py | 2026-03-20 |
| Speckle.Sdk Base.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Models/Base.cs | 2026-03-20 |
| Speckle .NET SDK Guide | https://speckle.guide/dev/dotnet.html | 2026-03-20 |
