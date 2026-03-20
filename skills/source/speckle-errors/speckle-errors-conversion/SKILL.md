---
name: speckle-errors-conversion
description: >
  Use when debugging geometry conversion failures, missing properties after receive, or unexpected Direct Shape results in Revit.
  Prevents silent data loss from unsupported geometry types, broken proxy references, and unit mismatch between connectors.
  Covers conversion failures (unsupported geometry, Direct Shape fallback), missing properties on receive, geometry baking data loss, proxy resolution failures, unit mismatch errors, and displayValue rendering issues.
  Keywords: speckle conversion error, unsupported geometry, direct shape, missing properties, unit mismatch, proxy error, displayValue, baking.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Connectors (Revit, Rhino, Blender, AutoCAD)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-errors-conversion

## Quick Reference

### Conversion Error Categories

| Category | Symptom | Severity |
|----------|---------|----------|
| Unsupported Geometry | Object missing after receive, fallback to mesh | High |
| Direct Shape Fallback | All Revit objects load as generic models | Expected behavior |
| Missing Properties | Custom parameters absent on received objects | High |
| Geometry Baking Loss | Brep becomes mesh, solid becomes triangulated | Medium |
| Proxy Resolution Failure | Materials or levels not applied to objects | Medium |
| Unit Mismatch | Objects appear at wrong scale or position | Critical |
| displayValue Error | Object invisible or renders as empty geometry | High |

### Critical Warnings

**NEVER** expect native Revit elements (walls, floors, doors) when loading Speckle data into Revit. Speckle ALWAYS creates Direct Shapes. This is by design, not a bug.

**NEVER** assume custom properties survive a round-trip. Revit, Blender, and Archicad do NOT load custom properties onto received objects. ALWAYS verify property persistence for your specific connector pair.

**NEVER** assume all connectors support both publish and load. Tekla is publish-only. Power BI is read-only. ALWAYS check the connector capability matrix before designing a workflow.

**ALWAYS** verify unit settings match between source and target applications before publishing. Unit mismatches cause objects to appear at incorrect scale with no error message.

**ALWAYS** use `displayValue` with Mesh primitives for cross-connector geometry exchange. Brep and NURBS data ONLY transfer reliably between Rhino-family applications.

---

## Conversion Compatibility Matrix

### Geometry Type Support by Connector

| Geometry Type | Revit Publish | Rhino Publish | Blender Publish | AutoCAD Publish | Receives As |
|---------------|:---:|:---:|:---:|:---:|-------------|
| Mesh | Yes | Yes | Yes | Yes | Mesh (universal) |
| Brep/NURBS | No | Yes | No | No | Mesh fallback except Rhino |
| Point | Yes | Yes | No | Yes | Point |
| Line | Yes | Yes | No | Yes | Line |
| Polyline | Yes | Yes | No | Yes | Polyline |
| Arc/Circle | Yes | Yes | Yes (Bezier) | Yes | Arc or polyline approximation |
| Solid | N/A | N/A | N/A | Mesh (forced) | Mesh ALWAYS |
| NURBS Curve | No | Yes | Yes | No | Polyline approximation |
| Text | No | Yes | No | Yes | Text or ignored |
| Hatch | No | Yes | No | Yes | Hatch or ignored |

### Property Round-Trip Matrix

| Source | Target | Custom Properties | Materials | Geometry | Hierarchy |
|--------|--------|:-:|:-:|:-:|:-:|
| Revit | Revit | NO | Yes | Direct Shape | Flattened |
| Revit | Rhino | User strings | Yes | Mesh | Layers |
| Revit | Blender | NO | Partial (4 shaders) | Mesh | Collections |
| Revit | Grasshopper | User strings | Yes | Mesh/Data | Collections |
| Rhino | Revit | NO | Yes | Direct Shape | Flattened |
| Rhino | Rhino | User strings | Yes | Native | Layers |
| Rhino | Blender | NO | Partial | Mesh | Collections |
| AutoCAD | Revit | NO | Yes | Direct Shape | Flattened |
| AutoCAD | Rhino | User strings | Yes | Geometry | Layers |
| Grasshopper | Revit | NO | Yes | Direct Shape | Flattened |

---

## Error 1: Unsupported Geometry Type

### Symptom
Object is present in the Speckle web viewer but missing after loading into the target application. No error message displayed.

### Cause
The target connector does not support the geometry type stored in `displayValue` or the root geometry fields. Each connector handles a specific subset of Speckle geometry primitives.

### Diagnosis
1. Open the object in the Speckle web viewer
2. Inspect the `speckle_type` field and `displayValue` contents
3. Cross-reference with the Geometry Type Support table above
4. If the geometry type is not in the target connector's supported list, conversion silently skips the object

### Fix
- Publish geometry as Mesh primitives for maximum compatibility
- In Grasshopper, use the Mesh component to tessellate Brep/NURBS before publishing
- For AutoCAD solids, accept the automatic mesh conversion (irreversible)
- For Blender, ONLY publish Mesh objects, Bezier curves, and NURBS curves

---

## Error 2: Direct Shape Fallback in Revit

### Symptom
All objects loaded into Revit appear as "Direct Shape" generic models instead of native Revit elements (walls, floors, columns).

### Cause
This is ALWAYS the expected behavior. Speckle does NOT reconstruct native Revit elements on load. Every object — regardless of source application — becomes a Direct Shape in Revit.

### Diagnosis
This is NOT an error. If the user expected native elements, the workflow assumption is incorrect.

### Fix
- Accept Direct Shapes as the Revit loading format
- Use Direct Shapes for visualization and coordination, not for production modeling
- If native Revit elements are required, use Dynamo or the Revit API to create them from Speckle property data
- Material editing IS possible on Direct Shapes: existing materials with matching names are reused automatically

### GDL Object Equivalent in Archicad
Archicad exhibits the same behavior: all loaded objects become GDL Objects (generic models). Block instances load as individual GDL Objects. Floor plan views show only cut lines at the floor plan cut plane with NO projection lines.

---

## Error 3: Missing Properties on Receive

### Symptom
Custom parameters, user-defined properties, or metadata visible in the Speckle web viewer are absent on objects after loading into the target application.

### Cause
Multiple connectors explicitly do NOT attach custom properties to received objects:
- **Revit**: "You can not load any custom properties on your Speckle model objects into Revit"
- **Blender**: "Properties are not loaded and attached to loaded objects"
- **Archicad**: No custom property loading into Archicad

Properties ARE preserved in Speckle's data model and visible in the web viewer, but the host application connector does not write them.

### Diagnosis
1. Verify the properties exist in the Speckle web viewer (they ALWAYS do if published correctly)
2. Check the Property Round-Trip Matrix above for your specific connector pair
3. If the target connector is Revit, Blender, or Archicad, property loss on receive is confirmed expected behavior

### Fix
- **Rhino**: Properties load as user strings — use `ObjectUserString` to access them
- **Grasshopper**: Use the Deconstruct component to access all object fields including properties
- **SketchUp**: Properties import as user attributes (requires "Attribute Helper" plugin to view)
- **Power BI**: Use `Speckle.Objects.Properties` helper function to extract properties into table columns
- For Revit/Blender/Archicad: access properties via the Speckle GraphQL API or web viewer instead

---

## Error 4: Geometry Baking Data Loss

### Symptom
Curved surfaces appear faceted. Smooth Brep geometry becomes triangulated mesh. Solid bodies lose volume information.

### Cause
The Speckle conversion pipeline uses "minimum viable interoperable primitives" (Mesh, Line, Point) in `displayValue`. This ensures ANY receiver can display geometry, but higher-order representations (Brep, NURBS, Solids) are reduced to mesh approximations during conversion.

### Specific Cases
- **AutoCAD/Civil 3D solids**: ALWAYS converted to Mesh on publish. This is irreversible.
- **Revit curved walls/floors**: Tessellated to Mesh in `displayValue`. Curvature information is lost.
- **Brep from Rhino**: Preserved as Brep data in Speckle. Converts back to Brep in Rhino but becomes Mesh in all other connectors.
- **Blender modifiers**: "Apply Modifiers" setting bakes modifiers on publish. The modifier stack is permanently flattened.

### Diagnosis
1. Compare the object in the source application with the Speckle web viewer
2. If the viewer shows faceted geometry, the conversion already reduced it during publish
3. Check `displayValue` type: if it contains only `Mesh` objects, the original surface data is gone

### Fix
- For Rhino-to-Rhino workflows: Brep data survives the round-trip
- For cross-connector workflows: increase mesh density before publishing to reduce visible faceting
- For AutoCAD solids: no fix exists — mesh conversion is hardcoded
- For Blender: disable "Apply Modifiers" if you need the modifier stack preserved locally (but note: unpublished modifiers mean the Speckle model differs from the Blender state)
- NEVER rely on Speckle for solid geometry exchange between CAD systems

---

## Error 5: Proxy Resolution Failure

### Symptom
Materials not applied to objects. Level associations missing. Group memberships lost. Definition/block instances appear as standalone geometry.

### Cause
Proxies reference objects by `applicationId`. If `applicationId` values are missing, changed, or duplicated, the proxy cannot resolve its target objects.

### Proxy Resolution Chain
```
RenderMaterial Proxy
├── objects: ["abc123", "def456", "ghi789"]  ← applicationId references
├── value: { diffuse: 0xFF0000, opacity: 1.0 }
└── Resolution: find objects where applicationId matches → apply material
```

### Common Failure Modes
1. **Grasshopper GUID instability**: Parameters generate new GUIDs on each solve, breaking `applicationId` continuity. Proxy references from a previous version point to non-existent objects.
2. **Duplicate applicationIds**: Two objects with the same `applicationId` cause ambiguous proxy resolution.
3. **Missing applicationId**: Objects without `applicationId` cannot be referenced by any proxy.
4. **Cross-connector proxy mismatch**: Not all connectors emit the same proxy types. Revit uses RenderMaterial + Level + Group. Rhino uses RenderMaterial + Color + Group + Definition. Tekla uses RenderMaterial only.

### Proxy Types by Connector

| Connector | RenderMaterial | Level | Group | Definition | Color | PropertySetDef |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Revit | Yes | Yes | Yes | No | No | No |
| Rhino | Yes | No | Yes | Yes | Yes | No |
| Grasshopper | Yes | No | Yes | Yes | Yes | No |
| AutoCAD | Yes | No | Yes | Yes | Yes | No |
| Civil 3D | Yes | No | Yes | Yes | Yes | Yes |
| Tekla | Yes | No | No | No | No | No |
| Archicad | Yes | No | No | No | No | No |
| Blender | Yes | No | No | No | No | No |

### Diagnosis
1. Inspect the root collection in the Speckle web viewer for proxy objects
2. Verify that proxy `objects` arrays contain valid `applicationId` values
3. Cross-reference with the target connector's supported proxy types
4. If the target connector does not support a proxy type, that relationship data is silently dropped

### Fix
- For Grasshopper: ALWAYS use passthrough nodes to mutate existing objects (preserves applicationIds)
- Ensure every published object has a stable `applicationId`
- When federating models, verify proxy type compatibility between source and target connectors
- For unsupported proxy types: extract the data via GraphQL API and apply manually in the target application

---

## Error 6: Unit Mismatch

### Symptom
Objects appear enormously oversized or microscopically small in the target application. Model positioned far from origin. Elements do not align with existing geometry.

### Cause
Every Speckle object carries a `units` field (`"m"`, `"mm"`, `"ft"`, `"in"`, etc.). Unit conversion happens automatically during the conversion pipeline. Failures occur when:
1. Source application units do not match the `units` field written by the connector
2. Target application expects a different unit system
3. Reference point settings differ between publish and load operations

### Diagnosis
1. Check the `units` field on objects in the Speckle web viewer
2. Compare with the source application's document units
3. Check reference point settings (Revit: Internal Origin vs. Project Base vs. Survey Point)
4. If objects appear 1000x too large: likely meters vs. millimeters mismatch
5. If objects appear ~3.28x too large: likely meters vs. feet mismatch
6. If objects appear ~25.4x too large: likely inches vs. millimeters mismatch

### Common Scale Factors for Diagnosis

| Apparent Scale | Likely Mismatch |
|---------------|-----------------|
| 1000x too large | Source: m, Target expects: mm |
| 1000x too small | Source: mm, Target expects: m |
| ~3.28x off | Meters vs. feet |
| ~25.4x off | Inches vs. millimeters |
| ~0.3048x off | Feet vs. meters |

### Fix
- ALWAYS verify document units in the source application before publishing
- In Revit, ensure the reference point setting (Internal Origin, Project Base, Survey Point) is consistent between publish and load
- Objects from Revit carry a `referencePointTransform` matrix that encodes the coordinate offset — verify this is applied correctly
- For federated models, ALWAYS standardize on a single reference point strategy across all contributing applications

---

## Error 7: displayValue Rendering Issues

### Symptom
Object exists in the Speckle data model but renders as invisible, empty, or corrupted geometry in the web viewer or target application.

### Cause
The `displayValue` field contains the renderable geometry for DataObjects. Issues arise when:
1. `displayValue` is empty or null
2. `displayValue` contains geometry primitives unsupported by the receiver
3. Mesh data has degenerate faces (zero-area triangles, invalid vertex indices)
4. Vertex arrays and face arrays have mismatched counts

### displayValue Structure
```json
{
  "speckle_type": "Objects.Data.DataObject",
  "displayValue": [
    {
      "speckle_type": "Objects.Geometry.Mesh",
      "vertices": [0, 0, 0, 1, 0, 0, 1, 1, 0],
      "faces": [3, 0, 1, 2],
      "units": "m"
    }
  ],
  "properties": { "category": "Walls" }
}
```

### Diagnosis
1. Open the object in the Speckle web viewer and check if it renders
2. If invisible in the viewer: `displayValue` is empty, null, or contains invalid geometry
3. If visible in viewer but invisible in target app: the target connector cannot parse the geometry type in `displayValue`
4. Inspect vertex and face arrays for consistency

### Fix
- Ensure every DataObject has at least one valid Mesh in `displayValue`
- Use Mesh (not Brep or NURBS) in `displayValue` for maximum compatibility
- Validate mesh integrity: vertex count must be divisible by 3, face indices must reference valid vertices
- For Grasshopper: use the Mesh component to tessellate before assigning to Data Object displayValue
- For programmatic publishing via SpecklePy: ALWAYS populate `displayValue` with at least one Mesh

---

## Error 8: Connector-Specific Conversion Failures

### Blender: Unsupported Shader Types
- **Symptom**: Materials appear as plain gray after loading
- **Cause**: Blender recognizes ONLY 4 shader types: Principled, Diffuse, Emission, Glass
- **Fix**: ALWAYS use one of the four supported shaders. Any other shader type falls back to basic material attributes.

### Blender: No Texture Support
- **Symptom**: Textured objects appear with flat color only
- **Cause**: Speckle does NOT support textures across any connector
- **Fix**: No fix. Accept that only material properties (color, opacity, metallic, roughness) transfer. UV-mapped textures NEVER survive the Speckle pipeline.

### Revit: Non-Perspective Views Silently Excluded
- **Symptom**: Plans, sections, and elevations are missing after publish
- **Cause**: Revit ONLY publishes 3D perspective views. All other view types are silently excluded.
- **Fix**: No fix. Use native Revit tools for 2D documentation exchange.

### AutoCAD/Civil 3D: Solid-to-Mesh Conversion
- **Symptom**: Solid bodies become triangulated mesh after publish
- **Cause**: Solids are ALWAYS converted to Mesh on publish. This is hardcoded and irreversible.
- **Fix**: No fix. If solid geometry is required downstream, do not use Speckle for that exchange.

### SketchUp: Material Application Failure
- **Symptom**: Materials display incorrectly in other applications
- **Cause**: Materials applied to SketchUp components (instead of faces) do not transfer correctly
- **Fix**: ALWAYS apply materials to faces, not components, before publishing from SketchUp.

### Archicad: Incorrect Model Positioning
- **Symptom**: Model loaded from Revit appears at wrong position in Archicad
- **Cause**: Reference point mismatch between Revit publish settings and Archicad coordinate system
- **Fix**: Align reference point settings. Use Internal Origin in Revit for best Archicad compatibility.

---

## Decision Tree: Diagnosing Conversion Errors

```
Object missing after load?
├─ Yes → Check Geometry Type Support table
│  ├─ Type unsupported → Convert to Mesh before publishing
│  └─ Type supported → Check displayValue contents
│     ├─ displayValue empty → Fix source object geometry
│     └─ displayValue valid → Check connector load logs
├─ Object present but wrong shape?
│  ├─ Faceted/triangulated → Geometry baking loss (Error 4)
│  ├─ Wrong scale → Unit mismatch (Error 6)
│  └─ Wrong position → Reference point mismatch
├─ Object present but missing properties?
│  └─ Check Property Round-Trip Matrix (Error 3)
├─ Object present but no material?
│  ├─ Check proxy type compatibility (Error 5)
│  └─ Check Blender shader support (Error 8)
└─ Object present but invisible?
   └─ displayValue rendering issue (Error 7)
```

---

## Reference Links

- [references/methods.md](references/methods.md) -- Conversion methods, displayValue structure, proxy resolution API
- [references/examples.md](references/examples.md) -- Working examples of diagnosing and fixing conversion errors
- [references/anti-patterns.md](references/anti-patterns.md) -- Common conversion mistakes with explanations

### Official Sources

- https://docs.speckle.systems/developers/data-schema/overview.md
- https://docs.speckle.systems/developers/data-schema/object-schema.md
- https://docs.speckle.systems/developers/data-schema/proxy-schema.md
- https://docs.speckle.systems/connectors/revit/revit.md
- https://docs.speckle.systems/connectors/rhino/rhino.md
- https://docs.speckle.systems/connectors/blender.md
- https://docs.speckle.systems/connectors/autocad.md
