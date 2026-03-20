# Working Workflow Examples (Speckle Blender Connector)

## Example 1: Publishing a Blender Model to Speckle

### Scenario
An architect has modeled a building facade in Blender with Principled BSDF materials and wants to share it with the engineering team via Speckle.

### Steps

1. **Organize objects in collections**:
   ```
   Scene Collection
   ├── Facade
   │   ├── Glass_Panels (mesh, Glass BSDF material)
   │   ├── Steel_Frame (mesh, Principled BSDF material)
   │   └── Cladding (mesh, Principled BSDF material)
   └── Structure
       └── Columns (mesh, Principled BSDF material)
   ```

2. **Verify material setup**: ALWAYS use Principled, Diffuse, Emission, or Glass BSDF shaders. Check that no objects use custom shader groups or unsupported shader types.

3. **Enable Apply Modifiers**: If objects have Mirror, Array, Subdivision Surface, or Boolean modifiers that represent the final design, enable "Apply Modifiers" in the publish settings.

4. **Publish**: Select the target Speckle project and model, then click Publish.

### Result in Speckle
- Collection hierarchy preserved (Facade > Glass_Panels, Steel_Frame, Cladding; Structure > Columns)
- Glass panels carry Glass BSDF properties (color, IOR)
- Steel and cladding carry Principled BSDF properties (color, metallic, roughness)
- All geometry is mesh format

---

## Example 2: Loading a Revit Model into Blender for Visualization

### Scenario
A visualization artist needs to load an architectural Revit model into Blender for rendering.

### Steps

1. **Open the Speckle connector** in Blender
2. **Select the project and model** containing the Revit publish
3. **Choose block loading mode**:
   - Use **Collection Instances** (default) for large models with many repeated families (doors, windows, furniture)
   - Use **Linked Duplicates** if individual instances need unique modifications
4. **Click Load** — the latest version loads by default

### Result in Blender
- Revit hierarchy appears as Blender collections (Level > Category > Type)
- All geometry loads as mesh objects
- Materials load as Principled BSDF shaders with color, metallic, roughness
- Revit parameters are NOT available in Blender (visible only in Speckle web viewer)

### Post-Processing for Rendering
- Materials are editable — add textures, adjust shader nodes
- Material edits persist when loading updated versions from Speckle
- Add cameras and lights manually (these are NOT supported by the connector)

---

## Example 3: Material Persistence Across Version Updates

### Scenario
A team loads a structural model into Blender, customizes materials for presentation, then needs to update to a newer version.

### Steps

1. **Initial load**: Load version 1 of the model
2. **Customize materials**:
   - Change concrete material color from grey to warm beige
   - Adjust steel material metallic value to 0.9
   - Add custom roughness texture to floor material
3. **Load updated version**: When version 2 is published, load it in the same Blender file
4. **Materials persist**: Materials with matching names retain the customizations from step 2

### Key Behavior
- Material matching is by NAME — if the source application renames a material, a new material is created
- Only materials with identical names are reused
- New materials from the updated model are added alongside existing customized ones

---

## Example 4: Publishing Curves for Grasshopper Consumption

### Scenario
A designer creates parametric curves in Blender that need to be loaded into Grasshopper for structural analysis.

### Steps

1. **Create curves in Blender**: Use Bezier or NURBS curves for design lines
2. **Organize in collections**: Group curves by function (e.g., "Primary Structure", "Secondary Bracing")
3. **Publish to Speckle**: Apply Modifiers setting is irrelevant for curves (no mesh modifiers)
4. **Load in Grasshopper**: Use the Load component to fetch the model, then Query Objects to extract curve geometry

### Supported Curve Types
- Bezier curves → Speckle Curve objects
- NURBS curves → Speckle Curve objects
- Bezier circles → Speckle Curve objects
- NURBS circles → Speckle Curve objects

---

## Example 5: Multi-Application Federation with Blender

### Scenario
A project team uses Revit (architecture), Tekla (structure), and Blender (landscape/visualization) with Speckle as the data hub.

### Blender's Role in the Federation

1. **Publish landscape model** from Blender:
   - Terrain mesh, vegetation (mesh instances), site furniture
   - ALWAYS use supported shader types for material transfer
   - Enable Apply Modifiers for any procedural geometry

2. **Load federated model** into Blender for visualization:
   - Load both Revit and Tekla models into Blender
   - Each source model maintains its collection hierarchy
   - Add Blender-specific elements (cameras, lights, HDRIs) manually
   - Customize materials for final rendering

### Important Considerations
- Blender receives mesh geometry from all sources — no native BIM elements
- Custom properties from Revit/Tekla are NOT available in Blender
- Block instances from Revit families load based on the selected block loading mode
- Tekla structural elements load as mesh geometry with materials

---

## Example 6: Handling the Apply Modifiers Setting

### When to Enable Apply Modifiers

| Modifier Type | Enable? | Reason |
|---------------|---------|--------|
| Subdivision Surface | Yes | Downstream consumers need the smooth geometry |
| Mirror | Yes | The mirrored half is part of the design |
| Array | Yes | Repeated elements should appear in the published model |
| Boolean | Yes | Cut geometry represents the final design intent |
| Solidify | Yes | Wall thickness is needed for accurate representation |

### When to Disable Apply Modifiers

| Scenario | Reason |
|----------|--------|
| Base geometry for parametric reuse | Modifiers would bake resolution/detail prematurely |
| Testing/iteration | Faster publish without modifier evaluation |
| Curves with mesh modifiers | Curves are published as curves regardless |

---

## Example 7: Correct vs. Incorrect Shader Setup

### Correct: Using Supported Shaders

```
Material "Concrete_Wall":
  Shader: Principled BSDF
  Base Color: (0.6, 0.6, 0.55)
  Roughness: 0.8
  Metallic: 0.0
  → Transfers fully to Speckle RenderMaterial
```

```
Material "Glass_Facade":
  Shader: Glass BSDF
  Color: (0.9, 0.95, 1.0)
  IOR: 1.52
  → Transfers fully to Speckle RenderMaterial
```

### Incorrect: Using Unsupported Shaders

```
Material "Custom_PBR":
  Shader: Custom Node Group "Advanced_PBR"
  → Falls back to viewport display color ONLY
  → Metallic, roughness, IOR — ALL LOST
```

```
Material "Toon_Render":
  Shader: Shader to RGB → ColorRamp
  → Falls back to viewport display color ONLY
  → No toon shading information transfers
```

**ALWAYS** rewire materials to one of the 4 supported shader types before publishing if material fidelity matters.
