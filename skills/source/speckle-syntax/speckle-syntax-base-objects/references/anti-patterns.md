# Anti-Patterns (Speckle Base Objects)

## 1. Missing Units on Geometry

```python
# WRONG: No units specified
point = Point(x=1.0, y=2.0, z=3.0)
mesh = Mesh(vertices=[0,0,0, 1,0,0, 1,1,0], faces=[3, 0, 1, 2], colors=[])

# CORRECT: ALWAYS set units on every geometry object
point = Point(x=1.0, y=2.0, z=3.0, units="m")
mesh = Mesh(vertices=[0,0,0, 1,0,0, 1,1,0], faces=[3, 0, 1, 2], colors=[], units="m")
```

```csharp
// WRONG
var p = new Point(1, 2, 3, null);

// CORRECT
var p = new Point(1, 2, 3, "m");
```

**WHY**: Without units, receiving applications cannot correctly scale geometry. A wall that should be 3 meters tall renders as 3 millimeters or 3 feet depending on the receiver's default assumption.

---

## 2. Sending Geometry Directly Without a Container

```python
# WRONG: Sending a Line directly -- viewer will NOT render it
line = Line(start=Point(x=0, y=0, z=0, units="m"), end=Point(x=10, y=0, z=0, units="m"), units="m")
object_id = operations.send(base=line, transports=[transport])

# CORRECT: Wrap in a Base container
container = Base()
container["beamAxis"] = line
object_id = operations.send(base=container, transports=[transport])
```

```csharp
// WRONG
await Operations.Send(mesh, transport);

// CORRECT
var container = new Base();
container["@geometry"] = mesh;
await Operations.Send(container, transport);
```

**WHY**: The Speckle viewer expects a root object with named properties containing geometry. Sending a bare geometry primitive succeeds at the transport level but produces invisible content in the 3D viewer.

---

## 3. Storing Large Geometry Inline (Not Detached)

```python
# WRONG: Large mesh stored inline (no @ prefix)
obj["displayMesh"] = huge_mesh  # Serialized inline with parent

# CORRECT: Use @ prefix to detach
obj["@displayMesh"] = huge_mesh  # Stored separately, referenced by ID
```

```csharp
// WRONG: No [DetachProperty] on typed property
public class MyElement : Base
{
    public List<Mesh> displayValue { get; set; }  // Inline!
}

// CORRECT: Add [DetachProperty]
public class MyElement : Base
{
    [DetachProperty]
    public List<Base> displayValue { get; set; }  // Detached
}
```

**WHY**: Inline storage creates massive single objects that cannot be deduplicated or lazily loaded. A model with 1000 walls sharing the same mesh material stores 1000 copies instead of 1. Detachment enables deduplication and parallel transfer.

---

## 4. Using Invalid Characters in Property Names

```python
# WRONG: Dots and slashes are prohibited
obj["path/to/property"] = "value"
obj["nested.prop.name"] = 42
obj["@@doubleAt"] = "bad"
obj[""] = "empty"

# CORRECT: Use camelCase without special characters
obj["pathToProperty"] = "value"
obj["nestedPropName"] = 42
obj["detachedProp"] = "good"  # single @ is fine: obj["@detachedProp"]
```

**WHY**: The `validate_prop_name()` method in both SDKs prohibits empty strings, consecutive `@` symbols, and `.` or `/` characters. These cause validation errors during serialization.

---

## 5. Creating Cycles in Collections

```python
# WRONG: Collection A contains B, B contains A
collection_a = Collection(name="A", collectionType="layer", elements=[])
collection_b = Collection(name="B", collectionType="layer", elements=[])
collection_a.elements.append(collection_b)
collection_b.elements.append(collection_a)  # CYCLE!

# CORRECT: Strict tree hierarchy (no shared parents, no cycles)
root = Collection(name="Root", collectionType="root", elements=[])
child_a = Collection(name="A", collectionType="layer", elements=[])
child_b = Collection(name="B", collectionType="layer", elements=[])
root.elements.append(child_a)
root.elements.append(child_b)
```

**WHY**: Collections MUST form a strict directed tree. Cycles cause infinite recursion during serialization and traversal, leading to stack overflow or infinite loops.

---

## 6. Calling get_id() in a Loop

```python
# WRONG: Computing hash inside a loop (extremely expensive)
for obj in large_object_list:
    obj_id = obj.get_id()  # Full serialization on each call!
    if obj_id in seen_ids:
        duplicates.append(obj)

# CORRECT: Serialize once, store the ID, reuse it
ids = {}
for obj in large_object_list:
    obj_id = obj.get_id()
    ids[obj_id] = obj

# Or better: batch-send and let the transport handle deduplication
```

```csharp
// WRONG
foreach (var obj in largeList)
{
    var id = obj.GetId();  // Expensive recursive serialization!
}

// CORRECT: Compute once after all modifications
obj.property1 = value1;
obj.property2 = value2;
var id = obj.GetId();  // Single call at the end
```

**WHY**: `get_id()` / `GetId()` triggers full recursive serialization to compute the SHA256 hash. For an object with 10,000 children, each call is extremely expensive. The hash is only valid until the next property change anyway.

---

## 7. Modifying Objects After Getting Their ID

```python
# WRONG: ID is stale after modification
mesh.units = "m"
mesh_id = mesh.get_id()
mesh.vertices.extend([5.0, 5.0, 5.0])  # ID is now INVALID!
# mesh_id no longer represents the current state

# CORRECT: ALWAYS compute ID after ALL modifications are complete
mesh.units = "m"
mesh.vertices.extend([5.0, 5.0, 5.0])
mesh_id = mesh.get_id()  # Now reflects the final state
```

**WHY**: The `id` is a content-based hash. ANY property change produces a different hash. Using a stale ID leads to data integrity issues -- the server stores an object whose ID does not match its content.

---

## 8. Forgetting displayValue on Domain Objects

```csharp
// WRONG: Wall without displayValue -- invisible in viewer
var wall = new Wall
{
    height = 3.0,
    baseOffset = 0.0
    // No displayValue!
};

// CORRECT: ALWAYS provide displayValue with visual geometry
var wall = new Wall
{
    height = 3.0,
    baseOffset = 0.0,
    displayValue = new List<Base> { wallMesh }
};
```

```python
# WRONG: Semantic object without visual representation
wall = Base()
wall["height"] = 3.0
wall["material"] = "Concrete"
# No displayValue -- viewer cannot render it

# CORRECT: Include displayValue
wall = Base()
wall["height"] = 3.0
wall["material"] = "Concrete"
wall["@displayValue"] = [wall_mesh]  # Viewer uses this for rendering
```

**WHY**: The Speckle viewer renders objects using their `displayValue` property. Domain objects without `displayValue` are invisible in the viewer. Applications that understand the semantic type (e.g., Revit receiving a Wall) MAY reconstruct native geometry, but generic viewers rely entirely on `displayValue`.

---

## 9. Wrong Mesh Face Encoding

```python
# WRONG: Flat index list without vertex counts
mesh = Mesh(
    vertices=[0,0,0, 1,0,0, 1,1,0, 0,1,0],
    faces=[0, 1, 2, 3],  # Missing face vertex count!
    colors=[],
    units="m"
)

# CORRECT: Each face starts with vertex count N, then N indices
mesh = Mesh(
    vertices=[0,0,0, 1,0,0, 1,1,0, 0,1,0],
    faces=[4, 0, 1, 2, 3],  # Quad: 4 vertices, then 4 indices
    colors=[],
    units="m"
)

# CORRECT: Two triangles
mesh = Mesh(
    vertices=[0,0,0, 1,0,0, 1,1,0, 0,1,0],
    faces=[3, 0, 1, 2, 3, 0, 2, 3],  # tri1: [3,0,1,2], tri2: [3,0,2,3]
    colors=[],
    units="m"
)
```

**WHY**: Speckle's face encoding requires each face to start with the number of vertices (3 for triangle, 4 for quad, N for N-gon), followed by vertex indices. Omitting the count causes the face parser to misinterpret the data, producing corrupted geometry.

---

## 10. Using Mutable Default Arguments in Python Dataclasses

```python
# WRONG: Mutable default argument
@dataclass(kw_only=True)
class BadElement(Base, speckle_type="Bad.Element"):
    tags: List[str] = []  # Shared across all instances!

# CORRECT: Use field(default_factory=...)
from dataclasses import field

@dataclass(kw_only=True)
class GoodElement(Base, speckle_type="Good.Element"):
    tags: List[str] = field(default_factory=list)
```

**WHY**: Python mutable defaults are shared between all instances of a class. Modifying `tags` on one instance modifies it on all instances. This is a standard Python dataclass rule, but it is especially dangerous with Speckle objects because shared state corrupts content-addressed hashing.

---

## 11. Assuming applicationId is Globally Unique

```python
# WRONG: Using applicationId as a global key
objects_by_app_id = {}
for obj in received_objects:
    objects_by_app_id[obj.applicationId] = obj  # Collisions!

# CORRECT: Use the content hash (id) for global uniqueness
objects_by_id = {}
for obj in received_objects:
    objects_by_id[obj.get_id()] = obj

# applicationId is ONLY valid within a single source application
```

**WHY**: `applicationId` stores the host application's native ID (e.g., Revit ElementId). Two different Revit models MAY have elements with the same ElementId. Use `applicationId` only for round-trip matching within the same source, NEVER as a global unique key.
