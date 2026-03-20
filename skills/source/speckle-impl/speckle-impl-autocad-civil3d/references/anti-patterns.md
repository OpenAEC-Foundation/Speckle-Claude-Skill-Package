# Anti-Patterns (AutoCAD / Civil 3D Connector)

## AP-1: Expecting Solids to Survive the Pipeline

```
WRONG assumption:
  AutoCAD 3D Solid → Publish to Speckle → Load in Rhino → 3D Solid/Brep

ACTUAL behavior:
  AutoCAD 3D Solid → Publish to Speckle → Mesh → Load in Rhino → Mesh
```

**WHY**: The AutoCAD/Civil 3D connector ALWAYS converts 3D solids to Mesh geometry during publishing. This is a one-way conversion — the original solid boundary representation is permanently lost. No downstream application receives a solid, only a triangulated mesh.

**Impact**: Boolean operations, mass property calculations from solids, and solid-based clash detection are impossible on the received data. Volume calculations from the mesh are approximate, not exact.

**ALWAYS**: Warn users that solid geometry will be degraded to mesh. If exact solid geometry is required downstream, export via STEP/SAT/IGES instead of Speckle.

---

## AP-2: Using displayValue Instead of baseCurves for Civil 3D Analysis

```
WRONG:
  alignment = civil3d_object
  geometry = alignment["displayValue"]  # Returns a mesh ribbon
  # Attempting to extract stations, offsets, or profile data from mesh → garbage

CORRECT:
  alignment = civil3d_object
  geometry = alignment["baseCurves"]  # Returns the actual design curve
  # Polycurve with tangent, arc, and spiral segments → meaningful geometry
```

**WHY**: `displayValue` contains the VISUAL representation — typically a mesh ribbon showing the road surface or a simplified 3D view. `baseCurves` contains the GEOMETRIC DEFINITION — the actual alignment centerline with tangent, arc, and spiral segments.

**Impact**: Using `displayValue` for station calculations, offset computations, or profile extraction produces meaningless results. The mesh ribbon vertices do NOT correspond to alignment geometry.

**ALWAYS**: Use `baseCurves` for any geometric analysis of Civil 3D entities. Reserve `displayValue` for visualization only.

---

## AP-3: Expecting Custom Properties to Load onto AutoCAD Objects

```
WRONG assumption:
  Revit model with parameters → Publish to Speckle → Load in AutoCAD
  → AutoCAD objects have Revit parameters as XData/Extension Dictionaries

ACTUAL behavior:
  Revit model with parameters → Publish to Speckle → Load in AutoCAD
  → AutoCAD objects have NO custom properties attached
```

**WHY**: The AutoCAD connector loads geometry, colors, and materials, but does NOT write custom properties (XData or Extension Dictionaries) onto loaded objects. Properties are preserved in the Speckle data model and visible in the web viewer, but are absent from the AutoCAD objects.

**ALWAYS**: Use the Speckle web viewer or Power BI to access properties from cross-application data. Do NOT build workflows that depend on property transfer into AutoCAD.

---

## AP-4: Assuming Layer Hierarchy Survives Loading

```
WRONG assumption:
  Revit: Level 1 > Walls > Basic Wall → AutoCAD layers preserve this hierarchy

ACTUAL behavior:
  Revit: Level 1 > Walls > Basic Wall → AutoCAD: flat layer "Level 1-Walls-Basic Wall"
  (or similar flattened representation)
```

**WHY**: AutoCAD layers are flat — they do NOT support hierarchical nesting (despite layer filters providing a visual hierarchy). When Speckle loads a hierarchical Collection structure from Revit, Archicad, or other BIM tools, the structure is FLATTENED to match the Speckle web viewer display.

**Impact**: Workflows that depend on navigating Revit's Level > Category > Type hierarchy through AutoCAD layers will fail. The organizational structure is lost.

**ALWAYS**: Plan for flat layer structures when loading into AutoCAD. Use naming conventions or Selection Sets to organize loaded objects.

---

## AP-5: Ignoring Coordinate System Differences with Civil 3D

```
WRONG assumption:
  Civil 3D model → Publish → Load in Revit → coordinates align automatically

ACTUAL behavior:
  Civil 3D has NO reference point configuration for publishing
  Revit has Internal Origin / Project Base / Survey Point options
  → Models may be offset by kilometers depending on coordinate systems
```

**WHY**: Unlike the Revit connector (which offers Internal Origin, Project Base, and Survey Point options), the Civil 3D connector has NO coordinate system alignment configuration. Objects publish using the drawing's World Coordinate System (WCS). If the Civil 3D drawing uses real-world coordinates (large eastings/northings), objects may appear far from origin in other applications.

**ALWAYS**: Coordinate with the publishing team to understand the Civil 3D drawing's coordinate system before loading. Consider using a shared coordinate system convention across all disciplines.

---

## AP-6: Publishing from Paper Space

```
WRONG:
  Switch to Paper Space layout → Select objects → Publish
  → Objects do NOT publish from Paper Space

CORRECT:
  Switch to Model Space → Select objects → Publish
  → All model space objects publish correctly
```

**WHY**: The AutoCAD/Civil 3D connector publishes from Model Space only. Paper Space content (layouts, viewports, title blocks) is NOT supported.

**ALWAYS**: Ensure you are in Model Space before publishing. Layout-based documentation must use other exchange formats (DWG, PDF).

---

## AP-7: Expecting Block Attributes to Transfer as Properties

```
WRONG assumption:
  Block with attributes (TAG, ROOM_NUM, AREA) → Publish
  → Attributes appear as named properties on the Instance object

ACTUAL behavior:
  Block attributes are part of the block reference data
  → They may appear in properties but NOT as clearly labeled attribute fields
```

**WHY**: Block attributes in AutoCAD are stored differently from Extension Dictionaries and XData. The connector captures them as part of the block reference data, but the mapping to Speckle properties is not a clean one-to-one attribute-to-property correspondence.

**ALWAYS**: Verify attribute data in the Speckle web viewer after publishing. Do NOT assume attribute names map directly to property keys. Check the actual `properties` structure of published block references.

---

## AP-8: Assuming PropertySetDefinition Proxy Exists for AutoCAD

```
WRONG:
  AutoCAD drawing with Property Sets → Publish
  → PropertySetDefinition proxy created at Root Collection

ACTUAL behavior:
  PropertySetDefinition proxy is Civil 3D ONLY
  AutoCAD standard does NOT support Property Sets natively
  → Only XData and Extension Dictionaries are captured from AutoCAD
```

**WHY**: Property Sets are a Civil 3D (and AutoCAD Architecture / MEP) feature, NOT a standard AutoCAD feature. The PropertySetDefinition proxy is generated exclusively by the Civil 3D connector. Standard AutoCAD objects carry custom data through XData and Extension Dictionaries only.

**ALWAYS**: Check whether the source application is Civil 3D or standard AutoCAD before expecting Property Set data in the published model.

---

## AP-9: Relying on Color Display Without Shaded View Mode

```
WRONG:
  Load AutoCAD/Civil 3D model in Speckle viewer → colors not visible
  → Assume colors were not published

ACTUAL behavior:
  Colors ARE published (via Color proxy)
  → Viewer must be in Shaded view mode to display them
  → Wireframe or X-ray modes may hide color information
```

**WHY**: The Speckle web viewer has multiple display modes. AutoCAD/Civil 3D color data (especially ByLayer and ByObject colors) requires Shaded view mode to render correctly. Other view modes may show objects as gray or monochrome.

**ALWAYS**: Switch the Speckle viewer to Shaded mode when verifying color data from AutoCAD/Civil 3D models.

---

## AP-10: Creating Circular Proxy References

```
WRONG:
  Manually constructing Speckle data where a Color proxy references another proxy
  → Proxies must NEVER reference other proxies

CORRECT:
  Proxies reference objects ONLY via applicationId strings
  → Objects reference proxies indirectly (proxy's objects array contains the object's applicationId)
```

**WHY**: The Speckle proxy architecture is a flat, non-circular reference system. Proxies reference objects, objects are referenced by proxies — there is no proxy-to-proxy linking. Attempting to create circular references breaks the serialization and deduplication model.

**ALWAYS**: Keep proxy references one-directional: proxy → objects (by applicationId). NEVER create proxy → proxy references.

---

## AP-11: Expecting Native Civil 3D Elements on Load

```
WRONG assumption:
  Civil 3D alignment → Publish → Load back in Civil 3D → native alignment

ACTUAL behavior:
  Civil 3D alignment → Publish → Load back in Civil 3D → standard geometry
  → NOT a native alignment, corridor, or pipe network
```

**WHY**: Like all Speckle connectors, loading creates generic geometry — NOT native application elements. A Civil 3D alignment loaded back into Civil 3D becomes polylines and meshes, not a native alignment with stations, profiles, and corridor associations.

**Impact**: Workflows that require native Civil 3D editing after Speckle round-tripping are NOT supported. The loaded geometry cannot be used as input for corridor modeling, profile generation, or pipe network analysis.

**ALWAYS**: Treat Speckle as a one-way publication and visualization pipeline for Civil 3D. For native element exchange, use LandXML or IFC.
