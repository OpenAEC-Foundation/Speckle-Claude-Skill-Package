# speckle-impl-tekla -- Examples

## Example 1: Publish Steel Model from Tekla

### Scenario
Structural engineer publishes a steel frame model from Tekla Structures to Speckle for coordination with the architectural team using Revit.

### Steps

1. Open the Tekla Structures model
2. Switch to the **model viewport** (NEVER a drawing view)
3. Select the steel elements to publish (beams, columns, plates, bolts)
4. Open the Speckle connector from Extensions menu
5. Select the target Speckle project and model
6. Add a commit message: `"Steel frame - Level 1-3 complete"`
7. Click Publish

### Expected Result

```
Root Collection
  └── Tekla File
        ├── Beam
        │     ├── TeklaObject (HEA300, S355, L=6000mm)
        │     ├── TeklaObject (IPE240, S275, L=4500mm)
        │     └── ...
        ├── Column
        │     ├── TeklaObject (HEB400, S355, L=3500mm)
        │     └── ...
        ├── Plate
        │     ├── TeklaObject (S355, 20mm thick)
        │     └── ...
        └── Bolt
              ├── TeklaObject (M20, 8.8)
              └── ...
```

Each TeklaObject contains:
- `displayValue`: Brep geometry
- `properties.Report`: Profile, material, dimensions, weight, coordinates
- `applicationId`: Stable Tekla element identifier

---

## Example 2: Access Tekla Data Downstream with SpecklePy

### Scenario
A data analyst retrieves the published Tekla model to generate a steel quantity report.

### Code

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account
from specklepy.transports.server import ServerTransport
from specklepy.api import operations

# Authenticate
account = get_default_account()
client = SpeckleClient(host=account.serverInfo.url)
client.authenticate_with_account(account)

# Get the latest commit
stream_id = "your_stream_id"
branch_name = "main"
commits = client.commit.list(stream_id, limit=1)
latest_commit = commits[0]

# Receive the data
transport = ServerTransport(client=client, stream_id=stream_id)
root = operations.receive(latest_commit.referencedObject, transport)

# Traverse and collect steel quantities
steel_report = []

def traverse(obj, depth=0):
    """Recursively traverse the Speckle object tree."""
    if hasattr(obj, "type") and obj["type"] in ["Beam", "Column", "Plate"]:
        report = obj.get("properties", {}).get("Report", {})
        steel_report.append({
            "type": obj["type"],
            "profile": report.get("Profile", "Unknown"),
            "material": report.get("Material", "Unknown"),
            "weight": report.get("Weight", 0),
            "length": report.get("Length", 0),
        })

    # Traverse children
    if hasattr(obj, "elements") and obj["elements"]:
        for child in obj["elements"]:
            traverse(child, depth + 1)

traverse(root)

# Summary
total_weight = sum(item["weight"] for item in steel_report)
print(f"Total elements: {len(steel_report)}")
print(f"Total weight: {total_weight:.1f} kg")

# Group by profile
from collections import defaultdict
by_profile = defaultdict(list)
for item in steel_report:
    by_profile[item["profile"]].append(item)

for profile, items in sorted(by_profile.items()):
    count = len(items)
    weight = sum(i["weight"] for i in items)
    print(f"  {profile}: {count} pcs, {weight:.1f} kg")
```

---

## Example 3: Federated Model Review (Tekla + Revit)

### Scenario
A project coordinator federates the structural Tekla model with the architectural Revit model for clash detection and design review.

### Steps

1. **Structural engineer** publishes Tekla model to Speckle project `"Building-X"`, model `"structural"`
2. **Architect** publishes Revit model to the same project `"Building-X"`, model `"architectural"`
3. **Coordinator** opens the Speckle Viewer and loads both models simultaneously
4. Both models appear in the same 3D space for visual review
5. Clashes are identified visually or via Speckle Automate functions

### Key Considerations

- Tekla model units are typically **mm** -- ensure the Revit model uses matching units or let Speckle handle unit conversion
- Coordinate systems MUST align between Tekla and Revit (shared origin point)
- Tekla data is READ-ONLY in this federation -- changes NEVER flow back to Tekla
- Use `applicationId` to track elements across publish versions

---

## Example 4: Automate Function Analyzing Tekla Data

### Scenario
A Speckle Automate function checks all steel beams for minimum profile size compliance.

### Code

```python
from speckle_automate import AutomationContext, execute_automate_function

def check_beam_profiles(automate_context: AutomationContext):
    """Check that all beams meet minimum profile requirements."""
    version_root = automate_context.receive_version()

    minimum_profiles = {"HEA": 200, "HEB": 200, "IPE": 200}
    violations = []

    def check_object(obj):
        if hasattr(obj, "type") and obj["type"] == "Beam":
            report = obj.get("properties", {}).get("Report", {})
            profile = report.get("Profile", "")

            for prefix, min_size in minimum_profiles.items():
                if profile.startswith(prefix):
                    size = int("".join(filter(str.isdigit, profile)))
                    if size < min_size:
                        violations.append(
                            f"Beam {obj.get('applicationId', 'unknown')}: "
                            f"{profile} < minimum {prefix}{min_size}"
                        )

        if hasattr(obj, "elements") and obj["elements"]:
            for child in obj["elements"]:
                check_object(child)

    check_object(version_root)

    if violations:
        automate_context.mark_run_failed(
            f"Found {len(violations)} undersized beams:\n"
            + "\n".join(violations)
        )
    else:
        automate_context.mark_run_success("All beams meet minimum profile requirements.")

execute_automate_function(check_beam_profiles)
```

---

## Example 5: Filtering Tekla Objects by Selection Filter

### Scenario
Publish only the bolted connections from a Tekla model.

### Steps

1. In Tekla Structures, create or use an existing selection filter for bolts
2. Apply the filter to select all bolt objects in the model viewport
3. Open Speckle connector
4. The selection is automatically scoped to filtered objects
5. Publish to Speckle with message `"Bolted connections - Rev A"`

### Result

Only bolt TeklaObjects appear in the published model. Other element types (beams, plates, columns) are excluded from this specific version.
