# examples.md — Federation Workflow Examples

## Example 1: Multi-Discipline Federated Project Setup

### Scenario
An architectural project with four disciplines: architecture (Revit), structure (Tekla), MEP (Revit), and landscape (Rhino). The goal is to federate all models into a single Speckle project for coordination.

### Step 1: Create Project Structure

Create one Speckle project with separate models per discipline:

```
Project: "Campus Building A"
├── Model: architecture     ← Architect publishes from Revit
├── Model: structure        ← Structural engineer publishes from Tekla
├── Model: mep              ← MEP engineer publishes from Revit
├── Model: landscape        ← Landscape architect publishes from Rhino
└── Model: coordination     ← Analysis results from Automate or manual review
```

### Step 2: Align Reference Points BEFORE Publishing

**Critical**: All Revit users MUST agree on the same reference point setting.

```
Architect (Revit):     Reference Point = Survey Point
MEP (Revit):           Reference Point = Survey Point    ← MUST match architect
Structural (Tekla):    World Origin                      ← Verify alignment with Revit survey point
Landscape (Rhino):     World Origin                      ← Verify alignment with Revit survey point
```

If reference points are misaligned, models appear at incorrect positions in the federated view. There is NO automatic alignment.

### Step 3: Publish from Each Tool

Each team publishes independently to their designated model. The order does not matter — models are independent.

### Step 4: View Federated Result

Open the Speckle project in the web viewer. Load all four models simultaneously. Each model's collection hierarchy is preserved:

```
Viewer shows:
├── architecture (Revit hierarchy: Level > Category > Type)
├── structure (Tekla hierarchy: Type)
├── mep (Revit hierarchy: Level > Category > Type)
└── landscape (Rhino hierarchy: Layer > Sublayer)
```

---

## Example 2: Revit to Grasshopper Round-Trip

### Scenario
An architect publishes a Revit model. A computational designer loads it in Grasshopper, performs parametric analysis, modifies facade elements, and publishes back. The architect then loads the modified model in Revit.

### Step 1: Publish from Revit

The architect publishes the building model. A Revit wall with ElementId 54321 becomes:

```
RevitObject:
  applicationId: "54321"
  speckle_type: "Objects.Data.DataObject:Objects.Data.RevitObject"
  type: "Basic Wall - 200mm"
  family: "Basic Wall"
  category: "Walls"
  level: "Level 1"
  displayValue: [Mesh]
  properties:
    Width: 200
    Height: 3000
    Area: 15.0
    Volume: 3.0
```

### Step 2: Load in Grasshopper

Use the **Load** component with the model URL. The wall arrives as a Data Object.

```
Grasshopper workflow:
1. Load component → receives full model
2. Query Objects component → extracts all objects as flat list
3. Filter Objects component → filter by property "category" = "Walls"
4. Deconstruct component → access individual fields
```

The wall's `applicationId` is "54321" — this value MUST be preserved.

### Step 3: Modify with Passthrough Nodes

**ALWAYS use Passthrough nodes** to modify loaded objects. NEVER create new objects from scratch.

```
Grasshopper workflow (correct):
1. Load → get existing wall objects
2. Data Object Passthrough → modify properties on the EXISTING object
   - Input: loaded Data Object (preserves applicationId "54321")
   - Add/modify properties as needed
3. Publish → send modified objects back

Grasshopper workflow (WRONG — breaks tracking):
1. Load → get wall geometry
2. Create NEW Geometry Object → new applicationId generated
   - Original applicationId "54321" is LOST
   - Proxy references break silently
3. Publish → objects appear as NEW, not modified
```

### Step 4: Load Back in Revit

The modified wall returns to Revit as a **Direct Shape**, NOT a native wall:

```
Result in Revit:
- Element type: Direct Shape (Generic Model category)
- Geometry: Mesh from displayValue
- Native wall parameters: NOT available as Revit parameters
- Properties: Visible only in Speckle metadata, NOT in Revit Properties panel
- Material: Applied if RenderMaterial proxy was preserved
```

The architect CANNOT edit this as a native wall. It is a static geometric representation.

---

## Example 3: Grasshopper Change Tracking with Passthrough

### Scenario
A computational designer creates a parametric facade in Grasshopper and needs to publish updates while preserving change tracking.

### Initial Publish (First Time)

```
Grasshopper workflow:
1. Generate facade panels (Grasshopper geometry — no applicationIds yet)
2. Create Collection component → organize into "facade / panels"
3. Geometry Passthrough → add names and properties
4. Publish → Speckle assigns internal IDs
```

After first publish, objects have auto-generated applicationIds.

### Subsequent Updates (Preserving Tracking)

```
Grasshopper workflow:
1. Load → retrieve previously published model
2. Query Objects → get existing panel objects (with stable applicationIds)
3. Geometry Passthrough → mutate existing objects with new geometry/properties
   - The Passthrough node PRESERVES the original applicationId
4. Publish → Speckle detects these as UPDATES, not new objects
```

### Why This Matters

Without Passthrough nodes, Grasshopper generates new GUIDs on every solve. Each publish creates entirely new objects instead of updating existing ones. Version diffing becomes meaningless because every version appears as "all objects removed + all objects added."

---

## Example 4: Power BI Federated Analysis

### Scenario
A project manager needs a dashboard showing material quantities across all disciplines.

### Step 1: Load Models in Power BI

```
Power Query:
1. Add data source → Speckle Connector
2. Enter model URL for architecture model → load as table
3. Enter model URL for structure model → load as table
4. Enter model URL for MEP model → load as table
```

### Step 2: Federate Models

```
Power Query M code:
let
    archModel = Speckle.Projects("https://app.speckle.systems/projects/abc123/models/arch"),
    structModel = Speckle.Projects("https://app.speckle.systems/projects/abc123/models/struct"),
    mepModel = Speckle.Projects("https://app.speckle.systems/projects/abc123/models/mep"),
    federated = Speckle.Models.Federate(archModel, structModel, mepModel)
in
    federated
```

### Step 3: Extract Properties

```
Power Query M code:
let
    federated = <previous step>,
    properties = Speckle.Objects.Properties(federated),
    expanded = Speckle.Utils.ExpandRecord(properties[MaterialQuantities])
in
    expanded
```

### Step 4: Build Dashboard

- Use the 3D Viewer Visual to display the federated model
- Create bar charts comparing material volumes across disciplines
- Add slicers for filtering by discipline, level, or category
- Element selection in the 3D viewer cross-filters all charts

---

## Example 5: Handling Coordinate Misalignment

### Scenario
Two Revit models in a federated view appear offset from each other because one used Internal Origin and the other used Survey Point.

### Diagnosis

```
Model A published with: Reference Point = Internal Origin
Model B published with: Reference Point = Survey Point
Result: Models appear offset in the viewer by the distance between
        Internal Origin and Survey Point in the Revit project.
```

### Resolution

1. Re-publish BOTH models with the SAME reference point setting
2. ALWAYS use Survey Point for multi-file coordination projects
3. Verify alignment in the web viewer BEFORE sharing with the team

```
Corrected settings:
Model A: Reference Point = Survey Point    ← changed
Model B: Reference Point = Survey Point    ← unchanged
Result: Models align correctly in federated view
```

### Prevention

Establish a project-wide convention BEFORE any team member publishes:

```
Project Convention Document:
- Speckle reference point: Survey Point (ALL Revit files)
- Rhino/AutoCAD world origin: Aligned to Revit Survey Point coordinates
- Unit system: Metric (millimeters)
- Up axis: Z-up (default for all supported tools)
```

---

## Example 6: Selective Federation with Collection Filtering

### Scenario
A structural engineer wants to load only the walls and floors from the architect's Revit model, ignoring furniture and MEP elements.

### Using Grasshopper Collection Selector

```
Grasshopper workflow:
1. Load component → load architecture model
2. Collection Selector component → browse hierarchy:
   Building.rvt / Level 1 / Walls         ← select
   Building.rvt / Level 1 / Floors        ← select
   Building.rvt / Level 1 / Furniture     ← skip
   Building.rvt / Level 1 / Mechanical    ← skip
3. Query Objects → extract objects from selected collections only
4. Use filtered objects for structural analysis
```

### Using GraphQL for Programmatic Filtering

```graphql
query {
  project(id: "project-id") {
    model(id: "architecture") {
      versions(limit: 1) {
        items {
          referencedObject
        }
      }
    }
  }
}
```

Then use the SpecklePy SDK to traverse and filter:

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account
from specklepy.transports.server import ServerTransport
from specklepy.api import operations

client = SpeckleClient(host="https://app.speckle.systems")
account = get_default_account()
client.authenticate_with_account(account)

transport = ServerTransport(client=client, stream_id="project-id")
root = operations.receive(obj_id="referenced-object-id", remote_transport=transport)

# Filter for walls only by traversing collections
def find_walls(obj, path=""):
    if hasattr(obj, "category") and obj.category == "Walls":
        yield obj
    if hasattr(obj, "elements"):
        for element in obj.elements:
            yield from find_walls(element)

walls = list(find_walls(root))
```
