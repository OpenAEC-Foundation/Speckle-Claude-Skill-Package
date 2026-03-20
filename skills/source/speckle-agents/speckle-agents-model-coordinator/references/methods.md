# methods.md -- speckle-agents-model-coordinator

## Orchestration Methods

These are not API methods but decision procedures the coordinator uses to plan and execute workflows.

---

### select_connector(application, direction)

Determine the correct Speckle connector for a given host application and data flow direction.

**Input**:
- `application`: The host application name (Revit, Rhino, Grasshopper, Blender, AutoCAD, Civil 3D, Tekla, Archicad, SketchUp, Power BI, Python, .NET, Web)
- `direction`: `publish`, `load`, `both`, or `view`

**Output**: Connector name, supported direction, and the skill to consult.

**Decision logic**:

```
IF application == "Tekla" AND direction == "load":
    RETURN ERROR "Tekla is publish-only. Cannot load data into Tekla."

IF application == "Power BI" AND direction == "publish":
    RETURN ERROR "Power BI is read-only. Cannot publish data from Power BI."

IF application == "Web" AND direction IN ("publish", "load"):
    RETURN ERROR "Web viewer is view-only. Use SpecklePy or Speckle.Sdk for programmatic access."

RETURN connector_map[application]
```

**Connector map**:

| Application | Connector | Publish | Load | Skill |
|-------------|-----------|---------|------|-------|
| Revit | Revit Connector | YES | YES | `speckle-impl-revit` |
| Rhino | Rhino Connector | YES | YES | `speckle-impl-rhino-grasshopper` |
| Grasshopper | GH Connector | YES | YES | `speckle-impl-rhino-grasshopper` |
| Blender | Blender Connector | YES | YES | `speckle-impl-blender` |
| AutoCAD | AutoCAD Connector | YES | YES | `speckle-impl-autocad-civil3d` |
| Civil 3D | Civil 3D Connector | YES | YES | `speckle-impl-autocad-civil3d` |
| Tekla | Tekla Connector | YES | NO | `speckle-impl-tekla` |
| Archicad | Archicad Connector | YES | YES | `speckle-impl-connectors-overview` |
| SketchUp | SketchUp Connector | YES | YES | `speckle-impl-connectors-overview` |
| Power BI | Power BI Connector | NO | YES (read) | `speckle-impl-powerbi` |
| Python | SpecklePy | YES | YES | `speckle-impl-python-sdk` |
| .NET | Speckle.Sdk | YES | YES | `speckle-impl-sharp-sdk` |
| Web | @speckle/viewer | NO | NO (view) | `speckle-impl-viewer` |

---

### check_fidelity(source, target, data_types)

Verify what data survives transfer between two specific tools.

**Input**:
- `source`: Source application name
- `target`: Target application name
- `data_types`: List of data types to check (geometry, properties, materials, textures, levels, instances)

**Output**: Survival report for each data type.

**Decision logic**:

```
FOR each data_type in data_types:
    IF data_type == "textures":
        RETURN "NEVER survives — not supported in any connector"

    IF data_type == "geometry":
        IF source IN ("AutoCAD", "Civil 3D") AND has_solids:
            WARN "Solids converted to Mesh irreversibly"
        IF target NOT IN ("Rhino", "Grasshopper") AND has_brep:
            WARN "Brep data lost — Mesh fallback used"
        RETURN "Mesh geometry ALWAYS survives"

    IF data_type == "properties":
        IF target IN ("Revit", "Blender", "Archicad"):
            RETURN "Custom properties DROPPED on load"
        RETURN "Properties preserved"

    IF data_type == "materials":
        RETURN "RenderMaterial proxy (color, opacity, metallic, roughness) ALWAYS survives"

    IF data_type == "levels":
        IF target supports BIM:
            RETURN "Level proxy preserved"
        RETURN "Level association lost for non-BIM targets"

    IF data_type == "instances":
        RETURN "Definition proxy preserved for most connectors"
```

---

### plan_workflow(steps)

Generate a sequenced execution plan from a set of workflow steps.

**Input**: Array of step descriptions (source, target, purpose).

**Output**: Ordered plan with skills, warnings, and error recovery for each step.

**Procedure**:

```
1. FOR each step:
   a. Call select_connector(source, "publish") for the sending side
   b. Call select_connector(target, "load") for the receiving side
   c. Call check_fidelity(source, target, all_data_types)
   d. Generate warnings for any fidelity loss
   e. Assign the relevant skill for detailed guidance

2. Check for reference point alignment across all steps
   IF multiple Revit files involved:
       WARN "Verify all Revit files use the same reference point setting"

3. Check for applicationId continuity
   IF Grasshopper is in the pipeline:
       WARN "Use Passthrough nodes to preserve applicationId"

4. Return sequenced plan with:
   - Step number
   - Connector and skill to use
   - Settings to configure
   - Fidelity warnings
   - Error recovery procedures
```

---

### resolve_terminology(user_term)

Map legacy or ambiguous terms to current Speckle terminology.

**Input**: User-provided term (e.g., "stream", "branch", "commit").

**Output**: Current term and SDK parameter name.

**Mapping**:

| User Input | Current Term | SDK Parameter (Python) | SDK Parameter (C#) | GraphQL Field |
|------------|-------------|----------------------|-------------------|---------------|
| stream | Project | `stream_id` | `streamId` | `project { ... }` |
| branch | Model | `branch_name` | `branchName` | `model { ... }` |
| commit | Version | `commit_id` | `commitId` | `version { ... }` |
| collaborator | Project Collaborator | N/A | N/A | `collaborators` |
| object | Object | `object_id` | `objectId` | `object { ... }` |

---

### select_version_strategy(scenario)

Recommend a model/version organization strategy based on the project scenario.

**Input**: Scenario description (team size, tools, project type).

**Output**: Recommended strategy with model structure and naming convention.

**Decision logic**:

```
IF single_discipline AND sequential_iterations:
    RETURN "One model, many versions"
    naming: "[DATE]-[DESCRIPTION]"

IF multi_discipline:
    RETURN "Model-per-discipline"
    naming: "[DISCIPLINE]-[PHASE]-[DATE]"
    structure: project/architecture, project/structure, project/mep, etc.

IF design_alternatives AND same_tool:
    RETURN "One model, tagged versions"
    naming: "option-[LETTER]-[DATE]"

IF design_alternatives AND different_tools:
    RETURN "Model-per-alternative"
    naming: "[TOOL]-option-[LETTER]"

IF large_campus:
    RETURN "Model-per-zone"
    naming: "[ZONE]-[DISCIPLINE]"

IF automated_pipeline:
    RETURN "Dedicated automation model"
    naming: "auto-[TIMESTAMP]-[HASH]"
```

---

### diagnose_workflow_failure(symptom)

Route a workflow failure to the correct diagnostic procedure and skill.

**Input**: Symptom description.

**Output**: Diagnosis, fix, and skill reference.

**Routing table**:

| Symptom | Likely Cause | Fix | Skill |
|---------|-------------|-----|-------|
| Objects at wrong position | Reference point mismatch | Align reference points, republish | `speckle-impl-revit`, `speckle-impl-federation` |
| Send/receive timeout | Large model or network issue | Reduce selection, check connectivity | `speckle-errors-transport` |
| Properties missing after load | Target connector drops properties | Accept limitation or use viewer | `speckle-impl-federation` |
| Change tracking broken | Grasshopper regenerating GUIDs | Use Passthrough nodes | `speckle-impl-rhino-grasshopper` |
| Auth error 401/403 | Token expired or wrong scope | Regenerate PAT with correct scopes | `speckle-core-api` |
| Version creation fails | Object not uploaded first | Upload objects before creating version | `speckle-impl-versioning` |
| Viewer not loading model | Invalid URL or permissions | Verify model URL and access rights | `speckle-impl-viewer` |
| Webhook not firing | Incorrect event type or URL | Verify webhook configuration | `speckle-syntax-webhooks` |
| Automate function not triggered | Wrong trigger model or disabled | Check automation configuration | `speckle-impl-automate-functions` |
| Materials not appearing | Wrong shader type (Blender) | Use Principled/Diffuse/Emission/Glass | `speckle-impl-blender` |
