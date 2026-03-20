# Anti-Patterns (Rhino/Grasshopper Connector)

## AP-1: Attempting to Create Native BIM Elements from Grasshopper

```
WRONG:  Expect Grasshopper-published geometry to become native Revit walls, beams, or columns
RIGHT:  Accept that Grasshopper can ONLY create Geometry Objects, Block Objects, and Data Objects
```

**WHY**: Grasshopper has no concept of BIM element semantics. When Grasshopper objects are loaded into Revit, they ALWAYS become Direct Shapes. There is no mechanism to create native Revit families or system families from Grasshopper. This is a fundamental architectural limitation of the Speckle connector pipeline, not a missing feature.

**Impact**: Teams planning Grasshopper-to-Revit workflows must account for Direct Shape output. Schedule data, material takeoffs, and Revit-native filtering will NOT work on Direct Shapes the same way as native elements.

---

## AP-2: Ignoring Change Tracking in Grasshopper

```
WRONG:  Create new objects every solve cycle and publish repeatedly
RIGHT:  Load published objects back, mutate via passthrough nodes, then re-publish
```

**WHY**: Grasshopper parameters generate new GUIDs on every solve. Speckle uses `applicationId` (derived from these GUIDs) for change tracking. New GUIDs every solve means every version appears as entirely new objects with zero relationship to previous versions. Version comparison, change detection, and incremental updates all break.

**Solution**: ALWAYS follow the load-mutate-publish pattern:
1. Publish initial version
2. Load it back into Grasshopper
3. Use passthrough nodes to modify loaded objects (preserves `applicationId`)
4. Re-publish

---

## AP-3: Publishing Flat Object Lists Without Collections

```
WRONG:  Connect all geometry directly to Publish without Create Collection
RIGHT:  Organize objects into named, hierarchical collections before publishing
```

**WHY**: Without collections, all objects appear in a flat list on the Speckle server. Downstream consumers (Rhino, Revit, Power BI, web viewer) cannot navigate or filter the data meaningfully. Collections map to layers in Rhino, categories in Revit, and tree nodes in the web viewer.

**Rule**: ALWAYS use Create Collection with descriptive names and nesting (via TAB+pipe) to organize published data.

---

## AP-4: Expecting Parallel Projection Views to Publish

```
WRONG:  Set up parallel projection named views in Rhino and expect them in Speckle
RIGHT:  Use only perspective named views for Speckle publication
```

**WHY**: Both the Rhino and Grasshopper connectors ONLY publish perspective named views. Parallel projections (orthographic, top, front, right views) are silently excluded during publish. There is no error message — the views simply do not appear on the server.

**Workaround**: If orthographic views are needed, save the camera position as metadata in object properties instead.

---

## AP-5: Casting Multi-Geometry Data Objects to Single Geometry

```
WRONG:  Cast a Data Object containing 5 meshes to a single Mesh parameter
RIGHT:  Use Deconstruct to access the displayValue list, then process each geometry individually
```

**WHY**: Data Objects from BIM connectors (Revit, Tekla, Archicad) often contain multiple geometry pieces in their `displayValue` array. Casting to a single geometry type works ONLY when the Data Object contains exactly one piece of geometry. With multiple geometries, the cast silently returns only the first geometry or fails entirely — dropping data without warning.

**Solution**: ALWAYS use Deconstruct to extract `displayValue`, then process the geometry list explicitly.

---

## AP-6: Forgetting to Authenticate Before Publish/Load

```
WRONG:  Connect Model URL and Collection to Publish without Sign-In component
RIGHT:  ALWAYS place Sign-In as the first Speckle component in the definition
```

**WHY**: Without authentication, the Publish and Load components fail silently or produce cryptic errors. The Sign-In component must be placed and activated before any server-facing operation.

---

## AP-7: Using Replace Mode in Properties Passthrough Without Understanding Consequences

```
WRONG:  Use "Replace" mode on loaded objects without realizing it deletes ALL existing properties
RIGHT:  Use "Merge" mode (default) to add properties while preserving existing ones
```

**WHY**: The Speckle Properties Passthrough has three modes:
- **Merge** (default): Adds new keys, keeps existing keys untouched
- **Remove**: Deletes specified keys
- **Replace**: Deletes ALL existing properties and replaces with the new dictionary

Using Replace on a loaded Revit object strips all Revit parameters (type, family, category, level, material quantities). This data is unrecoverable without reloading from the server.

**Rule**: ALWAYS use Merge mode unless you explicitly intend to wipe all properties.

---

## AP-8: Expecting User Strings on Receive in Non-Rhino Connectors

```
WRONG:  Publish from Rhino with user strings, load in Revit, expect to see the user strings
RIGHT:  Accept that Revit does NOT load custom properties from Speckle onto received objects
```

**WHY**: User strings round-trip correctly in Rhino-to-Rhino workflows. However, when loading into Revit, Blender, or Archicad, custom properties are NOT attached to received objects. The properties exist in Speckle's data model (visible in the web viewer), but the host application does not import them.

**Affected connectors**: Revit, Blender, Archicad — all explicitly documented as not loading custom properties.

---

## AP-9: Using Rhino 8 Below Version 8.9

```
WRONG:  Install the Speckle connector on Rhino 8.0-8.8
RIGHT:  Update to Rhino 8.9+ before installing or using the Speckle connector
```

**WHY**: Early Rhino 8 versions have known framework issues that cause connector instability, crashes, or silent failures during publish/load operations. Rhino 8.9+ resolves these framework issues.

---

## AP-10: Publishing Without Layer Filtering When Only Subset Needed

```
WRONG:  Publish all visible objects when only the structural model is needed
RIGHT:  Use the layer filter to publish only relevant layers
```

**WHY**: Publishing all visible geometry creates unnecessarily large models on the server. Large models increase load times for all downstream consumers, consume more storage, and make the web viewer slower. ALWAYS use layer filtering when only a subset of the model is relevant.

---

## AP-11: Expecting Block Definitions to Update Independently

```
WRONG:  Modify a block definition in Grasshopper and expect all published instances to update
RIGHT:  Re-publish the entire model with updated definition and instances
```

**WHY**: Speckle stores each version as an immutable snapshot. Modifying a block definition does not retroactively update previously published versions. ALWAYS re-publish the complete model (definitions + instances) when block definitions change.

---

## AP-12: Nesting Collections Without Pipe Separator

```
WRONG:  Create Collection with name "Architecture Walls" (flat name, no hierarchy)
RIGHT:  Create Collection with name "Architecture | Walls" (pipe creates nesting)
```

**WHY**: Without the pipe separator (`|`), the collection name is treated as a single flat level. The pipe character preceded by TAB creates parent-child relationships in the collection hierarchy. Flat names prevent meaningful navigation in the web viewer and downstream connectors.
