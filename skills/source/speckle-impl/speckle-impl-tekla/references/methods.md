# speckle-impl-tekla -- Methods Reference

## TeklaObject Properties

### Core Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `speckle_type` | `string` | ALWAYS | Object type identifier for Speckle deserialization |
| `type` | `string` | ALWAYS | Tekla element category (`"Beam"`, `"Column"`, `"Plate"`, `"Bolt"`) |
| `displayValue` | `List[Base]` | ALWAYS | Geometry array -- typically Brep objects |
| `properties` | `dict` | ALWAYS | Metadata dictionary containing Tekla-native data |
| `applicationId` | `string` | ALWAYS | Stable identifier from Tekla -- used for proxy references and cross-version tracking |
| `units` | `string` | ALWAYS | Model units (typically `"mm"`) |

### Properties.Report Fields

| Field | Type | Description |
|-------|------|-------------|
| `Profile` | `string` | Section profile designation (e.g., `"HEA300"`, `"W12X26"`, `"RHS200x100x8"`) |
| `Material` | `string` | Material specification (e.g., `"S355"`, `"S275"`, `"C30/37"`) |
| `Length` | `float` | Part length in model units |
| `Width` | `float` | Part width in model units |
| `Height` | `float` | Part height in model units |
| `Weight` | `float` | Part weight |
| `PartNumber` | `string` | Tekla part mark |
| `AssemblyNumber` | `string` | Assembly mark reference |
| `CoordinateX` | `float` | X position in model coordinate system |
| `CoordinateY` | `float` | Y position in model coordinate system |
| `CoordinateZ` | `float` | Z position in model coordinate system |

---

## Publish Operations

### Selection Methods

| Method | Scope | Description |
|--------|-------|-------------|
| Manual selection | Selected objects | Publish only manually selected model objects |
| Selection filter | Filtered objects | Use Tekla selection filters to define scope |
| All visible | Visible objects | Publish all objects visible in the model viewport |

### Publish Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| Project | Speckle Project | Target Speckle project (stream) |
| Model | Speckle Model (Branch) | Target model within the project |
| Message | string | Commit message describing the publish action |

---

## Downstream Access (SpecklePy)

### Traversing TeklaObjects

After publishing from Tekla, downstream consumers access TeklaObjects via SpecklePy:

| Operation | Method | Returns |
|-----------|--------|---------|
| Get commit | `client.commit.get(stream_id, commit_id)` | Commit metadata |
| Receive data | `operations.receive(obj_id, transport)` | Root Collection |
| Traverse children | Iterate `base["@elements"]` or use `Base.get_children_count()` | Child objects |
| Check type | `obj["type"]` or `obj.speckle_type` | Element category string |
| Access report | `obj["properties"]["Report"]` | Dict of Tekla report data |
| Get geometry | `obj["displayValue"]` | List of Brep geometry objects |

### Filtering by Element Type

| Filter | Access Pattern | Returns |
|--------|---------------|---------|
| All beams | Filter where `obj["type"] == "Beam"` | List of beam TeklaObjects |
| All plates | Filter where `obj["type"] == "Plate"` | List of plate TeklaObjects |
| All bolts | Filter where `obj["type"] == "Bolt"` | List of bolt TeklaObjects |
| By material | Filter where `obj["properties"]["Report"]["Material"] == "S355"` | Filtered list |
| By profile | Filter where `"HEA" in obj["properties"]["Report"]["Profile"]` | Filtered list |

---

## RenderMaterial Proxy

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Material display name |
| `diffuse` | `int` | ARGB color value |
| `opacity` | `float` | Transparency (0.0 = transparent, 1.0 = opaque) |
| `applicationId` | `string` | Stable reference identifier |

### Resolution

RenderMaterial proxies are stored at the Root Collection level. TeklaObjects reference them via `applicationId`. When rendering in the Speckle Viewer, materials are ALWAYS resolved from these proxies.
