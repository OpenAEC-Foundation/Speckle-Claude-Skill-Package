# speckle-impl-revit — Anti-Patterns

## AP-R01: Expecting Native Element Recreation on Receive

**Severity**: Critical

**The mistake**: Assuming that a Revit wall published to Speckle will load back as a native Revit wall with editable parameters, constraint relationships, and hosted elements.

**Why it happens**: Users expect round-trip fidelity. The mental model is "export and re-import" which implies format preservation.

**Reality**: Speckle ALWAYS creates Direct Shapes in Revit on receive. There are ZERO exceptions. A wall becomes a generic solid shape. A door becomes a generic solid shape. A floor becomes a generic solid shape. Native parametric behavior, hosted element relationships, and constraint-based editing are permanently lost on receive.

**Correct approach**: Use Speckle for coordination and data exchange, NOT for round-trip editing. Edit native elements in their source application and republish.

---

## AP-R02: Mismatched Reference Points Between Publish and Receive

**Severity**: Critical

**The mistake**: Publishing with Internal Origin in one Revit file and loading with Survey Point in another.

**Why it happens**: Different teams use different reference point conventions. The setting is easy to overlook in the connector UI.

**Result**: Models appear offset by the distance between the reference points. In large projects, this offset can be hundreds of meters.

**Correct approach**: ALWAYS agree on a single reference point setting (Internal Origin, Project Base, or Survey Point) across ALL teams before any publishing begins. Document this in the project BIM Execution Plan.

---

## AP-R03: Publishing 2D Documentation Views

**Severity**: High

**The mistake**: Expecting floor plans, building sections, detail views, or elevations to appear in Speckle after publishing from Revit.

**Why it happens**: Users assume "publish all" means all views are included.

**Reality**: Revit ONLY publishes 3D perspective views. Plans, sections, elevations, and orthographic 3D views are silently excluded. There is no error message — they simply do not appear.

**Correct approach**: NEVER rely on Speckle for 2D documentation exchange from Revit. Use PDF, DWG, or other formats for 2D views.

---

## AP-R04: Assuming Custom Properties Load into Revit

**Severity**: High

**The mistake**: Publishing custom Speckle properties (e.g., from Grasshopper or other connectors) and expecting them to appear as Revit parameters on received Direct Shapes.

**Why it happens**: Properties are visible in the Speckle web viewer, creating the expectation they will transfer to all applications.

**Reality**: "Currently, you can not load any custom properties on your Speckle model objects into Revit." Properties are preserved in Speckle but NOT attached to Revit elements on receive.

**Correct approach**: View properties in the Speckle web viewer or use Power BI connector for property analysis. Do NOT build workflows that depend on custom property round-trips through Revit.

---

## AP-R05: Publishing Unloaded Linked Models

**Severity**: Medium

**The mistake**: Publishing with "Include Linked Models" ON while some linked Revit files are unloaded in the project.

**Why it happens**: Large projects often have linked files unloaded for performance. Users forget to reload them before publishing.

**Result**: Unloaded linked files are silently excluded from the publish. The Speckle model appears incomplete.

**Correct approach**: ALWAYS verify that ALL linked files are loaded (not unloaded) before publishing with linked models enabled.

---

## AP-R06: Using Volumetric Rebar Mode on Large Models

**Severity**: Medium

**The mistake**: Enabling "Send Rebars As Volumetric" on models with thousands of rebars.

**Why it happens**: Users want visual solid representations for presentations or clash detection.

**Result**: Publishing time increases dramatically. Models with 5000+ rebars can take hours to publish in volumetric mode versus minutes in curve mode.

**Correct approach**: Use curve mode (default) for large models. If volumetric is required, publish a small selection first to estimate timing. Consider publishing rebars separately from the main structural model.

---

## AP-R07: Trying to Modify Categories After Loading

**Severity**: Medium

**The mistake**: Loading a model into Revit and then trying to change the category assignment of Direct Shapes.

**Why it happens**: Users want to classify received elements according to their Revit project standards.

**Result**: Object categories CANNOT be modified after loading. The default category assignment is permanent.

**Correct approach**: Accept the default category assignment for Direct Shapes. If specific categorization is needed, organize elements using Speckle collections and Revit worksets or selection sets instead.

---

## AP-R08: Using `type` Field as Revit TypeId

**Severity**: Medium

**The mistake**: Attempting to programmatically match RevitObject `type` values to Revit TypeIds for automation.

**Why it happens**: The field name "type" suggests it corresponds to the Revit API TypeId.

**Reality**: The `type` field contains the element type NAME (e.g., "Basic Wall - 200mm"), NOT the Revit TypeId (e.g., the internal integer ID or GUID).

**Correct approach**: Match by family name + type name combination. Use `properties` to access additional identifying information if needed.

---

## AP-R09: Ignoring Shared Coordinates in Linked File Workflows

**Severity**: High

**The mistake**: Publishing linked models without verifying that shared coordinates are consistent between host and linked files.

**Why it happens**: Shared coordinate configuration is a Revit project setup step that happens once and is often forgotten.

**Result**: Linked model elements appear at incorrect positions in Speckle, offset from the host model.

**Correct approach**: ALWAYS verify shared coordinates between host and linked files in Revit before publishing. Use "Acquire Coordinates" or "Publish Coordinates" in Revit to align files. Test with a small publish to confirm alignment.

---

## AP-R10: Expecting Texture Support

**Severity**: Low

**The mistake**: Applying detailed textures to Revit materials and expecting them to appear in Speckle or downstream applications.

**Why it happens**: Revit supports rich material textures, and users assume this data transfers.

**Reality**: Speckle does NOT support textures across ANY connector. Only basic material properties transfer: color (RGB), opacity, metallic, and roughness. UV mapping and texture images are permanently lost.

**Correct approach**: NEVER rely on textures surviving the Speckle pipeline. Use basic material properties (color, opacity) for visual differentiation. Apply textures manually in the receiving application if needed.

---

## AP-R11: Publishing from Revit Without Checking Element Visibility

**Severity**: Low

**The mistake**: Publishing from a view where important elements are hidden by visibility/graphics overrides, filters, or section boxes.

**Why it happens**: View-based publishing respects element visibility, which may not be obvious.

**Result**: Elements hidden in the source view are excluded from the publish. The Speckle model appears incomplete.

**Correct approach**: Before view-based publishing, ALWAYS review the view's visibility/graphics settings, active filters, and section box to ensure all intended elements are visible.

---

## Summary Table

| ID | Anti-Pattern | Severity | Core Rule |
|----|-------------|----------|-----------|
| AP-R01 | Expecting native elements on receive | Critical | ALWAYS expect Direct Shapes |
| AP-R02 | Mismatched reference points | Critical | ALWAYS use the same reference point on both ends |
| AP-R03 | Publishing 2D views | High | NEVER expect plans/sections/elevations |
| AP-R04 | Assuming custom property import | High | NEVER expect properties on Revit receive |
| AP-R05 | Publishing unloaded linked models | Medium | ALWAYS verify linked files are loaded |
| AP-R06 | Volumetric rebar on large models | Medium | NEVER use volumetric for 1000+ rebars without testing |
| AP-R07 | Modifying categories after load | Medium | NEVER expect category changes on Direct Shapes |
| AP-R08 | Using type as TypeId | Medium | ALWAYS treat type as display name, not API identifier |
| AP-R09 | Ignoring shared coordinates | High | ALWAYS verify shared coordinates before linked model publish |
| AP-R10 | Expecting texture transfer | Low | NEVER rely on textures surviving the pipeline |
| AP-R11 | Hidden elements in view-based publish | Low | ALWAYS check visibility settings before publishing |
