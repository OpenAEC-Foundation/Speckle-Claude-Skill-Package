# anti-patterns.md — Federation Anti-Patterns

## AP-FED-01: Expecting Native Element Recreation After Round-Trip

### Pattern (WRONG)
```
1. Publish Revit wall (native wall with parameters)
2. Load in Grasshopper, modify geometry
3. Publish back to Speckle
4. Load in Revit → expect native wall with editable parameters
```

### Why It Fails
Speckle ALWAYS creates Direct Shapes in Revit and GDL Objects in Archicad on load. There is NO native element reconstruction in ANY connector. The wall's "wall-ness" (type parameters, family assignments, analytical model, room boundaries) is permanently lost after leaving Revit.

### Correct Approach
Accept that round-tripped objects become generic geometry. Plan workflows where:
- Revit-native editing happens BEFORE publishing
- Grasshopper modifications are for analysis/visualization, not for returning editable BIM elements
- If native Revit elements are required, keep the work in Revit

---

## AP-FED-02: Using Content-Based `id` for Cross-Version Tracking

### Pattern (WRONG)
```python
# Track changes by comparing id values across versions
old_ids = {obj.id for obj in old_version}
new_ids = {obj.id for obj in new_version}
added = new_ids - old_ids        # WRONG — modified objects also appear here
removed = old_ids - new_ids      # WRONG — modified objects also appear here
```

### Why It Fails
The `id` is a content hash. When ANY property or geometry changes on an object, its `id` changes. A wall that moved 1mm gets a completely new `id`. Using `id` for tracking treats every modification as a deletion + creation.

### Correct Approach
```python
# Track changes by applicationId (stable across versions)
old_by_appid = {obj.applicationId: obj for obj in old_version}
new_by_appid = {obj.applicationId: obj for obj in new_version}

added = {k: v for k, v in new_by_appid.items() if k not in old_by_appid}
removed = {k: v for k, v in old_by_appid.items() if k not in new_by_appid}
modified = {
    k: (old_by_appid[k], new_by_appid[k])
    for k in old_by_appid
    if k in new_by_appid and old_by_appid[k].id != new_by_appid[k].id
}
```

---

## AP-FED-03: Creating New Objects in Grasshopper Instead of Using Passthrough

### Pattern (WRONG)
```
Grasshopper workflow:
1. Load model from Speckle
2. Extract geometry from loaded objects
3. Create NEW Geometry Objects from extracted geometry
4. Publish new objects → all get fresh GUIDs as applicationId
```

### Why It Fails
Grasshopper generates new GUIDs on every solve cycle. New objects have no relationship to the original loaded objects. All proxy references (materials, levels, groups) break silently. Version diffing shows "everything deleted + everything created" instead of meaningful changes.

### Correct Approach
```
Grasshopper workflow:
1. Load model from Speckle
2. Use Passthrough nodes to MUTATE existing loaded objects
3. Passthrough preserves the original applicationId from the source app
4. Publish → Speckle detects updates via stable applicationId
```

ALWAYS use Geometry Passthrough, Data Object Passthrough, or Block Instance Passthrough to modify existing objects. NEVER extract geometry and rebuild from scratch.

---

## AP-FED-04: Mixing Reference Points in a Federated Project

### Pattern (WRONG)
```
Architect (Revit file A): publishes with Reference Point = Internal Origin
Structural (Revit file B): publishes with Reference Point = Survey Point
Result: Models appear offset in the federated view
```

### Why It Fails
Revit maintains three separate coordinate reference points: Internal Origin, Project Base, and Survey Point. Each can be at a different position. When two files use different reference points, their published geometry is offset by the distance between those points.

### Correct Approach
1. Establish a project convention BEFORE any publishing: "All Revit files use Survey Point"
2. Verify that all Revit files share the same Survey Point coordinates (via shared coordinates setup)
3. For non-Revit tools (Rhino, AutoCAD), align the world origin to match the Revit Survey Point
4. ALWAYS verify alignment in the web viewer after the first federated publish

---

## AP-FED-05: Publishing All Disciplines to a Single Model

### Pattern (WRONG)
```
Project/
└── everything/    ← Architect, structural, MEP all publish to same model
```

### Why It Fails
Each publish to a model creates a new version that REPLACES the loadable content. If the architect publishes after the structural engineer, the structural data is only accessible by loading an older version. There is NO automatic merging of versions from different sources.

### Correct Approach
```
Project/
├── architecture/    ← Architect publishes here
├── structure/       ← Structural publishes here
├── mep/             ← MEP publishes here
└── landscape/       ← Landscape publishes here
```

ALWAYS use separate models per discipline (or per responsible team). Federate at the project level using the viewer or Power BI.

---

## AP-FED-06: Assuming Custom Properties Survive Round-Trip

### Pattern (WRONG)
```
1. Publish Revit model with custom shared parameters
2. Load in Rhino → properties appear as user strings (OK)
3. Publish from Rhino back to Speckle
4. Load in Revit → expect custom parameters to appear in Properties panel
```

### Why It Fails
Revit, Blender, and Archicad do NOT load custom properties onto received objects. The properties exist in Speckle's data model (visible in the web viewer), but the host application connector silently drops them during ToHost conversion. This is documented behavior, not a bug.

### Correct Approach
- Use Speckle as a data TRANSPORT layer, not a property SYNCHRONIZATION layer
- Access properties via the web viewer, GraphQL API, or Power BI — not by loading back into the source application
- If bidirectional property sync is required, use Speckle Automate to validate property integrity and flag missing data

---

## AP-FED-07: Relying on Texture Transfer

### Pattern (WRONG)
```
1. Apply detailed textures to Revit materials (brick, wood, marble)
2. Publish to Speckle
3. Load in Blender → expect textures to appear
```

### Why It Fails
Speckle does NOT support textures across ANY connector. Only basic material properties transfer via RenderMaterial proxies: diffuse color (ARGB), opacity, metalness, and roughness. UV mapping, texture images, and procedural textures are ALWAYS lost.

### Correct Approach
- Use material COLOR properties for cross-tool identification (consistent naming helps)
- Apply textures AFTER loading in the target application
- Use material NAMES as a convention for identifying which textures to apply manually

---

## AP-FED-08: Assuming Automatic Deduplication Across Models

### Pattern (WRONG)
```
Architect publishes a shared wall in architecture model
Structural engineer publishes the same physical wall in structure model
Expectation: Speckle deduplicates to one wall in the federated view
```

### Why It Fails
Speckle does NOT deduplicate across models. Each model is independent. The same physical wall exists as two separate objects with different `applicationId` values (Revit ElementId from architect vs. Tekla GUID from structural). There is NO automatic cross-tool identity matching.

### Correct Approach
- Establish ownership boundaries: one discipline owns each element category
- Accept visual duplication in federated views
- Use Speckle Automate functions to detect and flag potential duplicates based on spatial proximity

---

## AP-FED-09: Ignoring Unit Mismatches in Federation

### Pattern (WRONG)
```
Revit model published in millimeters (units: "mm")
Rhino model published in meters (units: "m")
Expectation: Models auto-align at correct scale
```

### Why It Succeeds (Usually)
Speckle handles unit conversion automatically. Each object carries a `units` field, and the conversion pipeline transforms coordinates accordingly.

### When It Fails
- Custom scripts that read raw coordinate values without checking `units`
- Third-party tools that ignore the `units` field
- Manual coordinate calculations that assume a single unit system

### Correct Approach
ALWAYS check the `units` field when processing federated data programmatically. NEVER assume all objects in a federated model share the same unit system.

---

## AP-FED-10: Publishing from Tekla and Expecting Round-Trip

### Pattern (WRONG)
```
1. Publish structural model from Tekla
2. Modify in Grasshopper
3. Load modified model back into Tekla
```

### Why It Fails
Tekla is a PUBLISH-ONLY connector. There is NO receive/load functionality. Data flows out of Tekla but NEVER back in via Speckle.

### Correct Approach
- Use Tekla's native import tools (IFC, DSTV) for returning modified data
- Design federated workflows where Tekla is always the SOURCE, never the TARGET
- For bidirectional structural workflows, consider using Revit (which supports both publish and load, albeit as Direct Shapes)

---

## AP-FED-11: Expecting Solids to Survive AutoCAD/Civil 3D Pipeline

### Pattern (WRONG)
```
1. Create 3D solids in AutoCAD
2. Publish to Speckle
3. Load in Rhino → expect NURBS solids
```

### Why It Fails
AutoCAD and Civil 3D solids are ALWAYS converted to Mesh geometry during publishing. This conversion is irreversible and happens at the connector level, before data reaches the server. The solid topology (faces, edges, boolean history) is permanently lost.

### Correct Approach
- If solid geometry is required downstream, use a direct file exchange format (STEP, IGES) instead of Speckle
- Accept Mesh representation for visualization and coordination workflows
- For Rhino-specific needs, publish from Rhino (which preserves Brep/NURBS) rather than from AutoCAD

---

## AP-FED-12: Not Establishing Version Naming Conventions

### Pattern (WRONG)
```
Version 1: "initial upload"
Version 2: "update"
Version 3: "final"
Version 4: "final final"
Version 5: "ACTUAL final"
```

### Why It Fails
Meaningful version tracking across disciplines requires consistent naming. Without conventions, team members cannot identify which version corresponds to which design phase or coordination milestone.

### Correct Approach
Establish a naming convention BEFORE starting the project:

```
[DISCIPLINE]-[PHASE]-[DATE]-[DESCRIPTION]
Examples:
  ARCH-SD-20260320-initial-layout
  STRUCT-DD-20260320-column-grid-v2
  MEP-CD-20260320-duct-routing-final
```

Use Speckle's version message field consistently. Combine with webhooks or Automate to enforce naming conventions programmatically.
