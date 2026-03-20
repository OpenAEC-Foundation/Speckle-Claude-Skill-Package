# Anti-Patterns: Conversion Errors

## AP-1: Expecting Native Element Recreation on Load

```
WRONG assumption:
  "I published Revit walls to Speckle and loaded them back into Revit.
   I expect to see native Revit Wall elements with editable parameters."

REALITY:
  Speckle ALWAYS creates Direct Shapes in Revit.
  Speckle ALWAYS creates GDL Objects in Archicad.
  There is NO native element reconstruction in ANY connector.
```

**WHY**: Reconstructing native elements requires the full parametric definition (family, type, constraints, hosted elements). Speckle preserves geometry and properties but does NOT preserve the parametric engine state. Direct Shapes are the safe, universal fallback.

---

## AP-2: Publishing Properties and Expecting Them on Receive

```
WRONG workflow:
  1. Publish Revit model with custom shared parameters
  2. Load into Blender for visualization
  3. Expect custom parameters to appear on Blender objects

REALITY:
  Blender does NOT attach properties to received objects.
  Revit does NOT load custom properties on received objects.
  Archicad does NOT load custom properties on received objects.
```

**WHY**: Host applications have different property systems (Revit parameters, Blender custom properties, Archicad user properties). The connectors prioritize geometry fidelity over property attachment. Properties ARE preserved in Speckle's data model — access them via the web viewer or GraphQL API.

**Safe connectors for property round-trip**: Rhino (user strings), SketchUp (user attributes), Power BI (table columns).

---

## AP-3: Assuming Bidirectional Capability

```
WRONG:
  "All Speckle connectors can publish AND load."

REALITY:
  Tekla Structures → PUBLISH ONLY (no load/receive)
  Power BI → READ ONLY (no publish)
```

**WHY**: Each connector is developed independently based on the host application's API capabilities and user demand. ALWAYS verify publish/load support before designing a data exchange workflow.

---

## AP-4: Using Brep/NURBS for Cross-Connector Exchange

```
WRONG:
  Publish Brep geometry from Rhino, expect Brep in Revit/Blender/AutoCAD.

REALITY:
  Brep data is preserved in Speckle's data model.
  ONLY Rhino can reconstruct Brep on receive.
  ALL other connectors convert Brep to Mesh.
```

**WHY**: Brep (Boundary Representation) requires NURBS surface evaluation capabilities. Only Rhino has a native NURBS engine. Other connectors tessellate to mesh for display. ALWAYS use Mesh in `displayValue` for cross-connector workflows.

---

## AP-5: Ignoring the units Field

```
WRONG:
  obj = Base()
  obj.vertices = [0, 0, 0, 1000, 0, 0]
  # No units field set

REALITY:
  Without units, the connector cannot perform unit conversion.
  Objects may appear at wildly incorrect scale.
  No error message is generated.
```

**WHY**: Unit conversion depends on both source and target unit systems. If the source `units` field is missing, the connector has no basis for conversion. ALWAYS set `units` on every geometry object.

---

## AP-6: Relying on Texture Transfer

```
WRONG:
  "I applied UV-mapped textures to my Rhino model.
   They will appear in the Speckle viewer and target applications."

REALITY:
  Speckle does NOT support textures across ANY connector.
  Only material properties transfer: color, opacity, metalness, roughness.
  UV coordinates are stored but NOT rendered.
```

**WHY**: Texture file management (paths, embedding, format conversion) is outside Speckle's current scope. The RenderMaterial proxy carries only numeric material properties. Plan for flat-color materials in all Speckle workflows.

---

## AP-7: Publishing Solids from AutoCAD and Expecting Solid Output

```
WRONG:
  "I published AutoCAD 3D solids. They should load as solids in Rhino."

REALITY:
  AutoCAD solids are ALWAYS converted to Mesh on publish.
  This conversion is irreversible.
  The solid topology is permanently lost in the Speckle pipeline.
```

**WHY**: The AutoCAD connector uses mesh tessellation as its conversion strategy for solids. This is a design decision in the connector, not a limitation of Speckle's data model. Use STEP/IGES export for lossless solid exchange.

---

## AP-8: Using Non-Standard Shaders in Blender

```
WRONG:
  Using Mix Shader, Velvet BSDF, Toon BSDF, or custom node groups.

CORRECT:
  Use ONLY Principled BSDF, Diffuse BSDF, Emission, or Glass BSDF.
```

**WHY**: The Blender connector has a hardcoded shader recognition list. Any shader type not in the list falls back to basic material attributes (often appearing as flat gray). Principled BSDF provides the best property coverage for cross-application workflows.

---

## AP-9: Grasshopper: Creating New Objects Instead of Mutating Existing Ones

```
WRONG:
  1. Create geometry in Grasshopper
  2. Publish to Speckle
  3. Modify geometry in Grasshopper (new solve = new GUIDs)
  4. Publish again → all objects appear as NEW (duplicated)

CORRECT:
  1. Create and publish initial geometry
  2. Load the published model back into Grasshopper
  3. Use passthrough nodes to modify loaded objects
  4. Republish → objects update in place (applicationId preserved)
```

**WHY**: Grasshopper parameters lack persistent GUIDs. Every Grasshopper solve generates new GUIDs, which become new `applicationId` values. Speckle uses `applicationId` for change tracking. Passthrough nodes inherit the loaded objects' applicationIds, enabling proper update detection.

---

## AP-10: Assuming Reference Point Consistency Across Applications

```
WRONG:
  "I published from Revit using Survey Point coordinates.
   It will align perfectly when loaded into Archicad/Rhino/Blender."

REALITY:
  Each application has different coordinate system conventions.
  Revit offers 3 reference points: Internal Origin, Project Base, Survey Point.
  Other applications have their own origin systems.
  Misaligned reference points cause positioning errors with NO warning.
```

**WHY**: The `referencePointTransform` matrix encodes the offset from the chosen reference point. If the target application does not apply this transform (or applies it differently), objects appear at incorrect positions. ALWAYS use Internal Origin for cross-application workflows — it provides the most predictable positioning.

---

## AP-11: Applying Materials to SketchUp Components Instead of Faces

```
WRONG:
  Select component → Apply material to component

CORRECT:
  Enter component → Select faces → Apply material to faces
```

**WHY**: SketchUp allows materials at both the component level and face level. The Speckle connector reads face-level materials for cross-application transfer. Component-level materials may not be picked up correctly, resulting in missing or incorrect materials in the target application.

---

## AP-12: Expecting 2D Documentation Transfer from Revit

```
WRONG:
  "I published my Revit project. Plans, sections, and elevations
   will be available in Speckle."

REALITY:
  Revit ONLY publishes 3D perspective views.
  Plans, sections, elevations, and orthographic 3D views are
  silently excluded. No error or warning is generated.
```

**WHY**: Speckle focuses on 3D model data exchange. 2D documentation (floor plans, sections, elevations) requires the Revit view engine for proper generation. These view types are architectural documentation artifacts, not transferable geometry. Use Revit's native export tools (PDF, DWG) for 2D documentation exchange.

---

## AP-13: Nesting DataObjects Inside DataObjects

```
WRONG assumption:
  "I can nest a RevitObject inside another RevitObject as a child element."

REALITY:
  DataObjects (RevitObject, ArchicadObject, TeklaObject, Civil3dObject)
  generally CANNOT contain other DataObjects as direct children.
  Geometry is EXCLUSIVELY in displayValue.
  Hierarchy is expressed through Collections, NOT nesting.
```

**WHY**: The Speckle data schema separates hierarchy (Collections) from data (DataObjects). A Collection can contain other Collections and DataObjects, but a DataObject's children are geometry (in `displayValue`) and properties. Exceptions exist (Revit curtain walls, IFC `elements` property) but NEVER assume nesting is supported for arbitrary element types.
