# Constructor Signatures and Property Tables

## Base Class

### Python — `specklepy.objects.Base`

```python
@dataclass(kw_only=True)
class Base(_RegisteringBase):
    speckle_type = "Base"
    id: Union[str, None] = None
    applicationId: Union[str, None] = None
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_id` | `get_id(decompose: bool = False) -> str` | Computes SHA256 content hash. Expensive for large objects. |
| `get_children_count` | `get_children_count() -> int` | Counts all descendant Base objects |
| `get_member_names` | `get_member_names() -> List[str]` | Returns all properties (typed + dynamic) |
| `get_typed_member_names` | `get_typed_member_names() -> List[str]` | Returns class-defined properties only |
| `get_dynamic_member_names` | `get_dynamic_member_names() -> List[str]` | Returns runtime-added properties only |
| `get_serializable_attributes` | `get_serializable_attributes() -> dict` | Returns properties marked for serialization |
| `validate_prop_name` | `validate_prop_name(name: str) -> None` | Validates dynamic property name (raises on invalid) |
| `of_type` | `of_type(speckle_type: str, **kwargs) -> Base` | Factory: creates Base with specific speckle_type |

### C# — `Speckle.Sdk.Models.Base`

```csharp
[Serializable]
public class Base : DynamicBase, ISpeckleObject
{
    public string id { get; set; }
    public string applicationId { get; set; }
    public string speckle_type => TypeLoader.GetFullTypeString(GetType());
    public int totalChildrenCount { get; set; }
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetId` | `string GetId(bool decompose = false)` | Computes SHA256 content hash |
| `GetTotalChildrenCount` | `int GetTotalChildrenCount()` | Counts all descendant Base objects |
| Dictionary access | `obj["propertyName"]` | Get/set dynamic properties |
| Dynamic access | `((dynamic)obj).propertyName` | Get/set dynamic properties via dynamic casting |

---

## Point

### Python — `specklepy.objects.geometry.Point`

```python
Point(x: float = 0, y: float = 0, z: float = 0, units: str = "m")
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `x` | `float` | `0` | X coordinate |
| `y` | `float` | `0` | Y coordinate |
| `z` | `float` | `0` | Z coordinate |
| `units` | `str` | `"m"` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Point`

```csharp
new Point(double x, double y, double z, string units)
new Point() { x = 0, y = 0, z = 0, units = "m" }
```

| Property | Type | Description |
|----------|------|-------------|
| `x` | `double` | X coordinate |
| `y` | `double` | Y coordinate |
| `z` | `double` | Z coordinate |
| `units` | `string` | Measurement unit |

---

## Vector

### Python — `specklepy.objects.geometry.Vector`

```python
Vector(x: float = 0, y: float = 0, z: float = 0, units: str = "m")
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `x` | `float` | `0` | X component |
| `y` | `float` | `0` | Y component |
| `z` | `float` | `0` | Z component |
| `units` | `str` | `"m"` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Vector`

```csharp
new Vector(double x, double y, double z, string units)
```

---

## Line

### Python — `specklepy.objects.geometry.Line`

```python
Line(start: Point = None, end: Point = None, units: str = "m")
```

| Property | Type | Description |
|----------|------|-------------|
| `start` | `Point` | Start point |
| `end` | `Point` | End point |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Line`

```csharp
new Line() { start = p1, end = p2, units = "m" }
```

---

## Polyline

### Python — `specklepy.objects.geometry.Polyline`

```python
Polyline(value: List[float] = [], closed: bool = False, units: str = "m")
```

| Property | Type | Description |
|----------|------|-------------|
| `value` | `List[float]` | Flat coordinate list: `[x0,y0,z0, x1,y1,z1, ...]` |
| `closed` | `bool` | Whether polyline forms a closed loop |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Polyline`

```csharp
new Polyline()
{
    value = new List<double> { x0,y0,z0, x1,y1,z1, ... },
    closed = false,
    units = "m"
}
```

---

## Arc

### Python — `specklepy.objects.geometry.Arc`

```python
Arc(
    startPoint: Point = None,
    midPoint: Point = None,
    endPoint: Point = None,
    plane: Plane = None,
    units: str = "m"
)
```

| Property | Type | Description |
|----------|------|-------------|
| `startPoint` | `Point` | Arc start |
| `midPoint` | `Point` | Arc midpoint |
| `endPoint` | `Point` | Arc end |
| `plane` | `Plane` | Reference plane |
| `radius` | `float` | Arc radius (computed) |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Arc`

```csharp
new Arc()
{
    startPoint = p1, midPoint = p2, endPoint = p3,
    plane = plane, units = "m"
}
```

---

## Circle

### Python — `specklepy.objects.geometry.Circle`

```python
Circle(plane: Plane = None, radius: float = 0, units: str = "m")
```

| Property | Type | Description |
|----------|------|-------------|
| `plane` | `Plane` | Center plane (origin = center) |
| `radius` | `float` | Circle radius |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Circle`

```csharp
new Circle() { plane = plane, radius = 5.0, units = "m" }
```

---

## Ellipse

### Python — `specklepy.objects.geometry.Ellipse`

```python
Ellipse(
    plane: Plane = None,
    firstRadius: float = 0,
    secondRadius: float = 0,
    units: str = "m"
)
```

| Property | Type | Description |
|----------|------|-------------|
| `plane` | `Plane` | Center plane |
| `firstRadius` | `float` | Semi-major axis radius |
| `secondRadius` | `float` | Semi-minor axis radius |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Ellipse`

```csharp
new Ellipse()
{
    plane = plane, firstRadius = 5.0, secondRadius = 3.0, units = "m"
}
```

---

## Plane

### Python — `specklepy.objects.geometry.Plane`

```python
Plane(
    origin: Point = None,
    normal: Vector = None,
    xdir: Vector = None,
    ydir: Vector = None,
    units: str = "m"
)
```

| Property | Type | Description |
|----------|------|-------------|
| `origin` | `Point` | Plane origin |
| `normal` | `Vector` | Plane normal (Z direction) |
| `xdir` | `Vector` | X axis direction |
| `ydir` | `Vector` | Y axis direction |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Plane`

```csharp
new Plane(Point origin, Vector normal, Vector xdir, Vector ydir, string units)
```

---

## Box

### Python — `specklepy.objects.geometry.Box`

```python
Box(
    basePlane: Plane = None,
    xSize: Interval = None,
    ySize: Interval = None,
    zSize: Interval = None,
    units: str = "m"
)
```

| Property | Type | Description |
|----------|------|-------------|
| `basePlane` | `Plane` | Base plane |
| `xSize` | `Interval` | X dimension interval |
| `ySize` | `Interval` | Y dimension interval |
| `zSize` | `Interval` | Z dimension interval |
| `area` | `float` | Surface area |
| `volume` | `float` | Volume |
| `units` | `str` | Measurement unit |

### C# — `Speckle.Objects.Geometry.Box`

```csharp
new Box()
{
    basePlane = plane,
    xSize = new Interval(0, 10),
    ySize = new Interval(0, 5),
    zSize = new Interval(0, 3),
    units = "m"
}
```

---

## Mesh

### Python — `specklepy.objects.geometry.Mesh`

```python
Mesh(
    vertices: List[float] = [],
    faces: List[int] = [],
    colors: List[int] = [],
    textureCoordinates: List[float] = [],
    vertexNormals: List[float] = [],
    units: str = "m"
)
```

| Property | Type | Description |
|----------|------|-------------|
| `vertices` | `List[float]` | Flat array: `[x0,y0,z0, x1,y1,z1, ...]` |
| `faces` | `List[int]` | Face definitions: `[n, i0, i1, ..., n, i0, ...]` |
| `colors` | `List[int]` | Per-vertex ARGB colors |
| `textureCoordinates` | `List[float]` | UV coordinates |
| `vertexNormals` | `List[float]` | Per-vertex normal vectors |
| `units` | `str` | Measurement unit |

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_point` | `get_point(index: int) -> Point` | Returns vertex as Point object |
| `get_points` | `get_points() -> List[Point]` | Returns all vertices as Points |
| `get_face_vertices` | `get_face_vertices(face_index: int) -> List[Point]` | Vertices for a specific face |
| `calculate_area` | `calculate_area() -> float` | Surface area via cross products |
| `calculate_volume` | `calculate_volume() -> float` | Volume for closed meshes |
| `is_closed` | `is_closed() -> bool` | Checks mesh closure |

### C# — `Speckle.Objects.Geometry.Mesh`

```csharp
new Mesh()
{
    vertices = new List<double> { ... },
    faces = new List<int> { ... },
    colors = new List<int>(),
    units = "m"
}
```

Properties are marked with `[Chunkable(31250)]` and `[DetachProperty]` for efficient transport.

---

## Brep

### Python — `specklepy.objects.geometry.Brep`

```python
Brep(units: str = "m")
# Breps are complex NURBS objects generated by connectors.
# Manual construction is NOT recommended.
```

### C# — `Speckle.Objects.Geometry.Brep`

```csharp
new Brep() { units = "m" }
// Complex properties: Surfaces, Curves3D, Curves2D, Vertices, Edges, Loops, Faces, Trims
// ALWAYS include a displayValue with tessellated meshes for viewer rendering.
```

---

## Collection

### Python — `specklepy.objects.other.Collection`

```python
Collection(
    name: str = "",
    collectionType: str = "",
    elements: List[Base] = []
)
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `str` | Collection display name |
| `collectionType` | `str` | Free-form type string (`"layer"`, `"category"`, `"root"`) |
| `elements` | `List[Base]` | Child objects and nested collections |

### C# — `Speckle.Objects.Other.Collection`

```csharp
new Collection()
{
    name = "Architecture",
    collectionType = "layer",
    elements = new List<Base> { wall1, wall2 }
}
```

---

## Domain Objects (C# Only)

### Wall — `Speckle.Objects.BuiltElements.Wall`

| Property | Type | Description |
|----------|------|-------------|
| `height` | `double` | Wall height |
| `baseOffset` | `double` | Base offset from level |
| `displayValue` | `List<Base>` | Visual geometry (detached) |

### Floor — `Speckle.Objects.BuiltElements.Floor`

| Property | Type | Description |
|----------|------|-------------|
| `displayValue` | `List<Base>` | Visual geometry (detached) |

### Beam — `Speckle.Objects.BuiltElements.Beam`

| Property | Type | Description |
|----------|------|-------------|
| `displayValue` | `List<Base>` | Visual geometry (detached) |

### Column — `Speckle.Objects.BuiltElements.Column`

| Property | Type | Description |
|----------|------|-------------|
| `displayValue` | `List<Base>` | Visual geometry (detached) |

### Common Pattern

Every built element:
1. Inherits from `Base`
2. Defines semantic properties
3. Has `[DetachProperty] public List<Base> displayValue { get; set; }`
4. Has optional `bbox` property
