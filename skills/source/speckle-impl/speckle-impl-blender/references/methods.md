# Connector Operations Reference (Speckle Blender Connector)

## Publish Operations

### Publish to Model

Converts visible Blender objects to Speckle format and sends them to a Speckle server.

**Input**: Visible mesh and curve objects in the Blender scene
**Output**: Speckle version created on the configured project/model
**Settings**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Apply Modifiers | Boolean | Off | When enabled, publishes geometry with all modifiers baked |

**Supported object types on publish**:

| Blender Type | Speckle Type | Notes |
|--------------|-------------|-------|
| Mesh | Mesh | Vertices, faces, edges, vertex colors |
| Bezier Curve | Curve | Control points, handles |
| Bezier Circle | Curve | Circular Bezier curve |
| NURBS Curve | Curve | Control points, weights, knots |
| NURBS Circle | Curve | Circular NURBS curve |

**Excluded object types** (silently skipped):

| Blender Type | Reason |
|--------------|--------|
| Camera | NOT supported by Speckle connector |
| Light (Point, Sun, Spot, Area) | NOT supported by Speckle connector |
| Armature | NOT supported by Speckle connector |
| Empty | NOT supported by Speckle connector |
| Speaker | NOT supported by Speckle connector |

---

## Load Operations

### Load from Model

Fetches Speckle objects from a server and converts them to Blender objects.

**Input**: Speckle project/model URL or selection
**Output**: Blender objects in scene, organized by source collection hierarchy

**Settings**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Block Loading Mode | Enum | Collection Instances | How block instances are created in Blender |
| Version | Selection | Latest | Which model version to load |

### Block Loading Modes

**Collection Instances**:
- Block definitions → Blender collections (hidden)
- Block instances → Collection instance objects referencing the definition collection
- Memory efficient for repeated elements
- Editing the definition collection updates all instances

**Linked Duplicates**:
- Block instances → Linked duplicate mesh objects
- Each instance is a separate object sharing mesh data
- Individual instances can be made unique (single-user) for editing

---

## Shader Mapping

### Publish: Blender → Speckle RenderMaterial

**Principled BSDF**:

| Blender Input | Speckle RenderMaterial Property |
|---------------|-------------------------------|
| Base Color | diffuse (RGB) |
| Metallic | metalness (float 0-1) |
| Roughness | roughness (float 0-1) |
| Alpha | opacity (float 0-1) |

**Diffuse BSDF**:

| Blender Input | Speckle RenderMaterial Property |
|---------------|-------------------------------|
| Color | diffuse (RGB) |

**Emission**:

| Blender Input | Speckle RenderMaterial Property |
|---------------|-------------------------------|
| Color | emissive (RGB) |
| Strength | emissive strength |

**Glass BSDF**:

| Blender Input | Speckle RenderMaterial Property |
|---------------|-------------------------------|
| Color | diffuse (RGB) |
| IOR | ior (float) |

**Any Other Shader**:
Falls back to Blender viewport display color → Speckle diffuse color. All other properties are lost.

### Load: Speckle RenderMaterial → Blender

ALL incoming materials are created as Principled BSDF shaders:

| Speckle RenderMaterial Property | Blender Principled BSDF Input |
|-------------------------------|-------------------------------|
| diffuse (RGB) | Base Color |
| opacity (float) | Alpha |
| metalness (float) | Metallic |
| roughness (float) | Roughness |

---

## Proxy Types

### RenderMaterial Proxy

The ONLY proxy type used by the Blender connector.

**Structure**:

| Field | Type | Description |
|-------|------|-------------|
| speckle_type | string | Proxy type identifier |
| applicationId | string | Stable material identifier |
| name | string | Material name |
| value | object | RenderMaterial data (diffuse, opacity, metalness, roughness) |
| objects | string[] | Array of applicationId strings referencing objects using this material |

---

## Collection Mapping

| Blender Concept | Speckle Concept |
|-----------------|-----------------|
| Scene Collection | Root Collection |
| Collection | Collection |
| Nested Collection | Nested Collection |
| Object in Collection | Object in Collection |
| Object name | Object name |

Collections preserve their full hierarchy depth. Empty collections are included in the structure.

---

## Unit Handling

Blender scenes carry a unit setting (metric/imperial with scale). The connector reads the scene unit and sets the `units` field on published objects. Unit conversion happens automatically when loading into applications with different unit systems.
