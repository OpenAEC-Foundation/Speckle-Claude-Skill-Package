# Anti-Patterns (Speckle Object Model)

## Identity Anti-Patterns

### 1. Calling get_id() in a Loop

```python
# WRONG: Triggers full recursive serialization on every iteration
for obj in large_list:
    if obj.get_id() == target_id:  # expensive!
        return obj

# CORRECT: Compute once, store, and reuse
id_map = {obj.get_id(): obj for obj in large_list}  # one pass
result = id_map.get(target_id)
```

**WHY**: `get_id()` serializes the entire object tree recursively to compute the SHA256 hash. For an object with 10,000 children, each call is extremely expensive. Calling it in a loop multiplies this cost.

---

### 2. Modifying Objects After Computing id

```python
# WRONG: The id is stale after modification
obj_id = wall.get_id()
wall["height"] = 5.0        # id is now invalid!
send_to_server(obj_id, wall)  # mismatched id and content

# CORRECT: ALWAYS compute id after all modifications are final
wall["height"] = 5.0
obj_id = wall.get_id()       # computed from final state
```

**WHY**: The `id` is a content hash. ANY property change produces a different hash. Using a stale id causes data integrity failures -- the server stores content under the wrong hash.

---

### 3. Manually Assigning the id Field

```python
# WRONG: id is computed, not assigned
obj = Base()
obj.id = "my-custom-id-123"

# CORRECT: Let the serializer compute it
obj = Base()
obj["name"] = "My Object"
computed_id = obj.get_id()  # SHA256 hash
```

**WHY**: The `id` field MUST be a valid SHA256 content hash. Manually assigned ids break content addressing, deduplication, and transport integrity checks.

---

### 4. Assuming applicationId is Globally Unique

```python
# WRONG: Using applicationId as a global key
all_objects = receive_from_multiple_models()
unique_map = {obj.applicationId: obj for obj in all_objects}
# Two walls from different Revit models may share the same ElementId!

# CORRECT: Use id for global uniqueness
unique_map = {obj.get_id(): obj for obj in all_objects}

# Or scope applicationId by source
unique_map = {(source_model, obj.applicationId): obj for obj in all_objects}
```

**WHY**: `applicationId` is unique only within a single source application. Different Revit models regularly contain elements with identical ElementIds.

---

## Serialization Anti-Patterns

### 5. Storing Large Geometry Inline (Not Detached)

```python
# WRONG: Large mesh stored inline
wall = Base()
wall["displayMesh"] = huge_mesh  # no @ prefix = inline

# CORRECT: Detach large geometry
wall["@displayMesh"] = huge_mesh  # @ prefix = detached
```

```csharp
// WRONG: Missing [DetachProperty] on large data
public class Wall : Base
{
    public List<Base> displayValue { get; set; }  // inline!
}

// CORRECT: Always detach geometry collections
public class Wall : Base
{
    [DetachProperty]
    public List<Base> displayValue { get; set; }
}
```

**WHY**: Inline storage creates monolithic objects that cannot be deduplicated, lazily loaded, or transferred in parallel. A single wall with an inline mesh of millions of vertices becomes a multi-hundred-megabyte JSON blob.

---

### 6. Not Chunking Large Numeric Arrays

```csharp
// WRONG: Huge vertex list without chunking
[DetachProperty]
public List<double> vertices { get; set; }  // single massive object

// CORRECT: Chunk large arrays
[Chunkable(31250)]
[DetachProperty]
public List<double> vertices { get; set; }
```

**WHY**: Without chunking, a mesh with 10 million vertices produces a single serialized object of hundreds of megabytes. Chunking splits it into ~320 independently transferable segments, enabling parallel transfer and incremental updates.

---

### 7. Using Invalid Characters in Property Names

```python
# WRONG: Dots and slashes are prohibited
obj["path/to/value"] = 42
obj["some.nested.prop"] = "hello"
obj["@@doubleAt"] = True

# CORRECT: Use camelCase names
obj["pathToValue"] = 42
obj["someNestedProp"] = "hello"
obj["detachedProp"] = True      # or obj["@detachedProp"] for detachment
```

**WHY**: Both SDKs validate property names. Dots (`.`), slashes (`/`), and consecutive `@@` are rejected. These restrictions exist because property names appear in JSON keys and URL paths within the Speckle transport layer.

---

## Collection Anti-Patterns

### 8. Creating Cycles in Collection Hierarchies

```python
# WRONG: Circular reference
collection_a = Collection(name="A", elements=[])
collection_b = Collection(name="B", elements=[collection_a])
collection_a.elements.append(collection_b)  # cycle!

# CORRECT: Strict tree structure
root = Collection(name="Root", elements=[])
floor = Collection(name="Floor 1", elements=[wall_a, wall_b])
root.elements.append(floor)
# Each collection has exactly one parent. No cycles.
```

**WHY**: Collections MUST form a strict directed tree. Cycles cause infinite recursion during traversal, serialization, and decomposition. The Speckle viewer and server assume tree structure for collections.

---

### 9. Sharing a Collection Across Multiple Parents

```python
# WRONG: Same collection in two parents
shared = Collection(name="Shared Walls", elements=[wall_a])
floor_1 = Collection(name="Floor 1", elements=[shared])
floor_2 = Collection(name="Floor 2", elements=[shared])  # shared parent!

# CORRECT: Each collection belongs to exactly one parent
walls_f1 = Collection(name="Floor 1 Walls", elements=[wall_a])
walls_f2 = Collection(name="Floor 2 Walls", elements=[wall_b])
floor_1 = Collection(name="Floor 1", elements=[walls_f1])
floor_2 = Collection(name="Floor 2", elements=[walls_f2])
```

**WHY**: Collections form a tree, not a DAG. A collection with multiple parents breaks the tree invariant. If objects need to appear in multiple groupings, use Proxy types instead.

---

## Geometry Anti-Patterns

### 10. Omitting Units on Geometry Objects

```python
# WRONG: No units specified
mesh = Mesh(
    vertices=[0, 0, 0, 3, 0, 0, 3, 3, 0],
    faces=[3, 0, 1, 2]
    # units missing!
)

# CORRECT: ALWAYS set units
mesh = Mesh(
    vertices=[0, 0, 0, 3, 0, 0, 3, 3, 0],
    faces=[3, 0, 1, 2],
    units="m"
)
```

**WHY**: Without units, receiving applications cannot scale geometry correctly. A wall intended to be 3 meters tall may render as 3 millimeters or 3 feet. Connectors depend on the `units` field for correct conversion.

---

### 11. Wrong Vertex/Face Encoding

```python
# WRONG: Vertices not in flat [x,y,z, x,y,z, ...] format
mesh = Mesh(
    vertices=[[0, 0, 0], [1, 0, 0], [1, 1, 0]],  # nested lists!
    faces=[3, 0, 1, 2],
    units="m"
)

# CORRECT: Flat array, every 3 values = one vertex
mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],
    faces=[3, 0, 1, 2],
    units="m"
)

# WRONG: Face without vertex count prefix
mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],
    faces=[0, 1, 2],  # missing the leading 3!
    units="m"
)

# CORRECT: Each face starts with vertex count
mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],
    faces=[3, 0, 1, 2],  # 3 = triangle, then 3 vertex indices
    units="m"
)
```

**WHY**: Speckle uses flat arrays for efficiency. Vertices are `[x0, y0, z0, x1, y1, z1, ...]`. Faces encode the vertex count first: `[n, i0, i1, ..., n, i0, i1, ...]`. Incorrect encoding produces corrupted geometry that silently renders wrong or crashes the viewer.

---

## Proxy Anti-Patterns

### 12. Using id Instead of applicationId in Proxy.objects

```python
# WRONG: Proxies reference applicationIds, not content hashes
color_proxy = ColorProxy(
    objects=[wall.get_id(), beam.get_id()],  # these are content hashes!
    value=0xFFFF0000
)

# CORRECT: Use applicationId values
color_proxy = ColorProxy(
    objects=[wall.applicationId, beam.applicationId],
    value=0xFFFF0000
)
```

**WHY**: Proxy `objects` lists contain `applicationId` values, not content-addressed `id` hashes. The proxy system is designed for round-trip tracking with host applications, which use `applicationId` for element identity.

---

### 13. Reading totalChildrenCount Before Serialization

```python
# WRONG: Reading before serialization
root = Collection(name="Root", elements=[wall_a, wall_b])
print(root.totalChildrenCount)  # 0 -- not yet computed!

# CORRECT: Use the method, or read after serialization
count = root.get_children_count()  # forces recursive computation
```

**WHY**: The `totalChildrenCount` property is only populated during the serialization process. Before serialization, it is 0 or stale. Use `get_children_count()` / `GetTotalChildrenCount()` for an accurate count at any time.
