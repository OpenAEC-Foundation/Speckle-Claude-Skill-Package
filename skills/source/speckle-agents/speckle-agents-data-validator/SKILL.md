---
name: speckle-agents-data-validator
description: >
  Use when validating Speckle objects before sending, checking received data integrity, or auditing model data quality.
  Prevents sending malformed objects that cause viewer rendering failures, missing required properties, and broken proxy references.
  Covers data validation patterns: object schema checking, required property verification, geometry integrity validation, pre-flight checks before send, post-receive validation, proxy reference integrity, and unit consistency checks.
  Keywords: speckle validate, data validation, schema check, property check, geometry integrity, pre-flight, post-receive, quality check, object malformed, missing properties, data looks wrong.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-agents-data-validator

## Validation Decision Tree

```
Need to validate Speckle data?
|
+-- BEFORE sending (pre-flight)?
|   +-- Single object → OBJECT SCHEMA CHECK (Section 1)
|   +-- Geometry object → GEOMETRY INTEGRITY (Section 2)
|   +-- Object with displayValue → DISPLAY VALUE CHECK (Section 3)
|   +-- Root collection → COLLECTION TREE CHECK (Section 4)
|   +-- Root with proxies → PROXY REFERENCE CHECK (Section 5)
|   +-- Cross-object units → UNIT CONSISTENCY (Section 6)
|   +-- Full commit payload → FULL PRE-FLIGHT (Section 7)
|
+-- AFTER receiving (post-receive)?
|   +-- Received objects missing data → POST-RECEIVE AUDIT (Section 8)
|   +-- Proxy references unresolvable → PROXY RESOLUTION (Section 9)
|   +-- Geometry renders incorrectly → GEOMETRY AUDIT (Section 10)
|
+-- Continuous quality auditing?
    +-- Model-wide property coverage → COMPLETENESS AUDIT (Section 11)
    +-- Cross-version drift detection → VERSION DIFF (Section 12)
```

---

## Section 1: Object Schema Validation

**When:** ALWAYS validate every Base object before adding it to a commit payload.

### Required Properties Checklist

| Property | Required | Validation Rule |
|----------|----------|-----------------|
| `speckle_type` | YES | MUST be a non-empty string. NEVER send with `speckle_type = ""` or `None`. |
| `id` | NO (pre-send) | NEVER set `id` manually. It is computed during serialization. |
| `applicationId` | CONDITIONAL | MUST be set for round-trip tracking. Unique within one source app only. |
| `units` | CONDITIONAL | MUST be set on ALL geometry objects. Values: `"m"`, `"mm"`, `"cm"`, `"ft"`, `"in"`. |

### Dynamic Property Name Rules

- NEVER use empty strings as property names
- NEVER use names containing `.` or `/`
- NEVER use names with consecutive `@@`
- Names starting with `@` trigger detachment during serialization
- Names starting with `__` are excluded from hashing and serialization

### Python Validation Pattern

```python
def validate_base_object(obj: Base) -> list[str]:
    errors = []
    if not getattr(obj, "speckle_type", None):
        errors.append("speckle_type is missing or empty")
    if obj.id is not None and not isinstance(obj.id, str):
        errors.append("id must be None (pre-send) or a string (post-receive)")
    for name in obj.get_dynamic_member_names():
        if not name:
            errors.append("Empty dynamic property name found")
        if "." in name or "/" in name:
            errors.append(f"Invalid chars in property name: '{name}'")
        if "@@" in name:
            errors.append(f"Consecutive @@ in property name: '{name}'")
    return errors
```

---

## Section 2: Geometry Integrity Validation

**When:** ALWAYS validate geometry objects before sending. Malformed geometry causes viewer crashes.

### Mesh Validation Checklist

| Check | Rule | Consequence of Failure |
|-------|------|----------------------|
| Vertices length | MUST be divisible by 3 | Viewer crash or silent data loss |
| Faces structure | Each face: count `n`, then `n` indices | Garbled rendering, missing faces |
| Face index bounds | Every index MUST be `< len(vertices) / 3` | Out-of-bounds crash |
| Face vertex count | `n` MUST be >= 3 | Degenerate faces |
| Units present | `units` MUST be set | Wrong scale rendering |
| Non-empty arrays | `vertices` and `faces` length > 0 | Empty mesh wastes bandwidth |

### Python Mesh Validator

```python
def validate_mesh(mesh: Mesh) -> list[str]:
    errors = []
    if not mesh.vertices or len(mesh.vertices) == 0:
        errors.append("Mesh has no vertices"); return errors
    if len(mesh.vertices) % 3 != 0:
        errors.append(f"Vertices length {len(mesh.vertices)} not divisible by 3")
    vertex_count = len(mesh.vertices) // 3
    if not mesh.faces or len(mesh.faces) == 0:
        errors.append("Mesh has no faces"); return errors
    i, face_idx = 0, 0
    while i < len(mesh.faces):
        n = mesh.faces[i]
        if n < 3:
            errors.append(f"Face {face_idx}: vertex count {n} < 3")
        if i + n >= len(mesh.faces):
            errors.append(f"Face {face_idx}: overflows faces array"); break
        for j in range(1, n + 1):
            idx = mesh.faces[i + j]
            if idx < 0 or idx >= vertex_count:
                errors.append(f"Face {face_idx}: index {idx} out of bounds")
        i += n + 1; face_idx += 1
    if not getattr(mesh, "units", None):
        errors.append("Mesh has no units set")
    return errors
```

### Optional Array Validation

| Array | Rule |
|-------|------|
| `colors` | Length MUST equal vertex count (one ARGB int per vertex) |
| `textureCoordinates` | Length MUST equal `vertex_count * 2` (U, V per vertex) |
| `vertexNormals` | Length MUST equal `len(vertices)` (x, y, z per vertex) |

---

## Section 3: displayValue Validation

**When:** ALWAYS validate `displayValue` on DataObjects before sending. Missing `displayValue` makes objects invisible in the viewer.

### Rules

- MUST be a list (NEVER a single object, NEVER `None` for visual objects)
- Every element MUST be a geometry type (Mesh, Line, Point, Polyline, Curve, Arc, Circle, Polycurve, Brep)
- Every element MUST have `units` set
- NEVER nest DataObjects inside `displayValue`

```python
GEOMETRY_TYPES = {
    "Objects.Geometry.Mesh", "Objects.Geometry.Line", "Objects.Geometry.Point",
    "Objects.Geometry.Polyline", "Objects.Geometry.Curve", "Objects.Geometry.Arc",
    "Objects.Geometry.Circle", "Objects.Geometry.Polycurve", "Objects.Geometry.Brep",
}

def validate_display_value(obj: Base) -> list[str]:
    errors = []
    dv = getattr(obj, "displayValue", None)
    if dv is None:
        return ["displayValue is None -- object invisible in viewer"]
    if not isinstance(dv, list):
        return [f"displayValue must be a list, got {type(dv).__name__}"]
    if len(dv) == 0:
        errors.append("displayValue is empty -- object invisible in viewer")
    for i, geom in enumerate(dv):
        if not isinstance(geom, Base):
            errors.append(f"displayValue[{i}]: not a Base object"); continue
        st = getattr(geom, "speckle_type", "")
        if st not in GEOMETRY_TYPES:
            errors.append(f"displayValue[{i}]: '{st}' is not a geometry type")
        if not getattr(geom, "units", None):
            errors.append(f"displayValue[{i}]: missing units")
    return errors
```

---

## Section 4: Collection Tree Validation

**When:** ALWAYS validate the root collection before sending. Cycles cause infinite recursion during serialization.

### Rules

- Collections MUST form a strict directed tree (no cycles, no shared parents)
- Collection `name` MUST be a non-empty string
- Collection `elements` MUST be a list

```python
def validate_collection_tree(root) -> list[str]:
    errors, visited, path = [], set(), set()
    def walk(node, depth=0):
        nid = id(node)
        if nid in path:
            errors.append(f"Cycle at depth {depth}: {getattr(node, 'name', '?')}"); return
        if nid in visited:
            errors.append(f"Shared parent: '{getattr(node, 'name', '?')}'"); return
        visited.add(nid); path.add(nid)
        for child in getattr(node, "elements", []) or []:
            if hasattr(child, "elements"):
                walk(child, depth + 1)
        path.discard(nid)
    walk(root)
    return errors
```

---

## Section 5: Proxy Reference Integrity

**When:** ALWAYS validate proxy references before sending. Broken references cause silent data loss.

### Rules

- Every `applicationId` in a proxy's `objects` list MUST exist in the commit's object tree
- Proxies MUST reference objects by `applicationId`, NEVER by `id`
- No proxy MUST reference another proxy
- `InstanceProxy.definitionId` MUST match an `InstanceDefinitionProxy.applicationId`

### Validation Steps

1. Walk the object tree and collect all `applicationId` values into a set
2. For each proxy, verify every entry in `objects` exists in that set
3. For each `InstanceProxy`, verify `definitionId` matches an `InstanceDefinitionProxy`
4. Report all unresolvable references

See [references/examples.md](references/examples.md) for the complete implementation.

---

## Section 6: Unit Consistency Validation

**When:** ALWAYS check units across all geometry in a commit. Mixed units cause wrong-scale rendering.

### Rules

- ALL geometry objects in a single-source commit SHOULD use the same units
- Supported values: `"m"`, `"mm"`, `"cm"`, `"ft"`, `"in"`
- NEVER send geometry without units
- Mixed units in federated models are acceptable but MUST be documented

```python
def validate_unit_consistency(objects: list) -> list[str]:
    errors, units_found = [], {}
    for obj in objects:
        unit = getattr(obj, "units", None)
        if unit is None:
            errors.append(f"'{getattr(obj, 'speckle_type', '?')}' has no units")
        elif unit not in ("m", "mm", "cm", "ft", "in"):
            errors.append(f"Unknown unit '{unit}'")
        else:
            units_found[unit] = units_found.get(unit, 0) + 1
    if len(units_found) > 1:
        errors.append(f"Mixed units: {units_found}. Verify intentional.")
    return errors
```

---

## Section 7: Full Pre-Flight Validation

**When:** ALWAYS run before `operations.send()`. Orchestrates all individual validators.

### Checklist

1. Validate collection tree structure (Section 4)
2. Walk all objects -- validate schema (1), geometry (2), displayValue (3)
3. Validate proxy references (Section 5)
4. Validate unit consistency (Section 6)
5. Report: total objects, total errors, errors by category

```python
def pre_flight_validate(root_collection, proxies: list) -> dict:
    all_errors, geometry_objects = [], []
    stats = {"objects": 0, "geometry": 0}
    all_errors.extend(validate_collection_tree(root_collection))
    def walk(node):
        stats["objects"] += 1
        all_errors.extend(validate_base_object(node))
        st = getattr(node, "speckle_type", "")
        if st in GEOMETRY_TYPES:
            stats["geometry"] += 1; geometry_objects.append(node)
            if "Mesh" in st: all_errors.extend(validate_mesh(node))
        if hasattr(node, "displayValue"):
            all_errors.extend(validate_display_value(node))
        for child in getattr(node, "elements", []) or []:
            walk(child)
    walk(root_collection)
    all_errors.extend(validate_proxy_references(root_collection, proxies))
    all_errors.extend(validate_unit_consistency(geometry_objects))
    return {"errors": all_errors, "stats": stats}
```

---

## Section 8: Post-Receive Validation

**When:** ALWAYS validate received data when downstream workflows depend on specific properties.

### Post-Receive Checklist

| Check | Why |
|-------|-----|
| `displayValue` populated | Connectors MAY strip geometry on load |
| Expected `speckle_type` present | Data may have been converted by intermediate tool |
| `applicationId` unique | Duplicates break proxy resolution |
| `properties` has expected keys | Not all connectors preserve properties on round-trip |
| Geometry has `units` | Older SDKs may omit units |

### Duplicate applicationId Detection

```python
def check_duplicate_app_ids(objects: list) -> list[str]:
    errors, seen = [], {}
    for obj in objects:
        app_id = getattr(obj, "applicationId", None)
        if app_id:
            if app_id in seen:
                errors.append(f"Duplicate '{app_id}': {seen[app_id]} and {getattr(obj, 'speckle_type', '?')}")
            else:
                seen[app_id] = getattr(obj, "speckle_type", "?")
    return errors
```

---

## Section 9: Proxy Resolution After Receive

**When:** After receiving data with proxies, ALWAYS verify references resolve.

Build a map of `applicationId -> object` from all received objects. For each proxy, look up every entry in its `objects` list. Log unresolvable references. See [references/examples.md](references/examples.md) for the `resolve_proxies()` implementation.

---

## Section 10: Geometry Audit After Receive

**When:** Received geometry renders incorrectly in the viewer.

```
Geometry renders incorrectly
|
+-- Invisible? → Check displayValue (Section 3), vertices/faces, units
+-- Wrong scale? → Check units field, unit mismatch (Section 6)
+-- Missing faces? → Run mesh integrity (Section 2), check face encoding
+-- No colors/materials? → Check proxy resolution (Section 9), mesh.colors length
```

---

## Section 11: Completeness Audit

**When:** Model-wide QA -- verify all objects meet minimum property standards.

Pass a list of objects and required property keys to `audit_property_coverage()`. Returns per-key coverage percentages and lists of objects missing each property. See [references/examples.md](references/examples.md) for the implementation and usage pattern.

---

## Section 12: Cross-Version Drift Detection

**When:** Compare two model versions to detect unexpected changes.

Match objects by `applicationId` across versions. Objects with same `applicationId` but different `id` (content hash) are modified. Objects present in only one version are added or removed. See [references/examples.md](references/examples.md) for the `detect_drift()` implementation.

---

## Critical Warnings

**NEVER** set `id` manually on a Base object. The `id` is a content-addressed hash computed during serialization. Manual assignment causes hash mismatches and data corruption.

**NEVER** modify an object after calling `get_id()`. Any property change invalidates the hash. ALWAYS finalize all properties before computing the ID.

**NEVER** use `id` in proxy `objects` lists. Proxies reference by `applicationId`. Using `id` breaks resolution because `id` changes on every content update.

**NEVER** create cycles in collection hierarchies. Collections MUST form a strict directed tree. Cycles cause infinite recursion during serialization.

**NEVER** omit `units` on geometry objects. The viewer has no reliable default. Objects without units render at unpredictable scales.

**NEVER** assume `applicationId` is globally unique. It is unique only within a single source application.

**ALWAYS** validate mesh face encoding. Each face starts with vertex count `n` followed by `n` indices. One off-by-one error corrupts all subsequent faces.

**ALWAYS** run pre-flight validation before `operations.send()`. Catching errors before transport prevents storing malformed data on the server.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Validation method signatures for Python and C#
- [references/examples.md](references/examples.md) -- Complete validation workflow examples
- [references/anti-patterns.md](references/anti-patterns.md) -- What NOT to do when validating Speckle data

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview
- https://docs.speckle.systems/developers/data-schema/object-schema
- https://docs.speckle.systems/developers/data-schema/proxy-schema
- https://speckle.guide/dev/base.html
