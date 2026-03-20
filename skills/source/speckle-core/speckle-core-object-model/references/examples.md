# Working Code Examples (Speckle Object Model)

## Example 1: Creating a Basic Object with Dynamic Properties

### Python

```python
from specklepy.objects.base import Base

# Create a Base object with dynamic properties
obj = Base()
obj["name"] = "My Custom Object"
obj["height"] = 3.0
obj["material"] = "concrete"

# Verify properties
print(obj["name"])           # "My Custom Object"
print(obj.get_member_names())  # includes "name", "height", "material"
print(obj.get_dynamic_member_names())  # ["name", "height", "material"]
```

### C#

```csharp
using Speckle.Sdk.Models;

var obj = new Base();
obj["name"] = "My Custom Object";
obj["height"] = 3.0;
obj["material"] = "concrete";

// Also via dynamic casting
((dynamic)obj).anotherProp = 42;
```

---

## Example 2: Creating a Typed Subclass

### Python

```python
from dataclasses import dataclass, field
from typing import List
from specklepy.objects.base import Base

@dataclass(kw_only=True)
class CustomBeam(Base):
    speckle_type = "Custom.Beam"
    length: float = 0.0
    width: float = 0.0
    height: float = 0.0
    material: str = "steel"

beam = CustomBeam(length=6.0, width=0.3, height=0.5, material="steel")
beam.applicationId = "beam-001"

# Typed properties
print(beam.get_typed_member_names())  # ["length", "width", "height", "material"]

# Dynamic properties work too
beam["loadCapacity"] = 500.0
print(beam.get_dynamic_member_names())  # ["loadCapacity"]
```

### C#

```csharp
using Speckle.Sdk.Models;

public class CustomBeam : Base
{
    public double length { get; set; }
    public double width { get; set; }
    public double height { get; set; }
    public string material { get; set; }
}

var beam = new CustomBeam
{
    length = 6.0,
    width = 0.3,
    height = 0.5,
    material = "steel",
    applicationId = "beam-001"
};

// Dynamic property
beam["loadCapacity"] = 500.0;
```

---

## Example 3: Detaching Properties

### Python — Dynamic Properties with @ Prefix

```python
from specklepy.objects.base import Base
from specklepy.objects.geometry.mesh import Mesh

# Create geometry
mesh = Mesh(
    vertices=[0, 0, 0, 1, 0, 0, 1, 0, 3, 0, 0, 3],
    faces=[4, 0, 1, 2, 3],
    units="m"
)

# Create semantic object with detached geometry
wall = Base()
wall["name"] = "Wall A"
wall["height"] = 3.0
wall["@displayMesh"] = mesh  # @ prefix = detached during serialization
# The @ is stripped from the property name in the final output.
# The mesh is stored separately; the wall stores only a reference.
```

### C# — Typed Properties with [DetachProperty]

```csharp
using Speckle.Sdk.Models;
using Speckle.Objects.Geometry;

public class Wall : Base
{
    public double height { get; set; }
    public double baseOffset { get; set; }

    [DetachProperty]
    public List<Base> displayValue { get; set; }
}

var mesh = new Mesh
{
    vertices = new List<double> { 0, 0, 0, 1, 0, 0, 1, 0, 3, 0, 0, 3 },
    faces = new List<int> { 4, 0, 1, 2, 3 },
    units = "m"
};

var wall = new Wall
{
    height = 3.0,
    baseOffset = 0.0,
    displayValue = new List<Base> { mesh }
};
```

---

## Example 4: Building a DataObject

### Python

```python
from specklepy.objects.data_objects import DataObject
from specklepy.objects.geometry.mesh import Mesh

# Create display geometry
mesh = Mesh(
    vertices=[0, 0, 0, 5, 0, 0, 5, 3, 0, 0, 3, 0],
    faces=[4, 0, 1, 2, 3],
    units="m"
)

# Create semantic object
door = DataObject(
    name="Main Entrance Door",
    properties={
        "width": 1.2,
        "height": 2.4,
        "material": "oak",
        "fireRating": "60min"
    },
    displayValue=[mesh]
)
door.applicationId = "door-42"
```

### C#

```csharp
using Speckle.Objects.Data;

var door = new DataObject
{
    name = "Main Entrance Door",
    properties = new Dictionary<string, object>
    {
        { "width", 1.2 },
        { "height", 2.4 },
        { "material", "oak" },
        { "fireRating", "60min" }
    },
    displayValue = new List<Base> { mesh },
    applicationId = "door-42"
};
```

---

## Example 5: Organizing Objects in Collections

### Python

```python
from specklepy.objects.other import Collection

# Create leaf objects
wall_a = DataObject(name="Wall A", displayValue=[mesh_a])
wall_b = DataObject(name="Wall B", displayValue=[mesh_b])
door = DataObject(name="Door 1", displayValue=[mesh_door])

# Create a collection for the floor
floor_1 = Collection(
    name="Floor 1",
    collectionType="Floor",
    elements=[wall_a, wall_b, door]
)

# Create root collection (this is what you send to Speckle)
root = Collection(
    name="My Building Model",
    collectionType="Model",
    elements=[floor_1]
)
```

### C#

```csharp
using Speckle.Objects.Organization;

var floor1 = new Collection
{
    name = "Floor 1",
    collectionType = "Floor",
    elements = new List<Base> { wallA, wallB, door }
};

var root = new Collection
{
    name = "My Building Model",
    collectionType = "Model",
    elements = new List<Base> { floor1 }
};
```

---

## Example 6: Using Proxy Types

### ColorProxy — Python

```python
from specklepy.objects.proxies import ColorProxy

# Assign color to multiple objects by their applicationId
red_objects = ColorProxy(
    objects=["wall-001", "wall-002", "beam-005"],
    value=0xFFFF0000,  # ARGB: fully opaque red
    name="Fire-rated elements"
)
```

### RenderMaterialProxy — Python

```python
from specklepy.objects.proxies import RenderMaterialProxy

material_proxy = RenderMaterialProxy(
    objects=["wall-001", "wall-002"],
    value=render_material_instance
)
```

### InstanceProxy — Python (Repeated Geometry)

```python
from specklepy.objects.proxies import InstanceProxy, InstanceDefinitionProxy

# Define the geometry once
chair_def = InstanceDefinitionProxy(
    objects=["leg-1", "leg-2", "leg-3", "leg-4", "seat"],
    name="Office Chair",
    maxDepth=1
)

# Place 3 instances with different transforms (4x4 matrix as 16 floats)
chair_1 = InstanceProxy(
    definitionId=chair_def.applicationId,
    transform=[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],  # identity
    maxDepth=1
)

chair_2 = InstanceProxy(
    definitionId=chair_def.applicationId,
    transform=[1, 0, 0, 2.0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],  # translated X+2
    maxDepth=1
)
```

---

## Example 7: Creating a Mesh with Proper Units

### Python

```python
from specklepy.objects.geometry.mesh import Mesh

# Triangle mesh: two triangles forming a quad
mesh = Mesh(
    vertices=[
        0.0, 0.0, 0.0,   # vertex 0
        1.0, 0.0, 0.0,   # vertex 1
        1.0, 1.0, 0.0,   # vertex 2
        0.0, 1.0, 0.0,   # vertex 3
    ],
    faces=[
        3, 0, 1, 2,       # triangle 1
        3, 0, 2, 3,       # triangle 2
    ],
    units="m"  # ALWAYS set units
)

# Inspect the mesh
print(mesh.vertices_count)       # 4
print(mesh.get_point(0))         # Point(x=0, y=0, z=0)
print(mesh.calculate_area())     # 1.0 (square meter)
```

---

## Example 8: Inspecting Object Properties

### Python

```python
obj = Base()
obj["name"] = "Test"
obj["height"] = 5.0
obj["@detachedChild"] = some_base_object

# List all properties
all_props = obj.get_member_names()
# Returns: ["id", "applicationId", "name", "height", "@detachedChild"]

# Only dynamic properties
dynamic = obj.get_dynamic_member_names()
# Returns: ["name", "height", "@detachedChild"]

# Only typed properties
typed = obj.get_typed_member_names()
# Returns: ["id", "applicationId"]

# Compute the content hash (AFTER all modifications)
obj_id = obj.get_id()
print(obj_id)  # SHA256 hash string
```

---

## Example 9: Using Base.of_type Factory

### Python

```python
from specklepy.objects.base import Base

# Create a Base with a custom speckle_type without defining a class
custom_obj = Base.of_type(
    "Custom.Domain.Equipment",
    name="Pump Station A",
    capacity=500.0,
    units="liters_per_second"
)

print(custom_obj.speckle_type)  # "Custom.Domain.Equipment"
print(custom_obj["name"])       # "Pump Station A"
```

This is useful for quick prototyping or when you do not need a full class hierarchy.
