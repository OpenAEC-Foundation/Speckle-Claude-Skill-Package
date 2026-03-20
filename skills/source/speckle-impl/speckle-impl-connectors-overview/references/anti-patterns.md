# anti-patterns.md — Common Mistakes with Speckle Connectors

## AP-1: Expecting Native Element Recreation on Load

**Wrong assumption**: "When I load a Revit model back into Revit from Speckle, I will get native walls, doors, and floors."

**Reality**: Revit ALWAYS creates Direct Shapes (generic models). Archicad ALWAYS creates GDL Objects. There is NO native element reconstruction from Speckle data in ANY connector.

**Why**: Speckle's data model stores geometry as interoperable primitives (Mesh, Line, Point) in `displayValue`. The semantic information (wall type, door family) is preserved in `properties` but the conversion pipeline does not reconstruct native parametric elements.

**Fix**: Design workflows knowing that cross-tool exchange produces generic geometry. Use Speckle for coordination and visualization, not for native element round-tripping.

---

## AP-2: Publishing Custom Properties and Expecting Round-Trip

**Wrong assumption**: "I published custom properties from Revit. When I load the model in Blender, those properties will be attached to the objects."

**Reality**: Multiple connectors do NOT load custom properties back onto received objects:
- Revit: "Currently, you can not load any custom properties on your Speckle model objects into Revit."
- Blender: "Properties are not loaded and attached to loaded objects."
- Archicad: No custom property loading into Archicad.

**Why**: Each host application has different property systems. Attaching arbitrary key-value pairs to native objects requires connector-specific mapping that is not universally implemented.

**Fix**: ALWAYS verify property round-trip behavior for your specific connector pair. Properties ARE preserved in Speckle's data model and visible in the web viewer. Use Power BI or the GraphQL API to access properties programmatically.

---

## AP-3: Assuming Bidirectional Capability for All Connectors

**Wrong assumption**: "Every Speckle connector can both publish and load data."

**Reality**:
- **Tekla**: Publish-only. There is NO receive/load functionality.
- **Power BI**: Read-only. It loads data for visualization but NEVER publishes.

**Fix**: ALWAYS check the connector matrix before designing a workflow. Verify both publish AND load capability for every connector in your pipeline.

---

## AP-4: Publishing Non-Perspective Views from Revit

**Wrong assumption**: "I can publish floor plans, sections, and elevations from Revit to Speckle."

**Reality**: Revit ONLY publishes 3D perspective views. Plans, sections, elevations, and orthographic 3D views are silently excluded -- no error message, no warning.

**Fix**: Do NOT rely on Speckle for 2D documentation exchange from Revit. Use dedicated BIM collaboration tools for drawing exchange.

---

## AP-5: Using Unsupported Shader Types in Blender

**Wrong assumption**: "Any Blender shader will transfer correctly through Speckle."

**Reality**: The Blender connector recognizes exactly four shader types:
1. Principled BSDF
2. Diffuse BSDF
3. Emission
4. Glass BSDF

Any other shader falls back to basic material attributes, losing specific shader properties.

**Fix**: ALWAYS use one of the four supported shaders when materials must transfer accurately through Speckle. Convert custom shaders to Principled BSDF before publishing.

---

## AP-6: Ignoring Solids-to-Mesh Conversion in AutoCAD/Civil 3D

**Wrong assumption**: "My AutoCAD solids will remain as solids in Speckle."

**Reality**: Solids are ALWAYS published as Mesh geometry. This conversion is automatic and irreversible in the Speckle pipeline.

**Fix**: If downstream workflows require solid geometry (e.g., Boolean operations, volume calculations on exact geometry), the Speckle connector pipeline is NOT suitable for that specific data type. Export solids through alternative formats.

---

## AP-7: Publishing from Tekla Drawing Views

**Wrong assumption**: "I can publish Tekla drawing layouts to Speckle."

**Reality**: Tekla can ONLY publish from the model viewport. Drawing views, title blocks, numbering series, and assembly information are NOT supported.

**Fix**: ALWAYS ensure you are in the model viewport before publishing. Do NOT expect drawing-level data to transfer.

---

## AP-8: Applying Materials to SketchUp Components Instead of Faces

**Wrong assumption**: "Applying a material to a SketchUp component is the same as applying it to faces."

**Reality**: Materials applied at the component level may NOT display correctly when loaded in other applications. Face-level material application is the ONLY reliable method for cross-application fidelity.

**Fix**: ALWAYS apply materials to faces, not components, when the model will be exchanged through Speckle.

---

## AP-9: Grasshopper Change Tracking Without Passthrough Nodes

**Wrong assumption**: "Grasshopper will track changes between publish cycles automatically."

**Reality**: Grasshopper parameters lack persistent GUIDs. New GUIDs are generated on every Grasshopper solve, which breaks Speckle's change tracking system entirely.

**Fix**: ALWAYS use passthrough nodes to mutate existing loaded objects (this preserves `applicationId` values). For new models: create objects once, publish, reload, then use passthrough nodes for all subsequent modifications.

---

## AP-10: Expecting Linux Support for Blender Connector

**Wrong assumption**: "Since Blender runs on Linux, the Speckle Blender connector works on Linux too."

**Reality**: The Blender connector supports Windows and macOS ONLY. There is NO Linux support.

**Fix**: Use Windows or macOS for Blender-to-Speckle workflows. For Linux environments, use SpecklePy or the GraphQL API for programmatic access instead.

---

## AP-11: Neglecting Reference Point Configuration in Revit

**Wrong assumption**: "Model positioning will be correct regardless of reference point settings."

**Reality**: Objects appear in incorrect positions when reference point settings are not aligned between publish and load operations. Revit offers three options: Internal Origin, Project Base, and Survey Point.

**Fix**: ALWAYS verify that the reference point setting is consistent between publish and load operations. Document the chosen reference point in project standards. When coordinating with Archicad models, expect positioning issues (Archicad lacks equivalent reference point controls).

---

## AP-12: Expecting Texture Support Through Speckle

**Wrong assumption**: "Textures and UV mappings will transfer through Speckle to other applications."

**Reality**: Speckle does NOT support textures across ANY connector. Only material properties transfer:
- Color (RGB via diffuse integer)
- Opacity (0.0 to 1.0)
- Metalness (0.0 to 1.0)
- Roughness (0.0 to 1.0)

Texture files, UV coordinates, and bump maps do NOT survive the pipeline.

**Fix**: Re-apply textures in the target application after loading from Speckle. Use RenderMaterial properties for basic material appearance only.

---

## AP-13: Assuming DataObject Nesting

**Wrong assumption**: "A RevitObject can contain other RevitObjects as children."

**Reality**: DataObjects (RevitObject, ArchicadObject, TeklaObject, Civil3dObject) generally do NOT contain other DataObjects as direct children. Geometry is exclusively in `displayValue`. The hierarchy is expressed through Collections, not through object nesting.

**Exceptions**: Revit curtain walls and IFC data with `elements` property MAY contain nested structures. These are special cases and MUST NOT be assumed as general behavior.

**Fix**: Use the Collection hierarchy (File > Level > Category > Type) to navigate object relationships. Access child geometry through `displayValue`, not through nested DataObjects.

---

## AP-14: Referencing Objects by id Instead of applicationId in Proxy Logic

**Wrong assumption**: "I can use the object `id` to track objects across versions."

**Reality**: The `id` field is a content-based hash (SHA256). It changes whenever ANY data in the object changes. When a wall is modified and republished, its `id` is different.

**Fix**: ALWAYS use `applicationId` for cross-version tracking. The `applicationId` (Revit ElementId, Rhino GUID, AutoCAD Handle) remains stable across publish cycles. All proxy references use `applicationId`, never `id`.

---

## AP-15: Using Power BI Without Understanding Data Gateway Requirements

**Wrong assumption**: "Power BI scheduled refresh works out of the box with Speckle."

**Reality**: A Data Gateway is required ONLY for scheduled refresh in Power BI Service. Basic connector usage and 3D visualization work without a gateway. IT administrators may need to add the Speckle thumbprint to the Windows registry for third-party data source approval.

**Fix**: For desktop use, no gateway needed. For Power BI Service scheduled refresh, install and configure the Data Gateway. Contact IT for third-party data source approval if needed.

---

## AP-16: Ignoring Collection Hierarchy Differences Across Connectors

**Wrong assumption**: "All connectors organize data the same way in Speckle."

**Reality**: Each connector preserves its native hierarchy:
- Revit: File > Level > Category > Type
- Rhino: File > Layer > Sublayer
- AutoCAD/Civil 3D: File > Layer
- Archicad: File > Floor > Type
- Tekla: File > Type

Consumers of federated data MUST account for these structural differences when querying or filtering objects.

**Fix**: When building queries against federated models, ALWAYS check the source connector's hierarchy pattern. Use `speckle_type` to identify object origins rather than assuming uniform collection structure.
