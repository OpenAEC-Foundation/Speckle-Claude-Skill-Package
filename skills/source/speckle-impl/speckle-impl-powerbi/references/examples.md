# speckle-impl-powerbi — Examples Reference

## Example 1: Basic Model Loading

Load a single Speckle model into Power BI for tabular analysis.

```m
// Power Query (M Language) — Advanced Editor
let
    Source = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/def456"),
    // Each row is one Speckle object with properties as columns
    FilteredRows = Table.SelectRows(Source, each [category] = "Walls")
in
    FilteredRows
```

**Key points**:
- The URL comes from the Speckle web app model page
- Without `@versionId`, ALWAYS loads the latest version on refresh
- Filtering by category, type, or level happens in standard Power Query

---

## Example 2: Version-Pinned Loading

Load a specific version that does NOT update on refresh.

```m
let
    // The @versionId suffix pins to an exact version
    Source = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/def456@v789")
in
    Source
```

**When to use**: Baseline comparisons, audit snapshots, regulatory submissions where data must NOT change.

---

## Example 3: Extracting Object Properties

Use `Speckle.Objects.Properties` to flatten nested property records.

```m
let
    Source = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/def456"),
    // Add a column with extracted properties for each object
    WithProperties = Table.AddColumn(Source, "ExtractedProps", each
        Speckle.Objects.Properties(_, {"Volume", "Area", "Mark", "Type Name"})
    ),
    // Expand the extracted properties into separate columns
    Expanded = Speckle.Utils.ExpandRecord(WithProperties, "ExtractedProps")
in
    Expanded
```

**Key points**:
- Pass individual records (rows), NOT the entire table
- Use `filterKeys` to limit to specific properties for performance
- Combine with `Speckle.Utils.ExpandRecord` for flat column output

---

## Example 4: Material Quantity Analysis

Extract material quantities across an entire model for cost estimation.

```m
let
    Source = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/def456"),
    // Expand material quantities into columns with "MQ." prefix
    WithMaterials = Speckle.Models.MaterialQuantities(Source, true)
    // Result: columns like "MQ.Concrete.volume", "MQ.Concrete.area", "MQ.Steel.volume", etc.
in
    WithMaterials
```

**Key points**:
- `Speckle.Models.MaterialQuantities` is a TABLE-level function — pass the whole table
- Set `addPrefix = true` to avoid column name collisions with existing data
- Combine with DAX measures for cost calculations (e.g., volume * unit price)

---

## Example 5: Composite Structure Breakdown

Analyze wall layers for thermal or structural assessments.

```m
let
    Source = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/def456"),
    // Filter to walls only (composite structures apply to walls, floors, roofs)
    Walls = Table.SelectRows(Source, each [category] = "Walls"),
    // Extract composite structure as list for expansion
    WithLayers = Table.AddColumn(Walls, "Layers", each
        Speckle.Objects.CompositeStructure(_, true)
    ),
    // Expand list into rows (one row per layer per wall)
    ExpandedLayers = Table.ExpandListColumn(WithLayers, "Layers"),
    // Expand layer records into columns
    ExpandedDetails = Table.ExpandRecordColumn(ExpandedLayers, "Layers",
        {"material", "thickness", "function"})
in
    ExpandedDetails
```

**Key points**:
- Works ONLY with Revit and Archicad data — returns null for other sources
- Set `outputAsList = true` for row expansion with `Table.ExpandListColumn`
- Each layer becomes a separate row, enabling per-layer analysis

---

## Example 6: Multi-Model Federation

Combine structural and architectural models for cross-discipline dashboards.

```m
let
    ArchModel = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/arch001"),
    StructModel = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/struct002"),
    MEPModel = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/mep003"),
    // Federate all three models into one table
    Federated = Speckle.Models.Federate({ArchModel, StructModel, MEPModel})
in
    Federated
```

**Key points**:
- Pass tables as a list `{Table1, Table2, ...}`
- The 3D visual renders all models together when mapped to the federated table
- Use `excludeData = true` for metadata-only federation (faster for large models)

---

## Example 7: Metadata-Only Federation for 3D Visualization

Load 3D geometry without full property data for faster rendering.

```m
let
    Model1 = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/model1"),
    Model2 = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/model2"),
    // excludeData = true skips full property import
    Federated = Speckle.Models.Federate({Model1, Model2}, true)
in
    Federated
```

**When to use**: Large models where only 3D visualization is needed, not tabular analysis.

---

## Example 8: Project Issue Tracking Dashboard

Combine issues with 3D model context.

```m
let
    // Load issues with reply threads
    Issues = Speckle.Projects.Issues(
        "https://app.speckle.systems/projects/abc123",
        true
    ),
    // Filter to open issues only
    OpenIssues = Table.SelectRows(Issues, each [Status] = "Open")
in
    OpenIssues
```

**Key points**:
- Accepts project-level, model-level, or version-level URLs
- Set `getReplies = true` to include discussion threads
- Combine with model data on the same report page for spatial issue context

---

## Example 9: Record Column Expansion

Flatten deeply nested properties using the utility function.

```m
let
    Source = Speckle.GetByUrl("https://app.speckle.systems/projects/abc123/models/def456"),
    // Expand only specific fields from a record column
    Expanded = Speckle.Utils.ExpandRecord(Source, "properties",
        {"Volume", "Area", "Level"},
        true  // UseCombinedNames: creates "properties.Volume", "properties.Area", etc.
    )
in
    Expanded
```

**Key points**:
- Use `FieldNames` to limit expanded columns (improves performance)
- Use `UseCombinedNames = true` when expanding multiple record columns to avoid name collisions
- ALWAYS check column names after expansion — nested records may produce unexpected field names

---

## Example 10: 3D Visual Column Mapping

After loading data, configure the 3D visual with correct column mappings.

**Step-by-step**:

1. Load model data using any of the above patterns
2. Add Speckle 3D Visual to the report canvas
3. Map columns in the Visualizations pane:
   - **Model Info** → drag the model info column (REQUIRED)
   - **Object IDs** → drag the object ID column (REQUIRED for interactivity)
   - **Tooltip** → drag any descriptive column (e.g., type name, category)
   - **Color by** → drag any categorical or numerical column

**Interactivity**:
- Clicking an element in the 3D visual filters all other visuals on the page
- Hovering shows tooltip values
- Ghost icon toggles visibility of non-selected elements
