# speckle-impl-revit — Examples

## Example 1: Publishing a Revit Model with Manual Selection

### Steps

1. Open the Revit project file
2. Select the elements to publish in the viewport (e.g., all walls on Level 1)
3. Open the Speckle connector (DUI3 panel)
4. Choose the target Speckle project and model
5. Verify publishing settings:
   - Include Linked Models: ON or OFF depending on scope
   - Reference Point: Internal Origin (default)
   - Send Rebars As Volumetric: OFF (unless solid rebar geometry is required)
6. Click Publish

### Expected Result

- Selected elements appear in the Speckle web viewer
- Collection hierarchy: File > Level > Category > Type > RevitObject
- Each RevitObject contains `displayValue` (mesh geometry) and `properties` (all parameters)
- RenderMaterial, Level, and Group proxies created at root level

---

## Example 2: Publishing with View-Based Filter

### Steps

1. Create or select a Revit 3D view that shows only the desired elements (use Revit view filters, visibility/graphics overrides, or section boxes)
2. Open the Speckle connector
3. Select "View" as the publishing mode
4. Choose the target 3D view
5. Set Reference Point to match your coordination strategy (e.g., Survey Point for geo-referenced projects)
6. Click Publish

### Expected Result

- ONLY elements visible in the selected view are published
- 3D perspective views from the model are included as Camera objects
- Plans, sections, and elevations are NEVER included regardless of the selected view

---

## Example 3: Publishing with Category-Based Filter

### Steps

1. Open the Speckle connector
2. Select "Category" as the publishing mode
3. Choose categories to include (e.g., Walls, Floors, Structural Columns)
4. All visible elements in selected categories across all levels will be published
5. Click Publish

### Expected Result

- All elements matching selected categories are published
- Gridlines from the Annotation category are included if visible
- Elements from non-selected categories are excluded

---

## Example 4: Receiving a Model into Revit

### Steps

1. Open a target Revit project (or create a new one)
2. Open the Speckle connector
3. Browse to the source Speckle project and model
4. Select the version to load (latest by default)
5. Configure receive settings:
   - Reference Point: MUST match the reference point used during publish
   - Receive Blocks as Families: ON if block instances should become Revit families
6. Click Load

### Expected Result

- ALL objects appear as Direct Shapes (generic models)
- No native Revit elements are created (no walls, doors, floors, beams)
- Materials with matching names in the Revit project are reused
- 3D views from the source model are created as 3D views in Revit
- Custom properties from the source are NOT loaded onto the Direct Shapes

---

## Example 5: Coordinate System Alignment for Multi-Team Coordination

### Scenario

Architecture team (Revit) and structure team (Revit) need to publish to the same Speckle project for federated coordination.

### Steps

1. **Both teams**: Agree on a single reference point (e.g., Survey Point)
2. **Both teams**: Verify their Revit project's Survey Point is set to the same real-world coordinates
3. **Architecture team**: Publish with Reference Point = Survey Point
4. **Structure team**: Publish with Reference Point = Survey Point
5. **Coordination lead**: View federated model in Speckle web viewer

### Expected Result

- Both models align correctly in the web viewer
- Elements from both models share the same coordinate space
- The `referencePointTransform` on each RevitObject encodes the Survey Point offset

### Common Failure

If Team A publishes with Internal Origin and Team B publishes with Survey Point, models will be offset from each other. ALWAYS coordinate reference point settings before publishing.

---

## Example 6: Publishing with Linked Models

### Steps

1. Open the host Revit file (with linked files loaded)
2. Verify all linked files are loaded (not unloaded)
3. Open the Speckle connector
4. Ensure "Include Linked Models" is ON (default)
5. Choose publishing mode and reference point
6. Click Publish

### Expected Result

- Host file elements appear under the host file's File collection
- Each linked file appears as a separate File collection
- All files use the host file's reference point setting
- Linked model elements include their own properties and metadata

### Verifying in the Web Viewer

- Navigate the collection tree: each file is a top-level node
- Linked files are clearly separated from the host file
- Elements from linked files carry their own category/type/level hierarchy

---

## Example 7: Rebar Export Workflow

### Default Mode (Curves)

1. Publish with "Send Rebars As Volumetric" OFF
2. Rebars appear as centerline curves in Speckle
3. Suitable for: quantity takeoffs, structural analysis, lightweight coordination

### Volumetric Mode (Solids)

1. Enable "Send Rebars As Volumetric" in publish settings
2. Rebars appear as solid geometry in Speckle
3. WARNING: Publishing time increases significantly for models with many rebars
4. Suitable for: clash detection, detailed visualization, 3D printing workflows

### Performance Guideline

- Models with < 500 rebars: volumetric mode is acceptable
- Models with > 1000 rebars: ALWAYS use curve mode unless solid geometry is strictly required
- Test publish time with a small selection before committing to volumetric mode on a full model

---

## Example 8: Material Round-Trip

### Publishing Side

1. Revit elements with assigned materials publish as RevitObjects
2. Material properties (color, opacity, metallic, roughness) become RenderMaterial proxies
3. Each proxy references all elements using that material via `applicationId` arrays

### Receiving Side

1. Load the model into a Revit project
2. If the Revit project already has a material named "Concrete - Cast-in-Place", that existing material is reused
3. If no matching material name exists, a new material is created with the published properties
4. Direct Shapes allow material editing after loading
5. Textures are NEVER transferred — only basic material properties survive

---

## Example 9: Revit to Grasshopper Round-Trip

### Step 1: Publish from Revit

1. Publish the Revit model with desired reference point
2. Note: all parameters, materials, and geometry are captured

### Step 2: Load in Grasshopper

1. Use the Load component with the Speckle Model URL
2. Query Objects component returns flattened object lists
3. Each Revit element becomes a Data Object in Grasshopper
4. Access properties via the Deconstruct component

### Step 3: Manipulate and Publish Back

1. Use passthrough nodes to modify loaded objects (preserves applicationIds)
2. Create Collections to organize output
3. Publish back to a new model or version

### Step 4: Load Back in Revit

1. Load the Grasshopper-modified model into Revit
2. ALL objects become Direct Shapes — original native elements are NOT recreated
3. This is the expected behavior, not a bug
