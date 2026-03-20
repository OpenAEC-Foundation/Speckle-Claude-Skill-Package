# speckle-impl-tekla -- Anti-Patterns

## AP-1: Attempting to Receive Data into Tekla

### Wrong

Designing a workflow that expects Speckle data to be loaded INTO Tekla Structures:

```
Revit Model --> Speckle --> Tekla Structures (IMPOSSIBLE)
```

"We'll push the architectural model from Revit to Speckle and then load it into Tekla for structural modeling."

### Why It Fails

The Tekla connector is **PUBLISH-ONLY**. There is NO receive/load functionality. The connector NEVER supports importing data from Speckle into Tekla. This is a fundamental architectural limitation, not a temporary bug.

### Correct

Use Tekla's native IFC import for loading external models, or use the Speckle Viewer for visual coordination:

```
Revit Model --> Speckle --> Viewer (coordination)
Revit Model --> IFC export --> Tekla IFC import (separate workflow)
Tekla Model --> Speckle --> Viewer (coordination)
```

---

## AP-2: Publishing from Drawing Views

### Wrong

Opening a Tekla drawing and attempting to publish from the drawing viewport.

### Why It Fails

The Tekla connector ONLY works from the **model viewport**. Drawing views contain 2D representations, annotations, and title blocks that are NOT supported by the connector. Publishing from a drawing view ALWAYS fails.

### Correct

ALWAYS switch to the model viewport before publishing. Verify you are in the 3D model environment, not a drawing layout.

---

## AP-3: Expecting Assembly Data

### Wrong

```python
# Expecting to find assembly groupings in the Speckle data
for assembly in tekla_data["assemblies"]:
    main_part = assembly["main_part"]
    secondary_parts = assembly["secondary_parts"]
```

### Why It Fails

Tekla assemblies are NOT published to Speckle. The connector converts individual parts only. Assembly relationships, main/secondary part designations, and assembly numbering are LOST during conversion.

### Correct

Access individual parts and reconstruct groupings if needed using spatial proximity or the `properties.Report.AssemblyNumber` field (if available):

```python
# Group parts by assembly number from report data
from collections import defaultdict

assemblies = defaultdict(list)
for obj in tekla_objects:
    report = obj.get("properties", {}).get("Report", {})
    assy_num = report.get("AssemblyNumber", "unassigned")
    assemblies[assy_num].append(obj)
```

---

## AP-4: Expecting Nested TeklaObjects

### Wrong

```python
# Expecting TeklaObjects to contain child TeklaObjects
beam = tekla_object
for child_part in beam["elements"]:
    # Expecting nested structural sub-elements
    process_child(child_part)
```

### Why It Fails

TeklaObjects are ALWAYS flat. They do NOT contain child TeklaObjects. Each structural element is an independent object in the hierarchy. The parent-child relationship is: Type group > TeklaObject (no further nesting).

### Correct

Iterate TeklaObjects at the leaf level of the hierarchy:

```
Root Collection > Tekla File > Type > TeklaObject (leaf -- no children)
```

---

## AP-5: Expecting Drawing or Annotation Data

### Wrong

```python
# Trying to extract drawing information from published Tekla data
drawings = tekla_data.get("drawings", [])
title_block = tekla_data.get("title_block", {})
dimensions = tekla_data.get("dimensions", [])
```

### Why It Fails

The Tekla connector publishes model objects ONLY. Drawings, title blocks, annotations, dimensions, and all 2D documentation elements are NEVER included in the published data.

### Correct

For drawing data, use Tekla's native export tools (PDF, DWG). The Speckle connector is exclusively for 3D model geometry and metadata.

---

## AP-6: Expecting Numbering Series in Published Data

### Wrong

Assuming that Tekla numbering series and sequence settings are preserved in Speckle:

```python
# Trying to access numbering configuration
numbering_series = tekla_data.get("numbering_series")
start_number = numbering_series.get("start")
prefix = numbering_series.get("prefix")
```

### Why It Fails

Numbering series and sequence settings are Tekla-specific organizational constructs that are NOT converted during publishing. Individual part and assembly numbers MAY appear in `properties.Report` fields, but the series configuration itself is NEVER transferred.

### Correct

Access individual part/assembly numbers from the Report properties:

```python
report = obj.get("properties", {}).get("Report", {})
part_number = report.get("PartNumber", "")
assembly_number = report.get("AssemblyNumber", "")
```

---

## AP-7: Assuming Bidirectional Workflow with Tekla

### Wrong

Designing an automated feedback loop:

```
Tekla --> Speckle --> Automate (validate) --> Speckle --> Tekla (update)
```

"Our Automate function will flag issues and push corrections back to Tekla."

### Why It Fails

The last step is IMPOSSIBLE. Data NEVER flows back into Tekla from Speckle. Automate functions can analyze Tekla data and produce reports, but corrections ALWAYS require manual intervention in Tekla.

### Correct

Design one-way analysis workflows:

```
Tekla --> Speckle --> Automate (validate) --> Report/Notification
                                          --> Engineer manually fixes in Tekla
                                          --> Re-publish from Tekla
```

---

## AP-8: Ignoring Unit Alignment in Federation

### Wrong

Federating a Tekla model (mm) with a Revit model (feet) without verifying unit handling:

"Both models are in Speckle, so they'll just align automatically."

### Why It Fails

While Speckle handles unit conversion, coordinate system alignment between Tekla and other tools requires a shared origin point. If the project base points differ between Tekla and Revit, models appear in different locations regardless of unit conversion.

### Correct

1. ALWAYS establish a shared coordinate origin between Tekla and other tools BEFORE publishing
2. Verify alignment by loading both models in the Speckle Viewer after publishing
3. Document the shared origin point for all project participants

---

## AP-9: Using `id` Instead of `applicationId` for Tracking

### Wrong

```python
# Storing Tekla element references by Speckle id
element_tracker = {obj["id"]: obj for obj in tekla_objects}
# Next publish: ids have changed because content hash changed
```

### Why It Fails

The `id` field in Speckle is a content-based hash. When a Tekla element is modified and re-published, its `id` changes because the content changed. Cross-version tracking by `id` ALWAYS breaks.

### Correct

ALWAYS use `applicationId` for tracking elements across publish versions:

```python
element_tracker = {obj["applicationId"]: obj for obj in tekla_objects}
# Next publish: applicationId remains stable for the same Tekla element
```
