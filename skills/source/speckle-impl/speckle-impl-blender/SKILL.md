---
name: speckle-impl-blender
description: >
  Use when exchanging 3D data between Blender and Speckle, handling mesh/curve conversion, or managing materials.
  Prevents attempting Linux usage (unsupported), sending cameras/lights (unsupported), and losing custom properties on receive.
  Covers Blender 4.2-5.0 connector (Win/Mac), mesh and curve support, 4 shader types (Principled/Diffuse/Emission/Glass), Apply Modifiers option, block loading modes, and known limitations (no Linux, no cameras/lights/textures, no custom properties on receive).
  Keywords: speckle blender, blender connector, mesh, curves, materials, shader, principled bsdf, publish, receive.
license: MIT
compatibility: "Designed for Claude Code. Requires Blender 4.2-5.0 (Windows/Mac), Speckle Connector for Blender (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-blender

## Quick Reference

### Platform Support

| Platform | Supported |
|----------|-----------|
| Windows | Yes |
| macOS | Yes |
| Linux | **NO — NEVER use the Blender connector on Linux** |

### Supported Blender Versions

| Version | Status |
|---------|--------|
| Blender 4.2 | Supported |
| Blender 4.3 | Supported |
| Blender 4.4 | Supported |
| Blender 4.5 | Supported |
| Blender 5.0 | Supported |

### Supported Geometry Types

| Type | Publish | Load |
|------|---------|------|
| Mesh objects | Yes | Yes |
| Bezier curves | Yes | Yes |
| Bezier circles | Yes | Yes |
| NURBS curves | Yes | Yes |
| NURBS circles | Yes | Yes |
| Cameras | **NO** | **NO** |
| Lights | **NO** | **NO** |
| Textures | **NO** | **NO** |

### Recognized Shader Types

| Shader | Supported | Notes |
|--------|-----------|-------|
| Principled BSDF | Yes | Full property transfer (color, metallic, roughness, opacity) |
| Diffuse BSDF | Yes | Color transfer |
| Emission | Yes | Color and strength transfer |
| Glass BSDF | Yes | Color and IOR transfer |
| Any other shader | **Fallback** | Reverts to basic material attributes only |

### Critical Warnings

**NEVER** attempt to use the Blender connector on Linux. The connector supports Windows and macOS ONLY, despite Blender itself running on Linux. Installation and operation on Linux will fail.

**NEVER** publish cameras or lights from Blender. These object types are NOT supported by the Speckle connector and will be silently excluded from the publish operation.

**NEVER** expect custom properties to survive a receive operation. Properties are NOT loaded and attached to received objects in Blender. Properties are preserved in Speckle's data model and visible in the web viewer, but Blender does NOT attach them to loaded objects.

**NEVER** rely on texture data transferring through Speckle. Speckle does NOT support textures across ANY connector. Only material properties (color, opacity, metallic, roughness) transfer. UV mapping data does NOT survive the pipeline.

**ALWAYS** use one of the four supported shader types (Principled, Diffuse, Emission, Glass) for predictable material transfer. Any other shader type falls back to basic material attributes, resulting in lost material fidelity.

---

## Publishing from Blender

### What Gets Published

The Blender connector publishes visible mesh and curve objects along with their collection hierarchy. Each object carries:

- Geometry data (vertices, faces, edges for meshes; control points for curves)
- Material assignments (limited to the 4 supported shader types)
- Collection hierarchy (Blender collections map to Speckle collections)
- Object names

### Apply Modifiers Setting

The connector provides an **"Apply Modifiers"** toggle in the publish settings:

- **Enabled**: Objects are published with all modifiers applied (baked). The published geometry reflects the final modifier stack result.
- **Disabled**: Objects are published in their base state, WITHOUT modifier effects.

**ALWAYS** enable "Apply Modifiers" when the downstream consumer needs the final visual geometry (e.g., sending to Revit, viewer, or Power BI). Disable it ONLY when the base geometry is intentionally needed.

### Publishing Workflow

1. Select the Speckle project and model in the connector panel
2. Configure publish settings (Apply Modifiers on/off)
3. Click Publish
4. The connector converts visible objects to Speckle format and sends them to the server

### What Does NOT Get Published

- Cameras — silently excluded
- Lights — silently excluded
- Textures — NOT supported by Speckle
- Armatures and animation data — NOT supported
- Particle systems — NOT supported (unless baked to mesh via Apply Modifiers)

---

## Loading into Blender

### Block Loading Modes

When receiving models that contain block instances (e.g., from Revit families, Rhino blocks, AutoCAD blocks), the Blender connector offers two loading modes:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Collection Instances** (default) | Block definitions become Blender collections; instances reference those collections | Memory-efficient for models with many repeated elements |
| **Linked Duplicates** | Block instances are created as linked duplicate objects | When individual instance editing is needed |

### Material Persistence

Material modifications made in Blender persist across version updates. When loading a new version of a model:

- Existing materials with matching names are reused
- Manual material edits (color changes, shader adjustments) survive the update
- New materials from the updated model are added alongside existing ones

### Version Selection

- The connector loads the **latest version** by default
- Specific versions are selectable through the connector panel version history

### What Loads Successfully

- Mesh geometry with faces, edges, vertices
- Curve geometry (Bezier and NURBS)
- Material assignments (4 shader types)
- Collection hierarchy from the source application
- Object names

### What Does NOT Load

- Custom properties — **properties are NOT loaded and attached to loaded objects**
- Cameras — NOT supported
- Lights — NOT supported
- Textures — NOT supported

---

## Material Handling

### Shader Mapping on Publish

The connector inspects each Blender material's shader node tree. It recognizes EXACTLY four shader types:

1. **Principled BSDF**: Maps Base Color, Metallic, Roughness, Alpha to Speckle RenderMaterial properties
2. **Diffuse BSDF**: Maps Color to Speckle RenderMaterial
3. **Emission**: Maps Color and Strength to Speckle RenderMaterial
4. **Glass BSDF**: Maps Color and IOR to Speckle RenderMaterial

For ANY other shader type, the connector falls back to basic material attributes (typically just the viewport display color).

### Shader Mapping on Load

When loading models from other applications, Speckle RenderMaterial properties map to Blender's Principled BSDF shader:

| Speckle Property | Blender Principled BSDF Input |
|------------------|-------------------------------|
| diffuse (RGB) | Base Color |
| opacity | Alpha |
| metalness | Metallic |
| roughness | Roughness |

### Material Round-Trip Behavior

- Blender → Speckle → Blender: Materials survive if using supported shader types
- Other App → Speckle → Blender: Materials load as Principled BSDF with mapped properties
- Blender → Speckle → Other App: Material fidelity depends on the receiving connector's capabilities

---

## Data Schema

### Object Types Produced

The Blender connector produces **Geometry Objects** (not DataObjects). Published objects are pure geometric primitives:

- Mesh objects → Speckle Mesh (vertices, faces, vertex colors)
- Curve objects → Speckle Curve/Polyline/Line

### Collection Hierarchy

Blender collections map directly to Speckle collections, preserving the organizational structure:

```
Blender Scene Collection
├── Building
│   ├── Walls (mesh objects)
│   └── Floors (mesh objects)
└── Site
    └── Terrain (mesh objects)
```

Becomes in Speckle:

```
Root Collection
├── Building
│   ├── Walls
│   └── Floors
└── Site
    └── Terrain
```

### Proxy Types

The Blender connector uses the **RenderMaterial** proxy type to share material definitions across multiple objects. A single RenderMaterial proxy can reference many mesh objects that share the same material.

---

## Cross-Application Workflows

### Receiving Revit Models in Blender

When loading a Revit model into Blender:

- Revit elements arrive as mesh geometry organized by the Revit hierarchy (Level > Category > Type)
- Materials map to Principled BSDF shaders
- Revit parameters are visible in the Speckle web viewer but are NOT attached to Blender objects
- Block instances (Revit families) load based on the selected block loading mode

### Receiving Rhino Models in Blender

When loading a Rhino model into Blender:

- Rhino geometry arrives as meshes and curves
- Rhino layers map to Blender collections
- Render materials transfer to Principled BSDF
- Block definitions load based on the selected block loading mode

### Publishing Blender Models to Other Applications

When publishing from Blender for use in other applications:

- **ALWAYS** enable Apply Modifiers if the receiving application needs final geometry
- **ALWAYS** use supported shader types for material transfer
- Receiving applications will see mesh/curve geometry with basic material properties
- The Blender collection hierarchy is preserved as Speckle collections

---

## Limitations Summary

| Limitation | Severity | Detail |
|------------|----------|--------|
| No Linux support | **Critical** | Windows and macOS ONLY |
| No cameras | High | Cameras are silently excluded on publish and not created on load |
| No lights | High | Lights are silently excluded on publish and not created on load |
| No textures | High | Speckle does not support textures across any connector |
| No custom properties on receive | High | Properties visible in web viewer but NOT attached in Blender |
| Only 4 shader types | Medium | Other shaders fall back to basic material attributes |
| No armatures/animation | Medium | Animation data is not part of Speckle's scope |

---

## Reference Links

- [references/methods.md](references/methods.md) — Connector operations, settings, and shader mappings
- [references/examples.md](references/examples.md) — Working workflow examples for publish and load operations
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do, with WHY explanations

### Official Sources

- https://docs.speckle.systems/connectors/blender.md
- https://docs.speckle.systems/developers/data-schema/overview.md
- https://docs.speckle.systems/developers/data-schema/proxy-schema.md
