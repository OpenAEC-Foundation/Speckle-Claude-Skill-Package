# API Signatures Reference (Speckle Object Model)

## Base Class — Python (SpecklePy)

```python
@dataclass(kw_only=True)
class Base(_RegisteringBase):
    speckle_type = "Base"
    id: Union[str, None] = None
    applicationId: Union[str, None] = None

    def get_id(self, decompose: bool = False) -> str
        # Computes SHA256 content hash via full serialization.
        # NEVER call in a loop -- expensive for large hierarchies.

    def get_children_count(self) -> int
        # Recursively counts all descendant Base objects.

    def get_member_names(self) -> List[str]
        # Returns ALL property names (typed + dynamic).

    def get_typed_member_names(self) -> List[str]
        # Returns only class-defined, type-hinted property names.

    def get_dynamic_member_names(self) -> List[str]
        # Returns only runtime-added dynamic property names.

    def get_serializable_attributes(self) -> dict
        # Returns properties marked for serialization with their metadata.

    @staticmethod
    def validate_prop_name(name: str) -> None
        # Validates dynamic property names.
        # Rejects: empty strings, consecutive @@, names with . or /

    @classmethod
    def of_type(cls, speckle_type: str, **kwargs) -> "Base"
        # Factory: creates a Base instance with a specific speckle_type.

    def __getitem__(self, name: str) -> Any
        # Dictionary-style read: obj["propertyName"]

    def __setitem__(self, name: str, value: Any) -> None
        # Dictionary-style write: obj["propertyName"] = value
        # Validates name before setting.
```

---

## Base Class — C# (Speckle.Sdk)

```csharp
[Serializable]
public class Base : DynamicBase, ISpeckleObject
{
    // Core identity properties
    public string id { get; set; }
    public string applicationId { get; set; }
    public string speckle_type => TypeLoader.GetFullTypeString(GetType());
    public int totalChildrenCount { get; set; }

    // Hash computation -- triggers full recursive serialization
    // NEVER call in a loop for large hierarchies
    public string GetId(bool decompose = false);

    // Recursive child count
    public int GetTotalChildrenCount();

    // Dynamic property access (from DynamicBase)
    public object this[string key] { get; set; }

    // Property name validation
    public static bool IsPropNameValid(string name, out string reason);
}
```

### Detachment Attributes (C#)

```csharp
// Marks a typed property for detached serialization
[AttributeUsage(AttributeTargets.Property)]
public class DetachPropertyAttribute : Attribute { }

// Marks a list property for chunked serialization
[AttributeUsage(AttributeTargets.Property)]
public class ChunkableAttribute : Attribute
{
    public int MaxObjCountPerChunk { get; }
    public ChunkableAttribute(int maxObjCount = 1000);
}

// Usage on typed properties:
[DetachProperty]
public List<Base> displayValue { get; set; }

[Chunkable(31250)]
[DetachProperty]
public List<double> vertices { get; set; }
```

---

## DataObject — Python

```python
@dataclass(kw_only=True)
class DataObject(Base):
    speckle_type = "Objects.Data.DataObject"
    name: str = ""
    properties: Dict[str, object] = field(default_factory=dict)
    displayValue: List[Base] = field(default_factory=list)  # detachable
```

### Application-Specific Subclasses

```python
@dataclass(kw_only=True)
class QgisObject(DataObject):
    speckle_type = "Objects.Data.QgisObject"
    type: str = ""

@dataclass(kw_only=True)
class BlenderObject(DataObject):
    speckle_type = "Objects.Data.BlenderObject"
    type: str = ""
```

---

## DataObject — C#

```csharp
public class DataObject : Base
{
    public string name { get; set; }
    public Dictionary<string, object> properties { get; set; }

    [DetachProperty]
    public List<Base> displayValue { get; set; }
}
```

---

## Collection — Python

```python
@dataclass(kw_only=True)
class Collection(Base):
    speckle_type = "Objects.Organization.Collection"
    name: str = ""
    collectionType: str = ""
    elements: List[Base] = field(default_factory=list)  # detachable
```

---

## Collection — C#

```csharp
public class Collection : Base
{
    public string name { get; set; }
    public string collectionType { get; set; }

    [DetachProperty]
    public List<Base> elements { get; set; }
}
```

**Constraint**: Collections MUST form a strict directed tree. No cycles, no shared parents.

---

## Proxy Types — Python

### ColorProxy

```python
@dataclass(kw_only=True)
class ColorProxy(Base):
    speckle_type = "Speckle.Core.Models.Proxies.ColorProxy"
    objects: List[str] = field(default_factory=list)  # applicationIds, detachable
    value: int = 0          # ARGB color as integer
    name: Optional[str] = None
```

### GroupProxy

```python
@dataclass(kw_only=True)
class GroupProxy(Base):
    speckle_type = "Speckle.Core.Models.Proxies.GroupProxy"
    objects: List[str] = field(default_factory=list)  # applicationIds, detachable
    name: str = ""
```

### InstanceProxy

```python
@dataclass(kw_only=True)
class InstanceProxy(Base):
    speckle_type = "Speckle.Core.Models.Instances.InstanceProxy"
    definitionId: str = ""               # references an InstanceDefinitionProxy
    transform: List[float] = field(default_factory=list)  # 4x4 matrix, 16 floats
    maxDepth: int = 0
```

### InstanceDefinitionProxy

```python
@dataclass(kw_only=True)
class InstanceDefinitionProxy(Base):
    speckle_type = "Speckle.Core.Models.Instances.InstanceDefinitionProxy"
    objects: List[str] = field(default_factory=list)  # applicationIds, detachable
    maxDepth: int = 0
    name: str = ""
```

### LevelProxy

```python
@dataclass(kw_only=True)
class LevelProxy(Base):
    speckle_type = "Objects.Other.LevelProxy"
    objects: List[str] = field(default_factory=list)  # applicationIds, detachable
    value: Base = None          # level data (elevation, name)
    applicationId: str = ""
```

### RenderMaterialProxy

```python
@dataclass(kw_only=True)
class RenderMaterialProxy(Base):
    speckle_type = "Objects.Other.RenderMaterialProxy"
    objects: List[str] = field(default_factory=list)  # applicationIds, detachable
    value: RenderMaterial = None
```

---

## Key Geometry Types — Python

### Point

```python
@dataclass(kw_only=True)
class Point(Base):
    speckle_type = "Objects.Geometry.Point"
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    units: str = "m"
```

### Mesh

```python
@dataclass(kw_only=True)
class Mesh(Base):
    speckle_type = "Objects.Geometry.Mesh"
    vertices: List[float] = field(default_factory=list)     # chunkable, detachable
    faces: List[int] = field(default_factory=list)           # chunkable, detachable
    colors: List[int] = field(default_factory=list)          # per-vertex ARGB
    textureCoordinates: List[float] = field(default_factory=list)
    vertexNormals: List[float] = field(default_factory=list)
    units: str = "m"

    @property
    def vertices_count(self) -> int
        # Returns len(vertices) // 3

    def get_point(self, index: int) -> Point
        # Returns vertex at index as Point object

    def get_points(self) -> List[Point]
        # Returns all vertices as Point objects

    def get_face_vertices(self, face_index: int) -> List[Point]
        # Returns vertices for a specific face

    def calculate_area(self) -> float
        # Computes surface area via cross products

    def calculate_volume(self) -> float
        # Computes volume for closed meshes

    def is_closed(self) -> bool
        # Checks if each edge appears exactly twice
```

### Mesh Encoding Rules

**Vertices**: Every 3 consecutive floats = one point `[x0, y0, z0, x1, y1, z1, ...]`

**Faces**: Each face starts with vertex count `n`, followed by `n` vertex indices:
- Triangle: `[3, 0, 1, 2]`
- Quad: `[4, 0, 1, 2, 3]`
- N-gon: `[n, i0, i1, ..., i(n-1)]`

---

## Supported Units

| Value | Unit | Notes |
|-------|------|-------|
| `"m"` | Meters | Server default, most common |
| `"mm"` | Millimeters | Common in detailed engineering |
| `"cm"` | Centimeters | |
| `"ft"` | Feet | Imperial systems |
| `"in"` | Inches | Imperial systems |

ALWAYS set `units` on every geometry object. Connectors handle conversion to/from native application units.
