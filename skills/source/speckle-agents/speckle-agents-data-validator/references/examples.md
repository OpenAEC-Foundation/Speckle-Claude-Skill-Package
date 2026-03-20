# Data Validator — Examples

## Example 1: Full Pre-Flight Validation Before Send

Complete workflow: build objects, validate, then send only if validation passes.

```python
from specklepy.objects.base import Base
from specklepy.objects.geometry.mesh import Mesh
from specklepy.objects.other import Collection
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

# Build a simple model
root = Collection(name="My Model", elements=[], collectionType="model")

wall_mesh = Mesh(
    vertices=[0, 0, 0, 5, 0, 0, 5, 0, 3, 0, 0, 3],
    faces=[4, 0, 1, 2, 3],
    units="m",
)

wall = Base()
wall.speckle_type = "Objects.Data.DataObject"
wall["name"] = "Exterior Wall"
wall["displayValue"] = [wall_mesh]
wall["properties"] = {"height": 3.0, "width": 5.0}
wall.applicationId = "wall-001"

root.elements.append(wall)

# Run pre-flight validation
result = pre_flight_validate(root, proxies=[])

if result["errors"]:
    print(f"VALIDATION FAILED ({len(result['errors'])} errors):")
    for err in result["errors"]:
        print(f"  - {err}")
    # DO NOT send
else:
    print(f"Validation passed. {result['stats']['objects']} objects ready to send.")
    transport = ServerTransport(stream_id="your-stream-id", client=client)
    obj_id = operations.send(root, [transport])
```

## Example 2: Mesh Validation Catching Common Errors

```python
# BAD: Vertices not divisible by 3
bad_mesh = Mesh(
    vertices=[0, 0, 0, 1, 0],  # 5 values -- not divisible by 3
    faces=[3, 0, 1, 2],
    units="m",
)
errors = validate_mesh(bad_mesh)
# Result: ["Vertices array length 5 is not divisible by 3"]

# BAD: Face index out of bounds
bad_mesh_2 = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],  # 3 vertices (indices 0-2)
    faces=[3, 0, 1, 5],  # index 5 exceeds max index 2
    units="m",
)
errors = validate_mesh(bad_mesh_2)
# Result: ["Face 0: index 5 out of bounds (max 2)"]

# BAD: No units
bad_mesh_3 = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0],
    faces=[3, 0, 1, 2],
)
errors = validate_mesh(bad_mesh_3)
# Result: ["Mesh has no units set"]

# GOOD: Valid mesh
good_mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    faces=[4, 0, 1, 2, 3],
    units="m",
)
errors = validate_mesh(good_mesh)
# Result: [] (no errors)
```

## Example 3: Proxy Reference Validation

```python
from specklepy.objects.other import Collection

# Build objects with applicationIds
wall_1 = Base()
wall_1.applicationId = "wall-001"
wall_1["name"] = "Wall 1"

wall_2 = Base()
wall_2.applicationId = "wall-002"
wall_2["name"] = "Wall 2"

root = Collection(name="Model", elements=[wall_1, wall_2], collectionType="model")

# Create a material proxy
material_proxy = Base()
material_proxy.speckle_type = "Objects.Other.RenderMaterialProxy"
material_proxy["name"] = "Concrete"
material_proxy["objects"] = ["wall-001", "wall-003"]  # wall-003 does not exist

errors = validate_proxy_references(root, [material_proxy])
# Result: ["Proxy 'Concrete' (Objects.Other.RenderMaterialProxy): references applicationId 'wall-003' which does not exist in the commit"]
```

## Example 4: Post-Receive Duplicate applicationId Detection

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

# After receiving
transport = ServerTransport(stream_id="your-stream-id", client=client)
received = operations.receive(obj_id, transport)

# Flatten all objects from the collection tree
all_objects = []

def flatten(node):
    all_objects.append(node)
    for child in getattr(node, "elements", []) or []:
        flatten(child)

flatten(received)

# Check for duplicates
errors = check_duplicate_app_ids(all_objects)
if errors:
    print("WARNING: Duplicate applicationIds found:")
    for err in errors:
        print(f"  - {err}")
```

## Example 5: Unit Consistency Check Across Federated Model

```python
# When loading objects from multiple sources
revit_objects = [...]   # units = "ft"
rhino_objects = [...]    # units = "m"

all_geometry = []
for obj in revit_objects + rhino_objects:
    dv = getattr(obj, "displayValue", None)
    if dv:
        all_geometry.extend(dv)

errors = validate_unit_consistency(all_geometry)
# Result: ["Mixed units detected: ft: 150, m: 75. Verify this is intentional."]
# This is expected for federated models -- connectors handle conversion automatically
```

## Example 6: Property Coverage Audit for BIM QA

```python
# Verify all walls have required properties for a QA check
walls = [obj for obj in all_objects if "Wall" in getattr(obj, "speckle_type", "")]

required = ["height", "width", "material", "fire_rating"]
report = audit_property_coverage(walls, required)

for key, data in report.items():
    print(f"{key}: {data['coverage']}")
    if data["missing_ids"]:
        print(f"  Missing on: {data['missing_ids'][:5]}...")

# Output:
# height: 45/45 (100.0%)
# width: 45/45 (100.0%)
# material: 42/45 (93.3%)
#   Missing on: ['wall-012', 'wall-023', 'wall-044']...
# fire_rating: 30/45 (66.7%)
#   Missing on: ['wall-003', 'wall-005', 'wall-008', 'wall-012', 'wall-015']...
```

## Example 7: Cross-Version Drift Detection

```python
# Load two versions of the same model
transport = ServerTransport(stream_id="your-stream-id", client=client)
old_version = operations.receive(old_commit_id, transport)
new_version = operations.receive(new_commit_id, transport)

old_objects = []
new_objects = []
flatten(old_version)  # populates old_objects
flatten(new_version)  # populates new_objects

drift = detect_drift(old_objects, new_objects)
print(f"Added:     {len(drift['added'])} objects")
print(f"Removed:   {len(drift['removed'])} objects")
print(f"Modified:  {len(drift['modified'])} objects")
print(f"Unchanged: {drift['unchanged']} objects")

# Investigate removed objects
if drift["removed"]:
    print("\nREMOVED objects (may indicate unintended deletion):")
    for app_id in drift["removed"]:
        old_obj = old_map[app_id]
        print(f"  - {app_id}: {getattr(old_obj, 'speckle_type', '?')}")
```

## Example 8: Collection Tree Cycle Detection

```python
# BAD: Creating a cycle
coll_a = Collection(name="Floor 1", elements=[], collectionType="level")
coll_b = Collection(name="Walls", elements=[], collectionType="category")

coll_a.elements.append(coll_b)
coll_b.elements.append(coll_a)  # CYCLE -- coll_a -> coll_b -> coll_a

errors = validate_collection_tree(coll_a)
# Result: ["Cycle detected at depth 2: Floor 1"]

# GOOD: Proper tree structure
coll_a = Collection(name="Floor 1", elements=[], collectionType="level")
coll_b = Collection(name="Walls", elements=[], collectionType="category")
coll_c = Collection(name="Doors", elements=[], collectionType="category")

coll_a.elements.append(coll_b)
coll_a.elements.append(coll_c)

errors = validate_collection_tree(coll_a)
# Result: [] (no errors)
```

## Example 9: displayValue Validation

```python
# BAD: displayValue is not a list
obj = Base()
obj.speckle_type = "Objects.Data.DataObject"
obj["displayValue"] = Mesh(vertices=[0,0,0], faces=[3,0,0,0], units="m")  # Single object, not a list

errors = validate_display_value(obj)
# Result: ["displayValue must be a list, got Mesh"]

# BAD: Non-geometry object in displayValue
obj2 = Base()
obj2.speckle_type = "Objects.Data.DataObject"
nested_data = Base()
nested_data.speckle_type = "Objects.Data.DataObject"
obj2["displayValue"] = [nested_data]

errors = validate_display_value(obj2)
# Result: ["displayValue[0]: type 'Objects.Data.DataObject' is not a geometry type"]

# BAD: Geometry without units in displayValue
mesh_no_units = Mesh(vertices=[0,0,0,1,0,0,1,1,0], faces=[3,0,1,2])
obj3 = Base()
obj3.speckle_type = "Objects.Data.DataObject"
obj3["displayValue"] = [mesh_no_units]

errors = validate_display_value(obj3)
# Result: ["displayValue[0]: missing units"]
```

## Example 10: C# Pre-Flight Validation

```csharp
using Speckle.Sdk.Models;
using Speckle.Objects.Geometry;
using Speckle.Objects.Other;

public class SpeckleValidator
{
    public static List<string> ValidateMesh(Mesh mesh)
    {
        var errors = new List<string>();

        if (mesh.vertices == null || mesh.vertices.Count == 0)
        {
            errors.Add("Mesh has no vertices");
            return errors;
        }

        if (mesh.vertices.Count % 3 != 0)
            errors.Add($"Vertices count {mesh.vertices.Count} not divisible by 3");

        int vertexCount = mesh.vertices.Count / 3;

        if (mesh.faces == null || mesh.faces.Count == 0)
        {
            errors.Add("Mesh has no faces");
            return errors;
        }

        int i = 0;
        int faceIndex = 0;
        while (i < mesh.faces.Count)
        {
            int n = mesh.faces[i];
            if (n < 3)
                errors.Add($"Face {faceIndex}: vertex count {n} < 3");

            for (int j = 1; j <= n && i + j < mesh.faces.Count; j++)
            {
                int idx = mesh.faces[i + j];
                if (idx < 0 || idx >= vertexCount)
                    errors.Add($"Face {faceIndex}: index {idx} out of bounds");
            }

            i += n + 1;
            faceIndex++;
        }

        if (string.IsNullOrEmpty(mesh.units))
            errors.Add("Mesh has no units set");

        return errors;
    }

    public static bool PreFlightCheck(Collection root, List<Base> proxies)
    {
        var allErrors = new List<string>();
        allErrors.AddRange(ValidateBaseObject(root));

        // Walk collection tree and validate each object
        void Walk(Base node)
        {
            allErrors.AddRange(ValidateBaseObject(node));

            if (node is Mesh mesh)
                allErrors.AddRange(ValidateMesh(mesh));

            if (node is Collection coll && coll.elements != null)
            {
                foreach (var child in coll.elements)
                    Walk(child);
            }
        }

        Walk(root);

        if (allErrors.Count > 0)
        {
            Console.WriteLine($"Pre-flight FAILED: {allErrors.Count} errors");
            foreach (var err in allErrors)
                Console.WriteLine($"  - {err}");
            return false;
        }

        return true;
    }
}
```
