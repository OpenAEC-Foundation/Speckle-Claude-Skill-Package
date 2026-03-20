# Anti-Patterns (Speckle Blender Connector)

## 1. Attempting Linux Usage

```
# WRONG: Installing the Blender connector on Linux
# The connector does NOT support Linux, even though Blender runs on Linux.

# CORRECT: Use Windows or macOS only
# If Linux is the only available platform, use the Speckle web viewer
# or SpecklePy SDK for data access instead of the Blender connector.
```

**WHY**: The Speckle Blender connector is built and tested for Windows and macOS ONLY. There is no Linux build. Attempting to install or run it on Linux will fail. This is a hard platform constraint, not a compatibility issue that can be worked around.

---

## 2. Publishing Cameras and Lights

```
# WRONG: Expecting cameras and lights to transfer through Speckle
Scene Collection
├── Building (mesh) ✓ Published
├── Camera ✗ Silently excluded
├── Sun Light ✗ Silently excluded
└── Point Light ✗ Silently excluded

# CORRECT: Only include mesh and curve objects in publish expectations
# Add cameras and lights manually in the receiving application
```

**WHY**: The Speckle Blender connector does NOT support cameras or lights. These objects are silently excluded during publish — no error, no warning. Users who expect scene setup to transfer will find empty scenes in the receiving application.

---

## 3. Expecting Custom Properties on Receive

```
# WRONG: Assuming Revit parameters are accessible in Blender after loading
# "I'll load the Revit model and read the wall type from Blender object properties"
# → Properties are NOT attached to loaded Blender objects

# CORRECT: Access properties through the Speckle web viewer or API
# Properties exist in the Speckle data model but are not mapped to Blender
```

**WHY**: The Blender connector does NOT load custom properties onto received objects. Properties from source applications (Revit parameters, Rhino user strings, AutoCAD XData) are preserved in the Speckle data model and visible in the web viewer, but the Blender connector does not attach them to Blender objects. This is a known limitation, not a bug.

---

## 4. Using Unsupported Shader Types

```
# WRONG: Using custom shader node groups and expecting material transfer
Material: "Architectural_Glass"
  Shader: Custom Node Group → Mix Shader → Output
  Result: Falls back to viewport display color only

# CORRECT: Use one of the 4 supported shader types
Material: "Architectural_Glass"
  Shader: Glass BSDF → Output
  Result: Color and IOR transfer correctly to Speckle
```

**WHY**: The Blender connector recognizes EXACTLY four shader types: Principled BSDF, Diffuse BSDF, Emission, and Glass BSDF. Any other shader — including custom node groups, Shader to RGB chains, Mix Shaders without a recognized base shader, or Volume shaders — causes a fallback to basic viewport display color. All PBR properties (metallic, roughness, IOR) are lost.

---

## 5. Relying on Texture Transfer

```
# WRONG: Applying image textures to materials and expecting them in Speckle
Material: "Brick_Wall"
  Principled BSDF:
    Base Color ← Image Texture ("brick_diffuse.png")
    Normal ← Normal Map ← Image Texture ("brick_normal.png")
  Result: Only the solid color fallback transfers. Textures are lost.

# CORRECT: Use solid color values for material properties
Material: "Brick_Wall"
  Principled BSDF:
    Base Color: (0.6, 0.3, 0.2)  # Approximate brick color
    Roughness: 0.85
  Result: Color and roughness transfer correctly
```

**WHY**: Speckle does NOT support textures across ANY connector. Image textures, procedural textures, UV mapping data, and normal maps do NOT survive the Speckle pipeline. Only scalar material properties (color RGB, opacity, metallic, roughness) transfer. Plan material workflows around solid colors and material properties, not textures.

---

## 6. Forgetting Apply Modifiers for Final Geometry

```
# WRONG: Publishing without Apply Modifiers when modifiers define the design
Object: "Facade_Panel"
  Base mesh: flat plane
  Modifiers: Array (10x), Solidify (5cm), Bevel
  Published WITHOUT Apply Modifiers → Only the flat plane is sent

# CORRECT: Enable Apply Modifiers
Object: "Facade_Panel"
  Published WITH Apply Modifiers → Full arrayed, solidified, beveled geometry is sent
```

**WHY**: Without Apply Modifiers, the connector publishes the base mesh BEFORE modifier evaluation. Subdivision Surface, Array, Mirror, Boolean, Solidify, and other modifiers are NOT applied. The receiving application sees only the unmodified base geometry, which may be completely different from the intended design.

---

## 7. Expecting Bidirectional Property Round-Trip

```
# WRONG: Workflow assumption
1. Publish Blender model with custom properties → Speckle
2. Load into Revit → Direct Shapes (no custom properties in Revit either)
3. Load back into Blender → Expect original properties
Result: Properties are lost at step 3

# CORRECT: Treat Speckle as geometry + basic materials for Blender
# Use the Speckle web API or SpecklePy for property access
# Use the web viewer for property inspection
```

**WHY**: The Blender connector does not load custom properties on receive. Combined with the fact that Revit also does not import custom properties on load, properties are effectively lost in any round-trip workflow involving Blender. ALWAYS use the Speckle web viewer or API for property-dependent workflows.

---

## 8. Wrong Block Loading Mode for Large Models

```
# WRONG: Using Linked Duplicates for a model with 5000+ repeated elements
# Result: 5000 individual mesh objects, high memory usage, slow viewport

# CORRECT: Use Collection Instances (default) for large models
# Result: Efficient instancing, low memory footprint, fast viewport
```

**WHY**: Linked Duplicates create individual objects for each instance, which scales poorly for models with many repeated elements (e.g., hundreds of identical windows from a Revit model). Collection Instances use Blender's native instancing system, which is significantly more memory-efficient and viewport-performant. ONLY use Linked Duplicates when individual instance editing is specifically required.

---

## 9. Publishing from Unsupported Blender Versions

```
# WRONG: Using the Speckle connector with Blender 3.x or earlier
# The connector supports Blender 4.2 through 5.0 ONLY

# CORRECT: Verify Blender version is 4.2, 4.3, 4.4, 4.5, or 5.0
# Upgrade Blender if necessary before installing the connector
```

**WHY**: The Speckle Blender connector is built against the Blender 4.2+ Python API. Earlier versions have different API surfaces and are NOT supported. The connector may fail to install, fail to load, or produce incorrect results on unsupported versions.
