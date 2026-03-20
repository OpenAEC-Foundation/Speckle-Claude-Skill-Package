# Data Validator — Method Reference

## Python Validation Methods (SpecklePy)

### Base Object Introspection

| Method | Signature | Returns | Purpose |
|--------|-----------|---------|---------|
| `get_member_names` | `Base.get_member_names() -> list[str]` | All property names (typed + dynamic) | Enumerate all properties for validation |
| `get_typed_member_names` | `Base.get_typed_member_names() -> list[str]` | Class-defined properties only | Check typed property completeness |
| `get_dynamic_member_names` | `Base.get_dynamic_member_names() -> list[str]` | Runtime-added properties only | Validate dynamic property names |
| `get_serializable_attributes` | `Base.get_serializable_attributes() -> dict` | Properties that will be serialized | Preview what will be sent |
| `validate_prop_name` | `Base.validate_prop_name(name: str) -> None` | Raises on invalid name | Check property name before assignment |
| `get_id` | `Base.get_id(decompose: bool = False) -> str` | SHA256 content hash | Compute object identity (expensive) |
| `get_children_count` | `Base.get_children_count() -> int` | Total descendant count | Verify decomposition tree size |

### Mesh Introspection

| Method | Signature | Returns | Purpose |
|--------|-----------|---------|---------|
| `vertices_count` | `Mesh.vertices_count -> int` | `len(vertices) // 3` | Get vertex count without division |
| `get_point` | `Mesh.get_point(index: int) -> Point` | Point at vertex index | Access individual vertex |
| `get_points` | `Mesh.get_points() -> list[Point]` | All vertices as Points | Iterate vertices for validation |
| `get_face_vertices` | `Mesh.get_face_vertices(face_index: int) -> list[Point]` | Vertices of one face | Validate face geometry |
| `calculate_area` | `Mesh.calculate_area() -> float` | Surface area | Check for degenerate mesh (area = 0) |
| `calculate_volume` | `Mesh.calculate_volume() -> float` | Volume (closed mesh) | Check for valid closed geometry |
| `is_closed` | `Mesh.is_closed() -> bool` | True if watertight | Verify mesh closure |

### Property Access

| Pattern | Syntax | Purpose |
|---------|--------|---------|
| Dict access | `obj["property_name"]` | Read/write dynamic properties |
| Has attribute | `hasattr(obj, "property_name")` | Check if typed property exists |
| Get with default | `getattr(obj, "property_name", default)` | Safe property access |

## C# Validation Methods (Speckle.Sdk)

### Base Object Introspection

| Method | Signature | Returns | Purpose |
|--------|-----------|---------|---------|
| `GetDynamicMemberNames` | `Base.GetDynamicMemberNames() -> IEnumerable<string>` | Dynamic property names | Enumerate dynamic properties |
| `GetId` | `Base.GetId(bool decompose = false) -> string` | SHA256 content hash | Compute object identity |
| `GetTotalChildrenCount` | `Base.GetTotalChildrenCount() -> int` | Descendant count | Verify tree size |
| `IsPropNameValid` | `DynamicBase.IsPropNameValid(string name, out string reason) -> bool` | Validity + reason | Validate property name |
| Indexer | `Base[string key]` | `object?` | Dynamic property access |

### Type Checking

| Pattern | Syntax | Purpose |
|---------|--------|---------|
| Type test | `obj is Mesh mesh` | Safe cast to specific type |
| Type string | `obj.speckle_type` | Read discriminator string |
| Null check | `obj?.propertyName` | Safe navigation |

## Validation Helper Signatures

### Pre-Flight Validators

| Function | Signature | Returns |
|----------|-----------|---------|
| `validate_base_object` | `(obj: Base) -> list[str]` | List of schema errors |
| `validate_mesh` | `(mesh: Mesh) -> list[str]` | List of geometry errors |
| `validate_display_value` | `(obj: Base) -> list[str]` | List of displayValue errors |
| `validate_collection_tree` | `(root: Collection) -> list[str]` | List of tree structure errors |
| `validate_proxy_references` | `(root: Collection, proxies: list) -> list[str]` | List of broken references |
| `validate_unit_consistency` | `(objects: list) -> list[str]` | List of unit mismatches |
| `pre_flight_validate` | `(root: Collection, proxies: list) -> dict` | `{errors: [...], stats: {...}}` |

### Post-Receive Validators

| Function | Signature | Returns |
|----------|-----------|---------|
| `check_duplicate_app_ids` | `(objects: list) -> list[str]` | List of duplicate ID errors |
| `resolve_proxies` | `(objects: list, proxies: list) -> dict` | `{resolved: {...}, unresolved: [...]}` |
| `audit_property_coverage` | `(objects: list, required_keys: list[str]) -> dict` | Coverage report per key |
| `detect_drift` | `(old_objects: list, new_objects: list) -> dict` | `{added, removed, modified, unchanged}` |

## Supported Geometry speckle_type Values

| speckle_type | Class | Validation Focus |
|-------------|-------|-----------------|
| `Objects.Geometry.Mesh` | `Mesh` | vertices/faces arrays, colors, normals |
| `Objects.Geometry.Line` | `Line` | start/end points, units |
| `Objects.Geometry.Point` | `Point` | x/y/z values, units |
| `Objects.Geometry.Polyline` | `Polyline` | vertex array, units |
| `Objects.Geometry.Curve` | `Curve` | control points, units |
| `Objects.Geometry.Arc` | `Arc` | radius, angles, units |
| `Objects.Geometry.Circle` | `Circle` | radius, plane, units |
| `Objects.Geometry.Polycurve` | `Polycurve` | segments list, units |
| `Objects.Geometry.Brep` | `Brep` | surfaces, edges, units |

## Supported Unit Strings

| String | Unit | Common Source |
|--------|------|---------------|
| `"m"` | Meters | Speckle default, Revit (metric) |
| `"mm"` | Millimeters | Revit (metric detail), Tekla |
| `"cm"` | Centimeters | Archicad |
| `"ft"` | Feet | Revit (imperial) |
| `"in"` | Inches | Revit (imperial detail) |

## Proxy speckle_type Values

| speckle_type | Proxy Class | `objects` Contains |
|-------------|-------------|-------------------|
| `Speckle.Core.Models.Proxies.ColorProxy` | ColorProxy | applicationIds |
| `Objects.Other.RenderMaterialProxy` | RenderMaterialProxy | applicationIds |
| `Objects.Other.LevelProxy` | LevelProxy | applicationIds |
| `Speckle.Core.Models.Proxies.GroupProxy` | GroupProxy | applicationIds |
| `Speckle.Core.Models.Instances.InstanceProxy` | InstanceProxy | N/A (uses definitionId) |
| `Speckle.Core.Models.Instances.InstanceDefinitionProxy` | InstanceDefinitionProxy | applicationIds |
