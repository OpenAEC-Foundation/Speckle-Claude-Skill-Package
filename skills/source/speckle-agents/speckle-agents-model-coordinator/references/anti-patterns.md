# anti-patterns.md -- speckle-agents-model-coordinator

## AP-1: Skipping the Fidelity Check

**Wrong**: Planning a workflow without checking what data survives the transfer.

```
User: "Send our Revit model to Blender for rendering."
Bad response: "Publish from Revit, load in Blender. Done."
```

**Right**: ALWAYS check fidelity before confirming a workflow.

```
User: "Send our Revit model to Blender for rendering."
Good response:
  "You can publish from Revit and load in Blender. Key fidelity notes:
   - Geometry: Mesh geometry transfers correctly
   - Materials: Color, opacity, metallic, roughness transfer via RenderMaterial proxy
   - Textures: NEVER transfer — you must reassign textures in Blender
   - Custom properties: Blender DROPS custom properties on load
   - Shader types: Blender only recognizes Principled, Diffuse, Emission, Glass"
```

**Why**: Users make critical project decisions based on your workflow advice. Omitting fidelity constraints leads to failed deliverables and wasted effort.

---

## AP-2: Promising Native Element Recreation

**Wrong**: Telling a user that Revit walls will remain walls after a round-trip.

```
"The Revit wall will load back into Revit as a native wall with all its parameters."
```

**Right**: ALWAYS state that loaded objects become generic geometry.

```
"The Revit wall will load back into Revit as a Direct Shape. Native wall parameters
(type, family, constraints) are NOT available as editable Revit parameters. Properties
exist in Speckle and are visible in the web viewer."
```

**Why**: Native element recreation does NOT exist in any Speckle connector. This is the most common misconception and causes project failures when teams discover it too late.

---

## AP-3: Ignoring Connector Direction Constraints

**Wrong**: Planning a round-trip workflow with Tekla or Power BI.

```
"Publish from Revit, load in Tekla for structural analysis, push back to Revit."
```

**Right**: ALWAYS verify connector direction capabilities.

```
"Tekla is publish-only — it CANNOT load data from Speckle. For structural analysis
of Revit data, consider Grasshopper or a Python script using SpecklePy."
```

**Why**: Tekla connector only publishes. Power BI only reads. Planning a workflow that requires unsupported direction wastes the entire pipeline setup.

---

## AP-4: Using Legacy Terminology Without Translation

**Wrong**: Accepting and repeating legacy terms without correction.

```
User: "How do I create a new stream?"
Bad: "Use the create stream mutation..."
```

**Right**: ALWAYS translate to current terminology and explain the mapping.

```
User: "How do I create a new stream?"
Good: "In current Speckle terminology, a 'stream' is now called a 'Project'.
Use the projectMutations.create mutation. Note that some SDK parameters
still use 'stream_id' for backward compatibility."
```

**Why**: Mixed terminology causes confusion in documentation, code, and team communication. The migration from stream/branch/commit to project/model/version is ongoing, and consistent use of current terms prevents errors.

---

## AP-5: Planning Workflows That Depend on Texture Transfer

**Wrong**: Including texture-dependent steps in a Speckle workflow.

```
"Publish your textured Revit model, load in Blender, and render with the original textures."
```

**Right**: ALWAYS warn that textures do not transfer.

```
"Speckle does NOT transfer textures in any connector. Material properties
(color, opacity, metallic, roughness) transfer via RenderMaterial proxy.
You MUST reassign textures manually in Blender after loading."
```

**Why**: Textures are not part of Speckle's data schema. No connector supports them. Planning a rendering workflow that assumes texture transfer will fail.

---

## AP-6: Skipping Reference Point Alignment

**Wrong**: Coordinating a multi-discipline project without establishing a shared origin.

```
"Just have everyone publish to the same Speckle project."
```

**Right**: ALWAYS align reference points before the first publish.

```
"Before publishing:
 1. All Revit files: Use the SAME reference point setting (Survey Point recommended for geo-referenced projects)
 2. Rhino/AutoCAD/Blender: Set World Origin to match the agreed coordinates
 3. Verify alignment by loading two models into the viewer and checking spatial overlap"
```

**Why**: Misaligned reference points cause models to appear in wrong positions in the federated view. This error is silent — no warning is shown — and only becomes visible when models are overlaid.

---

## AP-7: Overlooking Grasshopper applicationId Regeneration

**Wrong**: Using standard Grasshopper object creation in a round-trip workflow.

```
"Create new points in Grasshopper and publish them back as modifications."
```

**Right**: ALWAYS enforce Passthrough nodes for round-trip workflows.

```
"ALWAYS use Passthrough nodes to mutate the loaded Speckle objects.
Standard Grasshopper components generate new GUIDs on every solve,
which breaks applicationId continuity and change tracking.
Passthrough preserves the original applicationId from the source."
```

**Why**: Without Passthrough nodes, every Grasshopper solve regenerates all object identifiers. This breaks proxy references (materials, levels, groups lose their object associations) and makes version-to-version diff meaningless.

---

## AP-8: Recommending a Single Model for Multi-Discipline Work

**Wrong**: Having all disciplines publish to the same model.

```
"Create one model and have everyone publish there."
```

**Right**: ALWAYS recommend model-per-discipline for multi-team projects.

```
"Create separate models per discipline:
  architecture/ (Revit)
  structure/ (Tekla)
  mep/ (Revit)
  landscape/ (Rhino)

Each team publishes to their own model. Federate at the project level
for coordination views. This prevents version conflicts and preserves
clear ownership boundaries."
```

**Why**: A single model creates version conflicts when multiple teams publish. There is NO automatic merge in Speckle — each publish creates a new version that replaces the previous one. Separate models per discipline provide clean history and clear ownership.

---

## AP-9: Not Including Version Messages

**Wrong**: Publishing versions without descriptive messages.

```python
# Bad: No message
client.version.create(stream_id=project_id, object_id=hash, branch_name="main")
```

**Right**: ALWAYS include a descriptive message with discipline, phase, and date.

```python
# Good: Descriptive message
client.version.create(
    stream_id=project_id,
    object_id=hash,
    branch_name="architecture",
    message="ARCH-DD-20260320-facade-update-south-elevation",
    source_application="Revit 2025"
)
```

**Why**: Version history without messages is unusable for collaboration. Teams cannot identify which version corresponds to which design decision. The sourceApplication field enables filtering and audit trails.

---

## AP-10: Treating Speckle as a File Transfer Tool

**Wrong**: Using Speckle to move complete files between applications.

```
"Export your entire Revit project to Speckle and import it into Rhino."
```

**Right**: Frame Speckle as a data exchange and federation platform.

```
"Speckle exchanges structured data (geometry + properties + relationships),
not application files. When you publish from Revit, objects are converted
to Speckle's universal schema. When loaded in Rhino, they become Rhino
geometry with properties as user strings. The Revit file itself is not
transferred — only the data within it."
```

**Why**: Users who think of Speckle as file transfer expect 1:1 fidelity. Understanding that Speckle converts data to a universal schema — with intentional fidelity trade-offs — sets correct expectations and prevents disappointment.

---

## AP-11: Consulting the Wrong Skill

**Wrong**: Looking up Revit-specific behavior in the general connectors overview.

**Right**: ALWAYS route to the most specific skill available.

| Need | Wrong Skill | Right Skill |
|------|-------------|-------------|
| Revit reference points | `speckle-impl-connectors-overview` | `speckle-impl-revit` |
| Grasshopper Passthrough | `speckle-impl-connectors-overview` | `speckle-impl-rhino-grasshopper` |
| SpecklePy authentication | `speckle-core-api` | `speckle-impl-python-sdk` |
| GraphQL pagination | `speckle-core-api` | `speckle-syntax-graphql` |
| Automate function code | `speckle-syntax-automate` | `speckle-impl-automate-functions` |
| Transport errors | `speckle-core-transport` | `speckle-errors-transport` |

**Why**: General skills provide overview information. Specific skills provide the detailed, version-explicit, connector-specific guidance needed for implementation. Consulting the wrong skill leads to incomplete or generic answers.

---

## AP-12: Assuming Automatic Clash Detection

**Wrong**: Telling users that Speckle detects clashes in federated models.

```
"Load all models into Speckle and it will flag clashes automatically."
```

**Right**: Speckle federates models but does NOT perform clash detection.

```
"Speckle displays all models together in a federated view, but does NOT
perform automatic clash detection. For clash detection:
  - Use Speckle Automate to write a custom clash detection function
  - Use a dedicated tool (Navisworks, Solibri) with exported data
  - Build a custom Python script using SpecklePy to compare spatial data"
```

**Why**: Clash detection requires spatial analysis algorithms that Speckle's viewer and server do not provide natively. Users must implement this as a custom Automate function or use external tools.
