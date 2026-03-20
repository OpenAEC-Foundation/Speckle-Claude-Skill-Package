# examples.md -- speckle-agents-model-coordinator

## Example 1: Plan a Revit-to-Grasshopper Analysis Workflow

**User request**: "I have a Revit model and I want to analyze the structural grid in Grasshopper, then push modified geometry back to Revit."

**Coordinator response**:

### Step-by-step plan:

**Step 1: Publish from Revit**
- Skill: `speckle-impl-revit`
- Action: Open Speckle connector in Revit, select structural elements (columns, beams, grids)
- Settings: Reference point = Internal Origin (or match your project standard)
- Publish to: `project-name / structure` model
- Version message: "STRUCT-SD-20260320-initial-grid"

**Step 2: Load in Grasshopper**
- Skill: `speckle-impl-rhino-grasshopper`
- Action: Use Speckle Receive component, paste the model URL
- Output: Data Objects with geometry accessible via Deconstruct Speckle Object

**Step 3: Analyze and modify**
- Use Passthrough nodes to mutate loaded objects (preserves applicationId)
- Extract geometry from displayValue for analysis
- Modify geometry as needed
- NEVER create new objects from scratch

**Step 4: Publish back from Grasshopper**
- Skill: `speckle-impl-rhino-grasshopper`
- Action: Use Speckle Send component
- Publish to: `project-name / structure-modified` model
- Version message: "STRUCT-SD-20260320-grid-analysis-results"

**Step 5: Load in Revit (if needed)**
- Skill: `speckle-impl-revit`
- WARNING: All objects become Direct Shapes. Native Revit wall/column parameters are LOST.
- The structural grid will appear as generic geometry, not native Revit structural columns.

### Fidelity warnings:
- Revit parameters visible in Grasshopper as properties, but NOT editable as native Revit parameters on return
- Geometry survives as Mesh (Brep available in Grasshopper but lost on return to Revit)
- applicationId preserved IF Passthrough nodes used correctly

### Error recovery:
- If objects appear offset: Check reference point setting matches between Revit publish and load
- If change tracking breaks: Verify Passthrough nodes are used in Grasshopper

---

## Example 2: Coordinate a Multi-Discipline Project

**User request**: "We have an architect in Revit, structural engineer in Tekla, and landscape architect in Rhino. How do we set up Speckle for coordination?"

**Coordinator response**:

### Project setup:

**Step 1: Create project structure**
- Skill: `speckle-impl-versioning`
- Create one Speckle project with models:
  ```
  coordination-project/
  ├── architecture/     (Revit - architect)
  ├── structure/        (Tekla - structural)
  └── landscape/        (Rhino - landscape)
  ```

**Step 2: Align coordinate systems**
- Skill: `speckle-impl-federation`
- Revit: Choose Survey Point for geo-referenced coordination
- Rhino: Set World Origin to match the survey point coordinates
- Tekla: Align model origin to match
- CRITICAL: All teams MUST agree on the origin BEFORE first publish

**Step 3: Publishing schedule**
- Architecture (Revit): `speckle-impl-revit` -- Publish + Load supported
- Structure (Tekla): `speckle-impl-tekla` -- **Publish ONLY** (Tekla cannot load from Speckle)
- Landscape (Rhino): `speckle-impl-rhino-grasshopper` -- Publish + Load supported

**Step 4: Federated review**
- Option A: Speckle Web Viewer -- load all three models simultaneously
- Option B: Power BI dashboard -- `speckle-impl-powerbi` for quantitative analysis
  - Use `Speckle.Models.Federate()` to combine the three models
  - Build cross-discipline reports (e.g., structural elements vs architectural zones)

**Step 5: Version naming convention**
```
ARCH-SD-20260320-initial-layout
STRUCT-SD-20260320-column-grid
LAND-SD-20260320-planting-scheme
```

### Connector direction constraints:
- Tekla structural engineer can PUBLISH to Speckle but CANNOT load from it
- If the structural engineer needs to see the architect's model, they must use the Speckle Web Viewer or request IFC export separately
- Power BI team can only VIEW data (read-only)

### What each discipline sees in the federated view:
- Architecture: Revit hierarchy (File > Level > Category > Type)
- Structure: Tekla hierarchy (File > Type)
- Landscape: Rhino hierarchy (File > Layer > Sublayer)

---

## Example 3: Design Option Comparison

**User request**: "I want to compare three facade options -- two from Revit and one from Rhino."

**Coordinator response**:

### Setup:

**Option A: Single model with versions (recommended for sequential comparison)**
```
facade-study/
└── options/
    ├── version 1: "ARCH-SD-20260320-facade-option-a" (Revit)
    ├── version 2: "ARCH-SD-20260320-facade-option-b" (Revit)
    └── version 3: "ARCH-SD-20260320-facade-option-c-rhino" (Rhino)
```

**Option B: Separate models (if options need independent version histories)**
```
facade-study/
├── option-a/    (Revit)
├── option-b/    (Revit)
└── option-c/    (Rhino)
```

### Comparison workflow:

1. Publish each option using the respective connector
2. Open Speckle Web Viewer
3. Use version diff (DiffExtension) to compare:
   - Skill: `speckle-impl-viewer` for viewer setup
   - Skill: `speckle-impl-versioning` for version comparison API
4. Green = added, red = removed, blue = modified

### Fidelity notes:
- Rhino option uses Mesh + optional Brep geometry
- Revit options use RevitObject with displayValue Mesh
- All options display correctly in the viewer regardless of source tool
- Material properties (color, opacity) transfer from both tools via RenderMaterial proxy

---

## Example 4: Automated Quality Check Pipeline

**User request**: "Every time our architect publishes a new version, I want to automatically check that all walls have a fire rating parameter."

**Coordinator response**:

### Setup:

**Step 1: Write the Automate function**
- Skill: `speckle-syntax-automate` for function definition syntax
- Skill: `speckle-impl-automate-functions` for deployment

```python
# Pseudocode for the Automate function
from specklepy.automate import AutomateBase

class FireRatingChecker(AutomateBase):
    def run(self, automation_context):
        version_root = automation_context.receive_version()
        walls = [obj for obj in flatten(version_root) if "Wall" in obj.speckle_type]

        missing = []
        for wall in walls:
            if not hasattr(wall, "properties") or "Fire Rating" not in wall.properties:
                missing.append(wall.applicationId)

        if missing:
            automation_context.report_run_status("FAILED")
            automation_context.attach_info(f"{len(missing)} walls missing fire rating")
        else:
            automation_context.report_run_status("SUCCEEDED")
```

**Step 2: Deploy and configure trigger**
- Deploy function to Speckle Automate
- Set trigger: "version created" on `project / architecture` model
- Function runs automatically on every new version

**Step 3: Review results**
- Results appear in the Speckle web UI attached to the version
- Failed checks show which walls (by applicationId) lack fire ratings

### Skills involved:
- `speckle-syntax-automate` -- function definition patterns
- `speckle-impl-automate-functions` -- deployment and configuration
- `speckle-impl-python-sdk` -- SpecklePy operations within the function
- `speckle-syntax-base-objects` -- traversing object trees and accessing properties

---

## Example 5: Resolving a Broken Workflow

**User request**: "I published from Revit and loaded in Grasshopper, but now when I send back and load in Revit, the objects are in the wrong place and have no properties."

**Coordinator diagnosis**:

### Issue 1: Wrong position
- **Cause**: Reference point mismatch
- **Check**: What reference point was used during Revit publish? (Internal Origin / Project Base / Survey Point)
- **Fix**: Republish from Revit with the same reference point that the loading Revit file uses
- **Skill**: `speckle-impl-revit` (reference point configuration)

### Issue 2: No properties on load in Revit
- **Cause**: This is EXPECTED behavior, not a bug
- **Explanation**: Objects returning to Revit from Grasshopper become Direct Shapes. Direct Shapes do NOT carry native Revit parameters. The properties exist in Speckle's data model and are visible in the web viewer, but Revit does not attach them to Direct Shape elements.
- **Skill**: `speckle-impl-federation` (asymmetric fidelity)

### Issue 3 (if applicable): Change tracking broken
- **Check**: Were Passthrough nodes used in Grasshopper?
- **If not**: Grasshopper generated new GUIDs, breaking applicationId continuity
- **Fix**: Rebuild the Grasshopper definition using Passthrough nodes to mutate loaded objects
- **Skill**: `speckle-impl-rhino-grasshopper`

### Recommendations:
1. Accept that Revit round-trip produces Direct Shapes (this is by design)
2. If native Revit properties are required, keep the original Revit model and use Speckle only for analysis/visualization
3. Use the Speckle Web Viewer or Power BI to inspect properties that Revit drops on load
