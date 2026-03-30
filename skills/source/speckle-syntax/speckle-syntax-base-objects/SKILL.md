---
name: speckle-syntax-base-objects
description: >
  Use when creating Speckle geometry (Point, Line, Mesh, Brep), collections, or domain objects (Wall, Floor, Beam).
  Prevents missing units on geometry, incorrect displayValue wrapping, and broken viewer rendering from unwrapped root objects.
  Covers Base object creation in Python and C#, geometry primitives, typed vs dynamic properties, Collections, displayValue, and Speckle.Objects domain classes.
  Keywords: speckle point, line, mesh, brep, polyline, collection, wall, floor, beam, geometry, displayValue, create object, make geometry, build mesh, create wall.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-syntax-base-objects

## Quick Reference

### Creating Base Objects

| SDK | Import | Constructor |
|-----|--------|------------|
| Python | `from specklepy.objects import Base` | `Base()` |
| C# | `using Speckle.Sdk.Models;` | `new Base()` |

### Geometry Primitives

| Type | speckle_type | Key Properties |
|------|-------------|----------------|
| Point | `Objects.Geometry.Point` | `x`, `y`, `z` (float), `units` |
| Vector | `Objects.Geometry.Vector` | `x`, `y`, `z` (float), `units` |
| Line | `Objects.Geometry.Line` | `start` (Point), `end` (Point), `units` |
| Polyline | `Objects.Geometry.Polyline` | `value` (flat coords), `closed`, `units` |
| Arc | `Objects.Geometry.Arc` | `startPoint`, `midPoint`, `endPoint`, `plane`, `units` |
| Circle | `Objects.Geometry.Circle` | `plane`, `radius`, `units` |
| Ellipse | `Objects.Geometry.Ellipse` | `plane`, `firstRadius`, `secondRadius`, `units` |
| Mesh | `Objects.Geometry.Mesh` | `vertices`, `faces`, `colors`, `units` |
| Brep | `Objects.Geometry.Brep` | complex NURBS boundary rep, `displayValue`, `units` |

### Valid Unit Strings

| String | Unit |
|--------|------|
| `"m"` | Meters (server default) |
| `"mm"` | Millimeters |
| `"cm"` | Centimeters |
| `"ft"` | Feet |
| `"in"` | Inches |

### Critical Warnings

**NEVER** create geometry objects without setting the `units` property. Missing units cause incorrect scaling in receiving applications -- a 3-meter wall renders as 3 millimeters.

**NEVER** send geometry primitives (Point, Line, Mesh) directly as the root object. The Speckle viewer will NOT render them. ALWAYS wrap geometry in a `Base` container with named properties.

**NEVER** use `.` or `/` in dynamic property names. These characters are prohibited and raise validation errors.

**NEVER** create cycles in Collection hierarchies. Collections MUST form a strict directed tree. Cycles cause infinite recursion during traversal.

**NEVER** call `get_id()` / `GetId()` in a loop on large objects. Each call triggers full recursive serialization -- use it once after all modifications are complete.

**NEVER** store large geometry inline without detachment. ALWAYS use the `@` prefix on dynamic properties or `[DetachProperty]` on typed properties for meshes and heavy geometry.

---

## Base Object Creation

### Python

```python
from specklepy.objects import Base

# Empty base object
obj = Base()

# Dynamic properties (dictionary-style)
obj["name"] = "My Object"
obj["height"] = 3.0
obj["@detachedMesh"] = some_mesh  # @ prefix = detached

# Dynamic properties (attribute-style)
obj.name = "My Object"
obj.height = 3.0

# Constructor with kwargs
obj = Base(name="My Object", height=3.0)
```

### C#

```csharp
using Speckle.Sdk.Models;

// Empty base object
var obj = new Base();

// Dynamic properties (dictionary-style)
obj["name"] = "My Object";
obj["height"] = 3.0;
obj["@detachedMesh"] = someMesh;  // @ prefix = detached

// Dynamic properties (dynamic casting)
((dynamic)obj).name = "My Object";
```

---

## Typed Properties (Subclassing Base)

### Python

```python
from dataclasses import dataclass
from typing import Optional, List
from specklepy.objects import Base

@dataclass(kw_only=True)
class CustomWall(Base, speckle_type="MyApp.CustomWall"):
    height: float = 0.0
    width: float = 0.0
    material: Optional[str] = None

wall = CustomWall(height=3.0, width=0.2, material="Concrete")
```

### C#

```csharp
using Speckle.Sdk.Models;

public class CustomWall : Base
{
    public double height { get; set; }
    public double width { get; set; }
    public string material { get; set; }

    [DetachProperty]
    public List<Base> displayValue { get; set; }
}

var wall = new CustomWall
{
    height = 3.0,
    width = 0.2,
    material = "Concrete"
};
```

---

## Dynamic vs Typed Properties

| Aspect | Typed Properties | Dynamic Properties |
|--------|-----------------|-------------------|
| Definition | Class declaration with type hints | Added at runtime |
| Validation | Type-checked on assignment | No validation |
| Discovery | `get_typed_member_names()` | `get_dynamic_member_names()` |
| Serialization | ALWAYS serialized | ALWAYS serialized |
| Detachment | `[DetachProperty]` attribute (C#) | `@` prefix on name |

### Property Name Rules

- NEVER use empty strings as property names
- NEVER use consecutive `@` symbols (`@@`)
- NEVER use `.` or `/` in property names
- Single `@` prefix is valid (marks detachment)
- Properties prefixed with `__` (double underscore) are EXCLUDED from serialization and hashing

### Property Introspection (Python)

```python
obj.get_member_names()         # All properties (typed + dynamic)
obj.get_typed_member_names()   # Class-defined properties only
obj.get_dynamic_member_names() # Runtime-added properties only
```

---

## Geometry Primitives

### Point

```python
from specklepy.objects.geometry import Point

p = Point(x=1.0, y=2.0, z=3.0, units="m")
```

```csharp
using Speckle.Objects.Geometry;

var p = new Point(1.0, 2.0, 3.0, "m");
```

### Line

```python
from specklepy.objects.geometry import Point, Line

line = Line(
    start=Point(x=0, y=0, z=0, units="m"),
    end=Point(x=10, y=0, z=0, units="m"),
    units="m"
)
```

```csharp
var line = new Line
{
    start = new Point(0, 0, 0, "m"),
    end = new Point(10, 0, 0, "m"),
    units = "m"
};
```

### Polyline

```python
from specklepy.objects.geometry import Polyline

# Flat coordinate list: [x0,y0,z0, x1,y1,z1, ...]
polyline = Polyline(
    value=[0,0,0, 10,0,0, 10,10,0, 0,10,0],
    closed=True,
    units="m"
)
```

```csharp
var polyline = new Polyline
{
    value = new List<double> { 0,0,0, 10,0,0, 10,10,0, 0,10,0 },
    closed = true,
    units = "m"
};
```

### Arc, Circle, Ellipse

All curve types require a `Plane` (origin, normal, xdir, ydir). See [references/examples.md](references/examples.md) for full construction examples.

```python
# Python: Arc
arc = Arc(startPoint=p1, midPoint=p2, endPoint=p3, plane=xy_plane, units="m")

# Python: Circle
circle = Circle(plane=xy_plane, radius=5.0, units="m")

# Python: Ellipse
ellipse = Ellipse(plane=xy_plane, firstRadius=5.0, secondRadius=3.0, units="m")
```

```csharp
// C# — Arc
var arc = new Arc { startPoint = p1, midPoint = p2, endPoint = p3, plane = xyPlane, units = "m" };

// C# — Circle
var circle = new Circle { plane = xyPlane, radius = 5.0, units = "m" };

// C# — Ellipse
var ellipse = new Ellipse { plane = xyPlane, firstRadius = 5.0, secondRadius = 3.0, units = "m" };
```

### Mesh

```python
from specklepy.objects.geometry import Mesh

mesh = Mesh(
    vertices=[0,0,0, 10,0,0, 10,10,0, 0,10,0],  # flat [x,y,z,...]
    faces=[4, 0, 1, 2, 3],                         # [n, i0, i1, ..., n, ...]
    colors=[],
    units="m"
)
```

```csharp
var mesh = new Mesh
{
    vertices = new List<double> { 0,0,0, 10,0,0, 10,10,0, 0,10,0 },
    faces = new List<int> { 4, 0, 1, 2, 3 },
    colors = new List<int>(),
    units = "m"
};
```

**Vertex encoding**: Every 3 consecutive values = one point (x, y, z). Vertex count = `len(vertices) // 3`.

**Face encoding**: Each face starts with vertex count `n`, followed by `n` vertex indices:
- Triangle: `[3, 0, 1, 2]`
- Quad: `[4, 0, 1, 2, 3]`
- N-gon: `[n, i0, i1, ..., i(n-1)]`

### Brep

Brep (Boundary Representation) objects are complex NURBS geometry. In practice, connectors ALWAYS tessellate Breps to Meshes for `displayValue`. NEVER construct Brep objects manually unless implementing a native connector.

```python
from specklepy.objects.geometry import Brep

# Breps are generated by connectors, not built manually.
# The displayValue contains tessellated meshes for viewer rendering.
brep = Brep(units="m")
brep["@displayValue"] = [tessellated_mesh]
```

```csharp
var brep = new Brep { units = "m" };
brep["@displayValue"] = new List<Mesh> { tessellatedMesh };
```

---

## displayValue: Visual Representation

Every semantic object (wall, beam, floor) stores its visual geometry in `displayValue` as a list of geometry primitives. The viewer renders objects using `displayValue`.

### Rules

- `displayValue` ALWAYS contains geometry primitives (Mesh, Line, Point)
- A single object can have MULTIPLE geometry items in `displayValue`
- `displayValue` MUST be detached for efficient transport
- Applications that understand the semantic type MAY reconstruct native geometry; all others use `displayValue`

### Python

```python
container = Base()
container["@displayValue"] = [mesh1, mesh2]  # @ = detached
```

### C#

```csharp
// Typed property with [DetachProperty] attribute
public class MyElement : Base
{
    [DetachProperty]
    public List<Base> displayValue { get; set; }
}

var element = new MyElement();
element.displayValue = new List<Base> { mesh1, mesh2 };
```

---

## Collections

Collections group objects into hierarchical trees.

### Python

```python
from specklepy.objects.other import Collection

# Create a collection
architecture = Collection(
    name="Architecture",
    collectionType="layer",
    elements=[]
)

# Add objects
architecture.elements.append(wall1)
architecture.elements.append(wall2)

# Nested collections
root = Collection(
    name="Root",
    collectionType="root",
    elements=[architecture, structure_collection]
)
```

### C#

```csharp
using Speckle.Objects.Other;

var architecture = new Collection
{
    name = "Architecture",
    collectionType = "layer",
    elements = new List<Base> { wall1, wall2 }
};

var root = new Collection
{
    name = "Root",
    collectionType = "root",
    elements = new List<Base> { architecture, structureCollection }
};
```

### Collection Rules

- Collections MUST form a strict directed tree (no cycles, no shared parents)
- The root Collection is the top-level container sent to Speckle
- `collectionType` is a free-form string: `"layer"`, `"category"`, `"group"`, `"root"`
- `elements` contains child objects and nested collections

---

## Wrapping in Root Container

To make objects visible in the Speckle viewer, ALWAYS wrap them in a root Base or Collection object.

### Python

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Point, Line

# WRONG: Sending a Line directly -- viewer will NOT render it
# operations.send(base=line, transports=[transport])

# CORRECT: Wrap in a Base container
container = Base()
container["myLine"] = line
container["myPoints"] = [p1, p2, p3]
object_id = operations.send(base=container, transports=[transport])
```

### C#

```csharp
// WRONG: Sending a Mesh directly
// await Operations.Send(mesh, transport);

// CORRECT: Wrap in a Base container
var container = new Base();
container["myMesh"] = mesh;
container["myLines"] = new List<Line> { line1, line2 };
var objectId = await Operations.Send(container, transport);
```

---

## Domain Objects (C# Speckle.Objects)

The `Speckle.Objects` NuGet package provides typed AEC domain classes. Python uses `DataObject` or dynamic `Base` objects instead.

```csharp
using Speckle.Objects.BuiltElements;

var wall = new Wall { height = 3.0, baseOffset = 0.0, displayValue = new List<Base> { wallMesh } };
var floor = new Floor { displayValue = new List<Base> { floorMesh } };
var beam = new Beam { displayValue = new List<Base> { beamMesh } };
var column = new Column { displayValue = new List<Base> { columnMesh } };
```

Every built element: inherits from `Base`, defines semantic properties, has a detached `displayValue` with geometry, and an optional `bbox`.

---

## The Detaching Mechanism

Detaching stores child objects separately, referencing them by ID. This enables deduplication, lazy loading, and efficient transfer.

### Two Methods

**Method 1: `@` prefix on dynamic property names**
```python
obj["@displayMesh"] = mesh  # Detached during serialization
```

**Method 2: `[DetachProperty]` attribute on typed properties (C#)**
```csharp
[DetachProperty]
public List<Base> displayValue { get; set; }
```

### When to Detach

- ALWAYS detach `displayValue` geometry
- ALWAYS detach large nested objects (meshes, point clouds)
- ALWAYS detach properties containing lists of Base objects

---

## Reference Links

- [references/methods.md](references/methods.md) -- Constructor signatures and property tables for all geometry types
- [references/examples.md](references/examples.md) -- Complete working code examples
- [references/anti-patterns.md](references/anti-patterns.md) -- Object creation mistakes and corrections

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview
- https://docs.speckle.systems/developers/data-schema/geometry-schema
- https://speckle.guide/dev/base.html
- https://speckle.guide/dev/objects.html
- https://github.com/specklesystems/specklepy
- https://github.com/specklesystems/speckle-sharp-sdk
