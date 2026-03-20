# speckle-impl-powerbi — Methods Reference

## Helper Functions (Power Query / M Language)

All functions are available in the Power Query formula bar and Advanced Editor after the Speckle connector is installed.

---

### Speckle.Projects.Issues

```
Speckle.Projects.Issues(url as text, getReplies as bool) as table
```

**Purpose**: Fetches project issues from a Speckle project, model, or version.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | text | YES | — | Speckle project, model, or version URL |
| `getReplies` | bool | No | false | When true, includes issue reply threads |

**Returns**: Table with columns:

| Column | Type | Description |
|--------|------|-------------|
| Id | text | Issue identifier |
| Title | text | Issue title |
| Description | text | Issue body text |
| Status | text | Current status |
| Priority | text | Priority level |
| Assignee | text | Assigned user |
| Due Date | date | Due date |
| Created | datetime | Creation timestamp |
| Updated | datetime | Last update timestamp |
| Labels | list | Applied labels |
| Replies | table | Reply threads (only when `getReplies = true`) |
| URL | text | Direct link to issue |

---

### Speckle.Objects.Properties

```
Speckle.Objects.Properties(inputRecord as record, optional filterKeys as list) as record
```

**Purpose**: Extracts properties from a single object record without manually navigating nested record structures.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `inputRecord` | record | YES | — | Single object record from the model table |
| `filterKeys` | list | No | all keys | List of property key names to extract |

**Returns**: Record containing extracted property key-value pairs.

**Usage pattern**: ALWAYS apply this function per-row using `Table.AddColumn` or `Table.TransformColumns`. NEVER pass the entire table.

---

### Speckle.Objects.CompositeStructure

```
Speckle.Objects.CompositeStructure(inputRecord as record, optional outputAsList as nullable logical) as any
```

**Purpose**: Extracts layered material structures from composite elements (Walls, Floors, Roofs).

**Compatibility**: Works ONLY with data published from Revit or Archicad connectors. Returns null for objects from other sources.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `inputRecord` | record | YES | — | Single object record |
| `outputAsList` | logical | No | false | When true, returns list format suitable for `Table.ExpandListColumn` |

**Returns**: Record (default) or list (when `outputAsList = true`) containing layer definitions with material names, thicknesses, and functions.

---

### Speckle.Objects.MaterialQuantities

```
Speckle.Objects.MaterialQuantities(inputRecord as record, optional outputAsList as logical) as any
```

**Purpose**: Accesses material quantity data (volume, area per material) for a single object.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `inputRecord` | record | YES | — | Single object record |
| `outputAsList` | logical | No | false | When true, returns list format for row expansion |

**Returns**: Record (default) or list containing material names with associated volume and area values.

---

### Speckle.Models.MaterialQuantities

```
Speckle.Models.MaterialQuantities(inputTable as table, optional addPrefix as logical) as table
```

**Purpose**: Expands material quantities across all rows in a model table, creating one column per material.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `inputTable` | table | YES | — | Full model data table |
| `addPrefix` | logical | No | false | When true, prefixes columns with "MQ." (e.g., "MQ.Concrete") |

**Returns**: Table with additional columns for each material found across all objects.

**Note**: This is a table-level function — pass the entire table, NOT individual records.

---

### Speckle.Models.Federate

```
Speckle.Models.Federate(tables as list, optional excludeData as logical) as table
```

**Purpose**: Combines multiple loaded model tables into a single federated table for multi-model 3D visualization and cross-model analytics.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tables` | list | YES | — | List of model tables (each from a separate `Speckle.GetByUrl` call) |
| `excludeData` | logical | No | false | When true, federates metadata only without full data import |

**Returns**: Combined table with all objects from all input models.

**Performance note**: Set `excludeData = true` for large models when only 3D visualization is needed, not tabular analysis.

---

### Speckle.Utils.ExpandRecord

```
Speckle.Utils.ExpandRecord(table as table, columnName as text, optional FieldNames as list, optional UseCombinedNames as logical) as table
```

**Purpose**: Expands record-type columns into separate table columns. Replaces manual `Table.ExpandRecordColumn` calls with automatic field detection.

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `table` | table | YES | — | Input table containing the record column |
| `columnName` | text | YES | — | Name of the column containing record values |
| `FieldNames` | list | No | all fields | Specific field names to expand |
| `UseCombinedNames` | logical | No | false | When true, prefixes expanded columns with source column name |

**Returns**: Table with the record column replaced by individual columns for each field.

---

## Core Connector Function

### Speckle.GetByUrl

```
Speckle.GetByUrl(url as text) as table
```

**Purpose**: Primary data loading function. Fetches a Speckle model and returns it as a Power BI table.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | text | YES | Speckle model URL (with optional `@versionId` for pinning) |

**Returns**: Table where each row represents one Speckle object with its properties as columns.

**Note**: This function is invoked automatically when using the Get Data UI. Direct use is required in Advanced Editor for federation and custom queries.
