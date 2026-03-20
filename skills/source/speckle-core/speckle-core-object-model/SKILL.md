---
name: speckle-core-object-model
description: >
  Use when creating Speckle objects, understanding Base class inheritance, or working with object decomposition.
  Prevents incorrect detachment syntax, broken content hashing, and misuse of dynamic vs typed properties.
  Covers Base class hierarchy, id/applicationId, speckle_type, detaching (@), chunking, decomposition, DataObject, Collection, Proxy types, displayValue, and units.
  Keywords: speckle base object, object model, detach, chunkable, decomposition, speckle_type, displayValue, collection, proxy.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-core-object-model

## Quick Reference

### Object Model Layers

| Layer | Type | Purpose | Key Properties |
|-------|------|---------|----------------|
| 1. Primitives | `Base` | Atomic values and geometry | `id`, `applicationId`, `speckle_type` |
| 2. Data Objects | `DataObject` | Semantic BIM elements | `name`, `properties`, `displayValue` |
| 3. Collections | `Collection` | Hierarchical grouping | `name`, `collectionType`, `elements` |
| 4. Root | `Collection` | Commit root container | Top-level collection sent to server |
| 5. Proxies | `*Proxy` | Cross-cutting relationships | `objects` (applicationIds), `value` |

### Property Prefix Rules

| Prefix | Effect | Example |
|--------|--------|---------|
| _(none)_ | Inline serialization | `height = 3.0` |
| `@` | Detached serialization | `@displayMesh = mesh` |
| `__` | Excluded from serialization and hashing | `__tempCache = data` |

### Core Identity Fields

| Field | Type | Computed? | Purpose |
|-------|------|-----------|---------|
| `id` | `string` | YES (SHA256 content hash) | Global uniqueness via content addressing |
| `applicationId` | `string` | NO (user-assigned) | Round-trip tracking within one source app |
| `speckle_type` | `string` | YES (from class hierarchy) | Type discriminator for deserialization |
| `totalChildrenCount` | `int` | YES (during serialization) | Progress reporting for transports |

### Critical Warnings

**NEVER** call `get_id()` / `GetId()` inside a loop -- it triggers full recursive serialization. Compute once and store the result.

**NEVER** modify an object after reading its `id` -- the hash is invalidated by ANY property change. ALWAYS finalize all properties before computing the id.

**NEVER** use `.` or `/` in dynamic property names -- both SDKs reject these characters. Use camelCase names without path separators.

**NEVER** store large geometry inline (non-detached) -- ALWAYS use detached properties for meshes and large lists. Inline storage prevents deduplication and lazy loading.

**NEVER** create cycles in Collection hierarchies -- collections MUST form a strict directed tree. Cycles cause infinite recursion during traversal.

**NEVER** omit `units` on geometry objects -- without units, receiving applications cannot scale geometry correctly. A 3-meter wall renders as 3 millimeters.

**NEVER** assume `applicationId` is globally unique -- it is unique only within a single source application. Use `id` for cross-model uniqueness.

**NEVER** read `totalChildrenCount` before serialization -- it is only populated during the send operation. Use `get_children_count()` / `GetTotalChildrenCount()` for an accurate count.

---

## The Base Class

Every Speckle object inherits from `Base`. It is the universal ancestor for all data in the Speckle ecosystem.

### Python Declaration

```python
from specklepy.objects.base import Base

@dataclass(kw_only=True)
class Base(_RegisteringBase):
    speckle_type = "Base"
    id: Union[str, None] = None
    applicationId: Union[str, None] = None
```

### C# Declaration

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

### Content-Addressed Identity

The `id` is a deterministic SHA256 hash computed from the serialized JSON of the object. Two objects with identical properties ALWAYS produce the same `id`. The `id` is `null` until serialization occurs -- NEVER assign it manually.

---

## Dynamic vs Typed Properties

Speckle supports a hybrid model: typed properties defined in class declarations, plus dynamic properties added at runtime.

### Typed Properties

Defined in class declarations with type hints (Python) or C# property syntax:

```python
@dataclass(kw_only=True)
class Wall(Base):
    speckle_type = "Objects.BuiltElements.Wall"
    height: float = 0.0
    baseOffset: float = 0.0
```

```csharp
public class Wall : Base
{
    public double height { get; set; }
    public double baseOffset { get; set; }
    [DetachProperty]
    public List<Base> displayValue { get; set; }
}
```

### Dynamic Properties

Added at runtime via dictionary-style access. ALWAYS serialized and transmitted like typed properties:

```python
obj = Base()
obj["customProperty"] = "hello"
obj["@detachedMesh"] = some_mesh   # @ prefix = detached
```

```csharp
var obj = new Base();
obj["customProperty"] = "hello";
obj["@detachedMesh"] = someMesh;   // @ prefix = detached
```

### Property Name Validation

Both SDKs prohibit: empty strings, consecutive `@@`, names containing `.` or `/`.

---

## Detaching

Detaching is Speckle's key optimization for large data. A detached child is serialized separately; the parent stores only a reference (`referencedId`).

### Two Ways to Detach

**Dynamic properties -- `@` prefix (Python and C#):**
```python
beam["@displayMesh"] = get_mesh(element)
```
The `@` is stripped from the final property name during serialization.

**Typed properties -- `[DetachProperty]` attribute (C#):**
```csharp
[DetachProperty]
public List<Base> displayValue { get; set; }
```

In Python, detachment is controlled by dataclass field metadata on typed properties.

### What Detaching Produces

Without detaching (inline):
```json
{ "displayValue": [{ "id": "mesh1", "vertices": [...] }] }
```

With detaching (reference):
```json
{ "displayValue": [{ "referencedId": "mesh1", "speckle_type": "reference" }] }
```

Benefits: deduplication, lazy loading, parallel transfer, incremental updates.

---

## Chunking

Chunking splits large flat arrays into smaller segments for efficient transport.

### C# `[Chunkable]` Attribute

```csharp
[Chunkable(31250)]
[DetachProperty]
public List<double> vertices { get; set; }
```

Each chunk is stored as a separate detached object. A mesh with 10 million vertices at chunk size 31,250 produces ~320 independently transferable chunks.

### Python Equivalent

SpecklePy marks properties as chunkable via dataclass field metadata, achieving the same segmentation.

---

## Decision Tree: Detach vs Chunk vs Inline

```
Is the property a large flat numeric array (vertices, faces, colors)?
  YES → Use [Chunkable] + [DetachProperty] (C#) or chunkable metadata (Python)
  NO  → Is the property a Base object or list of Base objects?
           YES → Is it >1KB or shared across multiple parents?
                   YES → Detach it (@ prefix or [DetachProperty])
                   NO  → Inline is acceptable
           NO  → Inline (primitive values are ALWAYS inline)
```

---

## Decomposition: Composed vs Decomposed

| State | Description | When |
|-------|-------------|------|
| **Composed** | Nested object tree in memory | Working with objects in code |
| **Decomposed** | Flat set of independent objects by `id` | Storage and transport (send/receive) |

Decomposition occurs during serialization (Send). Recomposition occurs during deserialization (Receive). The `totalChildrenCount` on the root tells transports how many separate objects to expect.

---

## Data Schema Layers

### Layer 2: DataObject

```python
@dataclass(kw_only=True)
class DataObject(Base):
    speckle_type = "Objects.Data.DataObject"
    name: str = ""
    properties: Dict[str, object] = field(default_factory=dict)
    displayValue: List[Base] = field(default_factory=list)  # detachable
```

Application-specific subclasses: `QgisObject`, `BlenderObject`.

### Layer 3: Collection

```csharp
public class Collection : Base
{
    public string name { get; set; }
    public string collectionType { get; set; }
    public List<Base> elements { get; set; }  // detachable
}
```

Collections MUST form a strict directed tree -- no cycles, no shared parents. Other Speckle objects MAY form directed acyclic graphs (DAGs).

### Layer 5: Proxy Types

Proxies enable many-to-many relationships in the tree model. Each proxy holds `objects` (a list of `applicationId` strings) and a `value`.

| Proxy Type | `speckle_type` | Value Type |
|------------|---------------|------------|
| `ColorProxy` | `Speckle.Core.Models.Proxies.ColorProxy` | `int` (ARGB) |
| `GroupProxy` | `Speckle.Core.Models.Proxies.GroupProxy` | _(name only)_ |
| `InstanceProxy` | `Speckle.Core.Models.Instances.InstanceProxy` | `List[float]` (4x4 matrix) |
| `InstanceDefinitionProxy` | `Speckle.Core.Models.Instances.InstanceDefinitionProxy` | `List[str]` (object ids) |
| `LevelProxy` | `Objects.Other.LevelProxy` | `Base` (elevation data) |
| `RenderMaterialProxy` | `Objects.Other.RenderMaterialProxy` | `RenderMaterial` |

---

## The displayValue Mechanism

`displayValue` is the universal visual representation for semantic objects. Every DataObject stores its renderable geometry here.

### Rules

- `displayValue` ALWAYS contains geometry primitives (Mesh, Line, Point)
- A single object MAY have multiple geometry items in `displayValue`
- `displayValue` is ALWAYS marked as detachable
- Applications that understand the semantic type MAY reconstruct native geometry; others use `displayValue` for rendering

---

## Units

Every geometry object MUST include a `units` field. Supported values:

| Value | Unit |
|-------|------|
| `"m"` | Meters (server default) |
| `"mm"` | Millimeters |
| `"cm"` | Centimeters |
| `"ft"` | Feet |
| `"in"` | Inches |

Unit conversion is handled by connectors during native format conversion. The server stores geometry in whatever units the sender specified.

---

## Instance/Definition Pattern

For repeated geometry (e.g., 1000 identical chairs):

1. One `InstanceDefinitionProxy` stores the geometry once
2. Multiple `InstanceProxy` objects reference the same `definitionId` with different 4x4 `transform` matrices
3. Result: 1 definition + 1000 lightweight transform references instead of 1000 full geometry copies

---

## Reference Links

- [references/methods.md](references/methods.md) -- API signatures for Base, DataObject, Collection, and Proxy types
- [references/examples.md](references/examples.md) -- Working code examples for creating and inspecting objects
- [references/anti-patterns.md](references/anti-patterns.md) -- What NOT to do with Base objects

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview
- https://docs.speckle.systems/developers/data-schema/geometry-schema
- https://speckle.guide/dev/base.html
- https://speckle.guide/dev/objects.html
