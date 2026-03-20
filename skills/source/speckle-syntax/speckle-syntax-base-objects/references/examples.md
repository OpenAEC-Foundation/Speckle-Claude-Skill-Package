# Working Code Examples

## Example 1: Create a Point and Send It

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Point
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.api.client import SpeckleClient
import os

# Authenticate
client = SpeckleClient(host="app.speckle.systems")
client.authenticate_with_token(os.environ["SPECKLE_TOKEN"])

# Create geometry
p1 = Point(x=0.0, y=0.0, z=0.0, units="m")
p2 = Point(x=10.0, y=0.0, z=0.0, units="m")
p3 = Point(x=10.0, y=10.0, z=0.0, units="m")

# ALWAYS wrap in a Base container for viewer visibility
container = Base()
container["points"] = [p1, p2, p3]

# Send
transport = ServerTransport(stream_id="PROJECT_ID", client=client)
object_id = operations.send(base=container, transports=[transport])
print(f"Sent object: {object_id}")
```

### C#

```csharp
using Speckle.Sdk.Models;
using Speckle.Objects.Geometry;
using Speckle.Sdk.Transports;
using Speckle.Sdk.Api;

var account = new Account
{
    token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
    serverInfo = new ServerInfo { url = "https://app.speckle.systems/" }
};

var p1 = new Point(0, 0, 0, "m");
var p2 = new Point(10, 0, 0, "m");
var p3 = new Point(10, 10, 0, "m");

// ALWAYS wrap in a Base container
var container = new Base();
container["points"] = new List<Point> { p1, p2, p3 };

var transport = new ServerTransport(account, "PROJECT_ID");
var objectId = await Operations.Send(container, transport);
Console.WriteLine($"Sent object: {objectId}");
```

---

## Example 2: Create a Line

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Point, Line

start = Point(x=0.0, y=0.0, z=0.0, units="m")
end = Point(x=15.0, y=0.0, z=0.0, units="m")

line = Line(start=start, end=end, units="m")

# Wrap for viewer rendering
container = Base()
container["beamAxis"] = line
```

### C#

```csharp
using Speckle.Objects.Geometry;
using Speckle.Sdk.Models;

var line = new Line
{
    start = new Point(0, 0, 0, "m"),
    end = new Point(15, 0, 0, "m"),
    units = "m"
};

var container = new Base();
container["beamAxis"] = line;
```

---

## Example 3: Create a Mesh (Quad)

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Mesh

# A single quad face (4 vertices)
mesh = Mesh(
    vertices=[
        0.0, 0.0, 0.0,   # vertex 0
        10.0, 0.0, 0.0,   # vertex 1
        10.0, 10.0, 0.0,  # vertex 2
        0.0, 10.0, 0.0    # vertex 3
    ],
    faces=[4, 0, 1, 2, 3],  # quad: 4 vertices, indices 0-3
    colors=[],
    units="m"
)

container = Base()
container["@floorSurface"] = mesh  # @ prefix = detached
```

### C#

```csharp
using Speckle.Objects.Geometry;
using Speckle.Sdk.Models;

var mesh = new Mesh
{
    vertices = new List<double>
    {
        0, 0, 0,    // vertex 0
        10, 0, 0,   // vertex 1
        10, 10, 0,  // vertex 2
        0, 10, 0    // vertex 3
    },
    faces = new List<int> { 4, 0, 1, 2, 3 },
    colors = new List<int>(),
    units = "m"
};

var container = new Base();
container["@floorSurface"] = mesh;  // @ prefix = detached
```

---

## Example 4: Create a Mesh (Two Triangles)

### Python

```python
from specklepy.objects.geometry import Mesh

# Two triangles forming a square
mesh = Mesh(
    vertices=[
        0.0, 0.0, 0.0,   # vertex 0
        10.0, 0.0, 0.0,   # vertex 1
        10.0, 10.0, 0.0,  # vertex 2
        0.0, 10.0, 0.0    # vertex 3
    ],
    faces=[
        3, 0, 1, 2,  # triangle 1
        3, 0, 2, 3   # triangle 2
    ],
    colors=[],
    units="m"
)

# Vertex count
print(f"Vertices: {len(mesh.vertices) // 3}")  # 4
```

### C#

```csharp
var mesh = new Mesh
{
    vertices = new List<double> { 0,0,0, 10,0,0, 10,10,0, 0,10,0 },
    faces = new List<int>
    {
        3, 0, 1, 2,  // triangle 1
        3, 0, 2, 3   // triangle 2
    },
    colors = new List<int>(),
    units = "m"
};
```

---

## Example 5: Create a Collection Hierarchy

### Python

```python
from specklepy.objects import Base
from specklepy.objects.other import Collection
from specklepy.objects.geometry import Mesh

# Create meshes for walls
wall_mesh_1 = Mesh(vertices=[...], faces=[...], colors=[], units="m")
wall_mesh_2 = Mesh(vertices=[...], faces=[...], colors=[], units="m")

# Create wall objects with displayValue
wall_1 = Base()
wall_1["name"] = "Wall A"
wall_1["@displayValue"] = [wall_mesh_1]

wall_2 = Base()
wall_2["name"] = "Wall B"
wall_2["@displayValue"] = [wall_mesh_2]

# Organize into collections
walls_collection = Collection(
    name="Walls",
    collectionType="category",
    elements=[wall_1, wall_2]
)

root = Collection(
    name="Architecture Model",
    collectionType="root",
    elements=[walls_collection]
)

# Send root collection
transport = ServerTransport(stream_id="PROJECT_ID", client=client)
object_id = operations.send(base=root, transports=[transport])
```

### C#

```csharp
using Speckle.Sdk.Models;
using Speckle.Objects.Other;
using Speckle.Objects.Geometry;

var wallMesh1 = new Mesh { vertices = ..., faces = ..., units = "m" };
var wallMesh2 = new Mesh { vertices = ..., faces = ..., units = "m" };

var wall1 = new Base();
wall1["name"] = "Wall A";
wall1["@displayValue"] = new List<Mesh> { wallMesh1 };

var wall2 = new Base();
wall2["name"] = "Wall B";
wall2["@displayValue"] = new List<Mesh> { wallMesh2 };

var wallsCollection = new Collection
{
    name = "Walls",
    collectionType = "category",
    elements = new List<Base> { wall1, wall2 }
};

var root = new Collection
{
    name = "Architecture Model",
    collectionType = "root",
    elements = new List<Base> { wallsCollection }
};

var transport = new ServerTransport(account, "PROJECT_ID");
var objectId = await Operations.Send(root, transport);
```

---

## Example 6: Domain Objects with displayValue (C#)

```csharp
using Speckle.Objects.BuiltElements;
using Speckle.Objects.Geometry;

// Create a Wall with visual geometry
var wallMesh = new Mesh
{
    vertices = new List<double>
    {
        0,0,0, 10,0,0, 10,0,3, 0,0,3,      // front face
        0,0.2,0, 10,0.2,0, 10,0.2,3, 0,0.2,3  // back face
    },
    faces = new List<int>
    {
        4, 0, 1, 2, 3,  // front
        4, 7, 6, 5, 4   // back
    },
    units = "m"
};

var wall = new Wall
{
    height = 3.0,
    baseOffset = 0.0,
    displayValue = new List<Base> { wallMesh }
};

// Create a Beam
var beamMesh = new Mesh
{
    vertices = new List<double> { /* beam geometry */ },
    faces = new List<int> { /* face definitions */ },
    units = "m"
};

var beam = new Beam
{
    displayValue = new List<Base> { beamMesh }
};

// Create a Floor
var floorMesh = new Mesh
{
    vertices = new List<double> { 0,0,0, 20,0,0, 20,15,0, 0,15,0 },
    faces = new List<int> { 4, 0, 1, 2, 3 },
    units = "m"
};

var floor = new Floor
{
    displayValue = new List<Base> { floorMesh }
};

// Organize and send
var root = new Collection
{
    name = "Building",
    collectionType = "root",
    elements = new List<Base> { wall, beam, floor }
};
```

---

## Example 7: Custom Typed Object (Python)

```python
from dataclasses import dataclass, field
from typing import List, Optional
from specklepy.objects import Base
from specklepy.objects.geometry import Mesh

@dataclass(kw_only=True)
class Pipe(Base, speckle_type="MEP.Pipe"):
    diameter: float = 0.0
    length: float = 0.0
    material: Optional[str] = None
    pressure_rating: float = 0.0

# Create instance
pipe = Pipe(
    diameter=0.15,
    length=5.0,
    material="Copper",
    pressure_rating=10.0
)

# Add dynamic properties
pipe["manufacturer"] = "ACME"
pipe["install_date"] = "2024-01-15"

# Add display geometry (detached)
pipe_mesh = Mesh(vertices=[...], faces=[...], colors=[], units="m")
pipe["@displayValue"] = [pipe_mesh]
```

---

## Example 8: Dynamic Properties with Detachment

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Mesh

obj = Base()

# Standard properties (serialized inline)
obj["name"] = "Foundation Slab"
obj["area"] = 150.0
obj["concrete_grade"] = "C30/37"

# Detached properties (stored separately, referenced by ID)
obj["@mainMesh"] = Mesh(vertices=[...], faces=[...], colors=[], units="m")
obj["@reinforcementMesh"] = Mesh(vertices=[...], faces=[...], colors=[], units="m")

# Private properties (EXCLUDED from serialization and hashing)
obj["__internal_cache"] = {"computed": True}

# Inspect properties
print(obj.get_dynamic_member_names())
# ['name', 'area', 'concrete_grade', '@mainMesh', '@reinforcementMesh']
# Note: __internal_cache is excluded
```

### C#

```csharp
var obj = new Base();

// Standard properties
obj["name"] = "Foundation Slab";
obj["area"] = 150.0;
obj["concrete_grade"] = "C30/37";

// Detached properties
obj["@mainMesh"] = mainMesh;
obj["@reinforcementMesh"] = reinforcementMesh;
```

---

## Example 9: Circle and Ellipse

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Circle, Ellipse, Plane, Point, Vector

# XY plane at origin
xy_plane = Plane(
    origin=Point(x=0, y=0, z=0, units="m"),
    normal=Vector(x=0, y=0, z=1, units="m"),
    xdir=Vector(x=1, y=0, z=0, units="m"),
    ydir=Vector(x=0, y=1, z=0, units="m"),
    units="m"
)

circle = Circle(plane=xy_plane, radius=2.5, units="m")

ellipse = Ellipse(
    plane=xy_plane,
    firstRadius=5.0,
    secondRadius=3.0,
    units="m"
)

container = Base()
container["column_profile"] = circle
container["opening_profile"] = ellipse
```

### C#

```csharp
var xyPlane = new Plane(
    new Point(0, 0, 0, "m"),
    new Vector(0, 0, 1, "m"),
    new Vector(1, 0, 0, "m"),
    new Vector(0, 1, 0, "m"),
    "m"
);

var circle = new Circle { plane = xyPlane, radius = 2.5, units = "m" };
var ellipse = new Ellipse
{
    plane = xyPlane,
    firstRadius = 5.0,
    secondRadius = 3.0,
    units = "m"
};

var container = new Base();
container["column_profile"] = circle;
container["opening_profile"] = ellipse;
```

---

## Example 10: Polyline Rectangle

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Polyline

# Closed rectangle: 10m x 5m
rectangle = Polyline(
    value=[
        0.0, 0.0, 0.0,
        10.0, 0.0, 0.0,
        10.0, 5.0, 0.0,
        0.0, 5.0, 0.0
    ],
    closed=True,
    units="m"
)

container = Base()
container["floorOutline"] = rectangle
```

### C#

```csharp
var rectangle = new Polyline
{
    value = new List<double>
    {
        0, 0, 0,
        10, 0, 0,
        10, 5, 0,
        0, 5, 0
    },
    closed = true,
    units = "m"
};

var container = new Base();
container["floorOutline"] = rectangle;
```
