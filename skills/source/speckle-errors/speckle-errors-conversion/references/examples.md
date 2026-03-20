# Working Examples: Diagnosing and Fixing Conversion Errors

## Example 1: Diagnosing Missing Objects After Revit-to-Blender Transfer

**Scenario**: An architect publishes a Revit model to Speckle. A visualization artist loads it into Blender. Several objects are missing.

**Step 1**: Verify objects exist in the Speckle web viewer.
```
Open https://app.speckle.systems/projects/{projectId}/models/{modelId}
Navigate to the missing objects in the viewer tree
→ Objects ARE visible in the web viewer
```

**Step 2**: Check displayValue geometry types.
```json
// Object in Speckle (inspected via web viewer or GraphQL)
{
  "speckle_type": "Objects.Data.DataObject:Objects.Data.RevitObject",
  "category": "Annotation",
  "displayValue": []
}
```

**Step 3**: Identify the cause.
- The `displayValue` is empty — these are annotation objects (gridlines, dimensions)
- Blender cannot create annotation objects
- Objects with empty `displayValue` are silently skipped

**Fix**: Accept that annotation objects do not transfer to Blender. Filter them out before loading, or publish only Model category objects from Revit.

---

## Example 2: Fixing Unit Mismatch Between Rhino (mm) and Revit (ft)

**Scenario**: A Rhino model published in millimeters appears 304.8x too large when loaded into a Revit project using feet.

**Step 1**: Check object units in Speckle.
```json
{
  "speckle_type": "Objects.Geometry.Mesh",
  "units": "mm",
  "vertices": [0, 0, 0, 1000, 0, 0, 1000, 1000, 0]
}
```

**Step 2**: Check Revit project units.
```
Revit Project Units: Imperial (feet)
Expected: 1000mm = 3.28 ft
Actual display: objects appear at coordinates 1000, 1000 in Revit's unit space
→ The connector should handle the conversion automatically
```

**Step 3**: Diagnose.
- If automatic conversion failed: check that the `units` field is correctly populated
- If the `units` field is missing or null, the connector cannot convert
- Verify the Revit connector version — older versions may have conversion bugs

**Fix**:
- ALWAYS ensure the `units` field is populated on every geometry object
- In SpecklePy, ALWAYS set `mesh.units = "mm"` (or appropriate unit) explicitly
- Verify the Revit reference point setting matches the publish configuration

---

## Example 3: Resolving Material Loss in Cross-Connector Transfer

**Scenario**: A Revit model with named materials loads into Rhino, but all objects appear without materials.

**Step 1**: Check RenderMaterial proxies in Speckle.
```json
// Root collection contains:
{
  "speckle_type": "Objects.Other.RenderMaterialProxy",
  "name": "Concrete - Cast-in-Place",
  "value": {
    "diffuse": 4289374890,
    "opacity": 1.0,
    "roughness": 0.8
  },
  "objects": ["1234567", "1234568", "1234569"]
}
```

**Step 2**: Verify proxy references resolve.
```json
// Check that target objects have matching applicationId
{
  "speckle_type": "Objects.Data.DataObject:Objects.Data.RevitObject",
  "applicationId": "1234567",
  "displayValue": [{ "speckle_type": "Objects.Geometry.Mesh", "..." : "..." }]
}
```

**Step 3**: If applicationIds match, the proxy SHOULD resolve.
- Rhino supports RenderMaterial proxies — materials should transfer
- If materials still missing: check Rhino connector version
- If loading into Blender: only Principled, Diffuse, Emission, Glass shaders are created

**Fix**:
- Verify all objects have `applicationId` values that match proxy references
- For Blender: accept that only basic material properties transfer (color, opacity, metalness, roughness)
- For connectors that support RenderMaterial: update to the latest connector version

---

## Example 4: Debugging Grasshopper Change Tracking Failure

**Scenario**: A Grasshopper script publishes objects to Speckle. On second publish, instead of updating existing objects, all objects are duplicated.

**Step 1**: Inspect applicationIds in the published data.
```json
// First publish
{ "applicationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }

// Second publish (after Grasshopper re-solve)
{ "applicationId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321" }
```

**Step 2**: Identify the cause.
- Grasshopper parameters generate new GUIDs on every solve
- The `applicationId` changed between publishes
- Speckle treats them as entirely new objects instead of updates

**Fix**: Use passthrough nodes to preserve applicationIds.
```
1. Publish the initial model
2. Load the published model back into Grasshopper (Load component)
3. Use Speckle Geometry Passthrough or Data Object Passthrough nodes
4. Feed loaded objects through passthrough nodes for modification
5. Passthrough nodes preserve the original applicationId
6. Republish — Speckle now recognizes objects as updates
```

---

## Example 5: Fixing Invisible Objects Due to Empty displayValue

**Scenario**: A SpecklePy script publishes custom objects. They appear in the Speckle object tree but render as invisible in the viewer.

**Step 1**: Inspect the published object.
```python
# The problematic code
obj = Base()
obj.speckle_type = "Objects.Data.DataObject"
obj.properties = {"name": "Custom Wall", "height": 3.0}
# Missing: obj.displayValue = [mesh]
```

**Step 2**: The object has no `displayValue` — nothing to render.

**Fix**: ALWAYS provide displayValue with at least one Mesh.
```python
from specklepy.objects.geometry import Mesh
from specklepy.objects import Base

# Create renderable geometry
mesh = Mesh()
mesh.vertices = [0, 0, 0, 5, 0, 0, 5, 0, 3, 0, 0, 3,
                 0, 0.2, 0, 5, 0.2, 0, 5, 0.2, 3, 0, 0.2, 3]
mesh.faces = [
    4, 0, 1, 2, 3,  # front face
    4, 4, 5, 6, 7,  # back face
    4, 0, 1, 5, 4,  # bottom
    4, 2, 3, 7, 6,  # top
    4, 0, 3, 7, 4,  # left
    4, 1, 2, 6, 5   # right
]
mesh.units = "m"

# Attach to DataObject
obj = Base()
obj.speckle_type = "Objects.Data.DataObject"
obj.displayValue = [mesh]
obj.properties = {"name": "Custom Wall", "height": 3.0}
obj.units = "m"
```

---

## Example 6: Diagnosing AutoCAD Solid-to-Mesh Conversion

**Scenario**: An engineer publishes AutoCAD 3D solids to Speckle. When loaded into Rhino, the solids appear as mesh objects instead of NURBS surfaces.

**Step 1**: Check the published geometry type in Speckle.
```json
{
  "speckle_type": "Objects.Geometry.Mesh",
  "vertices": [0, 0, 0, 100, 0, 0, "..."],
  "faces": [3, 0, 1, 2, 3, 2, 3, 4, "..."],
  "units": "mm"
}
```

**Step 2**: Identify the cause.
- AutoCAD solids are ALWAYS converted to Mesh on publish
- This conversion is hardcoded in the AutoCAD connector
- The original solid topology is permanently lost

**Fix**: No fix exists within the Speckle pipeline. Alternatives:
- Export solids via STEP/IGES format for lossless solid exchange
- Accept mesh representation for visualization-only workflows
- Use Rhino connector for Brep-to-Brep workflows (Rhino preserves NURBS)

---

## Example 7: Resolving Blender Shader Fallback

**Scenario**: A Blender model with custom shader nodes loads from Speckle with incorrect materials — all appear as flat gray.

**Step 1**: Check the shader types in the Blender file.
```
Material "Metal_Custom" → Uses a Mix Shader node (NOT one of the 4 supported types)
Material "Glass_Window" → Uses Glass BSDF (supported)
```

**Step 2**: Identify the cause.
- Blender connector recognizes ONLY: Principled BSDF, Diffuse BSDF, Emission, Glass BSDF
- "Mix Shader" and all other node types fall back to basic material attributes
- The basic fallback often produces gray/default appearance

**Fix**: Replace unsupported shaders with Principled BSDF before publishing.
```
1. Select the material with the unsupported shader
2. Replace the Mix Shader with Principled BSDF
3. Configure: Base Color, Metallic, Roughness, Alpha
4. Publish — these four properties transfer to Speckle
```

ALWAYS use Principled BSDF as the default shader for cross-application workflows. It provides the best property coverage (color, metalness, roughness, opacity).

---

## Example 8: Debugging Archicad Model Positioning Error

**Scenario**: A Revit model loaded into Archicad appears offset by several hundred meters from the origin.

**Step 1**: Check Revit publish reference point setting.
```
Revit publish setting: "Survey Point" selected
Survey Point offset from Internal Origin: X=150m, Y=200m
```

**Step 2**: Check the `referencePointTransform` on published objects.
```json
{
  "referencePointTransform": [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    150, 200, 0, 1
  ]
}
```

**Step 3**: Archicad does not have an equivalent reference point alignment mechanism.

**Fix**:
- Republish from Revit using "Internal Origin" as the reference point
- Internal Origin provides the most predictable positioning for cross-application transfers
- ALWAYS use Internal Origin when the target application is Archicad
