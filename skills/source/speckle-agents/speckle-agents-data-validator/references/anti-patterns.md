# Data Validator — Anti-Patterns

## AP-1: Skipping Validation Before Send

**Wrong:**
```python
root = build_model()
obj_id = operations.send(root, [transport])  # No validation
```

**Why it fails:** Malformed objects (bad mesh encoding, missing units, broken proxy refs) are stored permanently on the server. Downstream consumers get corrupted data. The server does NOT validate object integrity -- it stores whatever it receives.

**Correct:**
```python
root = build_model()
result = pre_flight_validate(root, proxies)
if result["errors"]:
    raise ValueError(f"Validation failed: {result['errors']}")
obj_id = operations.send(root, [transport])
```

---

## AP-2: Manually Setting the `id` Field

**Wrong:**
```python
obj = Base()
obj.id = "my-custom-id-12345"
obj["name"] = "Wall"
operations.send(obj, [transport])
```

**Why it fails:** The `id` is a SHA256 content hash computed by the serializer. Manually setting it creates a mismatch between the declared `id` and the actual content hash. This causes deduplication failures, cache misses, and object resolution errors.

**Correct:**
```python
obj = Base()
obj["name"] = "Wall"
# id is computed automatically during send
obj_id = operations.send(obj, [transport])
```

---

## AP-3: Using `id` Instead of `applicationId` in Proxy References

**Wrong:**
```python
material_proxy = Base()
material_proxy["objects"] = [wall.get_id(), beam.get_id()]  # WRONG: uses content hash
```

**Why it fails:** The `id` changes whenever ANY property of the object changes. After one update cycle, the proxy references point to non-existent hashes. Proxies MUST use `applicationId` because it remains stable across versions.

**Correct:**
```python
material_proxy = Base()
material_proxy["objects"] = [wall.applicationId, beam.applicationId]
```

---

## AP-4: Validating Only the Root Object

**Wrong:**
```python
errors = validate_base_object(root_collection)
if not errors:
    operations.send(root_collection, [transport])
```

**Why it fails:** The root collection itself may be valid, but child objects deep in the tree may have malformed meshes, missing units, or broken references. Validation MUST walk the entire object tree.

**Correct:**
```python
result = pre_flight_validate(root_collection, proxies)  # Walks ALL children
if not result["errors"]:
    operations.send(root_collection, [transport])
```

---

## AP-5: Ignoring Mixed Units in Federated Models

**Wrong:**
```python
# Combine Revit (feet) and Rhino (meters) objects without checking
all_objects = revit_objects + rhino_objects
root.elements = all_objects
operations.send(root, [transport])
```

**Why it fails:** Objects with `units="ft"` mixed with `units="m"` render at wildly different scales in the viewer. A 3-foot wall next to a 3-meter wall appears 10x smaller. While connectors handle unit conversion during load, the raw data on the server retains original units.

**Correct:**
```python
errors = validate_unit_consistency(all_geometry)
if errors:
    # Log the warning -- mixed units are acceptable in federation
    # but MUST be intentional and documented
    print(f"Unit warning: {errors}")
root.elements = all_objects
operations.send(root, [transport])
```

---

## AP-6: Trusting displayValue Without Validation

**Wrong:**
```python
# Assume received objects have valid displayValue
for obj in received_objects:
    mesh = obj["displayValue"][0]  # May be None, empty, or not a list
    process_mesh(mesh)
```

**Why it fails:** `displayValue` may be `None` (object has no geometry), an empty list, or contain unexpected types. Not all connectors populate `displayValue` consistently. Accessing index `[0]` on `None` raises `TypeError`.

**Correct:**
```python
for obj in received_objects:
    dv = getattr(obj, "displayValue", None)
    if not dv or not isinstance(dv, list) or len(dv) == 0:
        continue  # Skip objects without geometry
    for geom in dv:
        if getattr(geom, "speckle_type", "") == "Objects.Geometry.Mesh":
            errors = validate_mesh(geom)
            if not errors:
                process_mesh(geom)
```

---

## AP-7: Creating Cycles in Collection Hierarchies

**Wrong:**
```python
level_1 = Collection(name="Level 1", elements=[], collectionType="level")
walls = Collection(name="Walls", elements=[], collectionType="category")

level_1.elements.append(walls)
walls.elements.append(level_1)  # CYCLE
```

**Why it fails:** The serializer walks the object tree recursively. A cycle causes infinite recursion, stack overflow, and process crash. Collections MUST form a strict directed tree with no cycles and no shared parents.

**Correct:**
```python
level_1 = Collection(name="Level 1", elements=[], collectionType="level")
walls = Collection(name="Walls", elements=[], collectionType="category")
level_1.elements.append(walls)

# ALWAYS validate before send
errors = validate_collection_tree(level_1)
assert len(errors) == 0
```

---

## AP-8: Modifying Objects After Computing Their Hash

**Wrong:**
```python
obj = Base()
obj["name"] = "Wall A"
computed_id = obj.get_id()  # Hash is computed

obj["name"] = "Wall B"  # Property changed AFTER hash
# computed_id is now STALE -- does not match actual content
```

**Why it fails:** `get_id()` computes a SHA256 hash of the serialized content at call time. Modifying ANY property after calling `get_id()` invalidates the hash. Using the stale hash for deduplication or references causes silent data corruption.

**Correct:**
```python
obj = Base()
obj["name"] = "Wall B"  # Finalize ALL properties first
computed_id = obj.get_id()  # THEN compute hash
```

---

## AP-9: Assuming applicationId Is Globally Unique

**Wrong:**
```python
# Build a lookup map assuming applicationId is globally unique
all_objects_map = {}
for obj in model_a_objects + model_b_objects:
    all_objects_map[obj.applicationId] = obj  # Overwrites if duplicate
```

**Why it fails:** `applicationId` is unique only within a single source application. Two different Revit models may have elements with the same ElementId (e.g., both have a wall with ElementId "123456"). Combining objects from multiple sources without namespacing causes silent overwrites.

**Correct:**
```python
all_objects_map = {}
for obj in model_a_objects:
    all_objects_map[f"model_a:{obj.applicationId}"] = obj
for obj in model_b_objects:
    all_objects_map[f"model_b:{obj.applicationId}"] = obj
```

---

## AP-10: Validating Mesh Faces as a Flat Index Array

**Wrong:**
```python
# Treating faces as simple triangle indices
def bad_validate(mesh):
    for i in range(0, len(mesh.faces), 3):
        # WRONG: assumes all faces are triangles with 3 indices each
        a, b, c = mesh.faces[i], mesh.faces[i+1], mesh.faces[i+2]
```

**Why it fails:** Speckle mesh faces use a variable-length encoding. Each face starts with `n` (vertex count), followed by `n` vertex indices. Faces can be triangles (n=3), quads (n=4), or n-gons. Treating the array as fixed-stride-3 produces garbage results after the first non-triangle face.

**Correct:**
```python
def good_validate(mesh):
    i = 0
    while i < len(mesh.faces):
        n = mesh.faces[i]  # Number of vertices in this face
        indices = mesh.faces[i+1 : i+1+n]
        # Process face with 'n' vertices
        i += n + 1  # Advance past count + indices
```

---

## AP-11: Not Validating After Receive in Automated Pipelines

**Wrong:**
```python
# Automate function that processes received data without validation
def automate_function(automate_context):
    version = automate_context.receive_version()
    objects = flatten(version)
    run_analysis(objects)  # May crash on malformed data
```

**Why it fails:** In Speckle Automate functions, the received data comes from external users. There is no guarantee that the sender validated their data. Malformed meshes, missing properties, or broken references cause the Automate function to crash with uninformative errors.

**Correct:**
```python
def automate_function(automate_context):
    version = automate_context.receive_version()
    objects = flatten(version)

    # Validate before processing
    for obj in objects:
        errors = validate_base_object(obj)
        if errors:
            automate_context.attach_error_to_objects(
                "Validation", [obj.id], f"Object validation failed: {errors}"
            )
            continue
        run_analysis([obj])
```

---

## AP-12: Omitting Units on Programmatically Created Geometry

**Wrong:**
```python
mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],
    faces=[3, 0, 1, 2],
    # No units specified
)
```

**Why it fails:** The viewer and all connectors rely on the `units` field to determine scale. Without units, a mesh intended to be 1 meter wide may render as 1 millimeter or 1 foot, depending on the receiving application's assumptions. There is NO reliable default.

**Correct:**
```python
mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],
    faces=[3, 0, 1, 2],
    units="m",  # ALWAYS set units
)
```

---

## Summary Table

| Anti-Pattern | Risk Level | Consequence |
|-------------|-----------|-------------|
| AP-1: Skip validation before send | HIGH | Corrupted data stored permanently |
| AP-2: Manual `id` assignment | HIGH | Deduplication failure, cache corruption |
| AP-3: `id` in proxy references | HIGH | Broken references after first update |
| AP-4: Root-only validation | MEDIUM | Hidden errors in child objects |
| AP-5: Ignoring mixed units | MEDIUM | Geometry at wrong scale in viewer |
| AP-6: Trusting displayValue | MEDIUM | Runtime crashes on None/empty |
| AP-7: Collection cycles | HIGH | Infinite recursion, process crash |
| AP-8: Modify after hash | HIGH | Silent data corruption |
| AP-9: Global applicationId assumption | MEDIUM | Silent overwrites in federated data |
| AP-10: Flat face array parsing | HIGH | Garbled mesh rendering |
| AP-11: No validation in Automate | MEDIUM | Uninformative Automate crashes |
| AP-12: Omitting geometry units | MEDIUM | Wrong scale rendering |
