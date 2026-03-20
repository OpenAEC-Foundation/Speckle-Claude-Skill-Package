# speckle-impl-powerbi — Anti-Patterns Reference

## AP-1: Treating Power BI Connector as Bidirectional

**Wrong**: Assuming the Power BI connector can publish data back to Speckle.

**Why it fails**: The Power BI connector is strictly read-only. It loads Speckle data for visualization and analytics. There is NO publish capability. This is by design — Power BI is an analytics tool, not a design tool.

**Correct approach**: ALWAYS use design connectors (Revit, Rhino, Grasshopper, Blender, etc.) for publishing data to Speckle. Use Power BI exclusively for consuming and analyzing that data.

---

## AP-2: Deploying Reports Without Data Gateway

**Wrong**: Publishing a Power BI report to Power BI Service and expecting automatic scheduled refresh without configuring a Data Gateway.

**Why it fails**: The Speckle connector is a custom connector that requires a gateway to function in Power BI Service. Without a gateway, the report displays stale data from the last manual refresh and scheduled refresh silently fails.

**Correct approach**: ALWAYS install and configure either a Personal Mode or Standard Mode Data Gateway before publishing reports that need scheduled refresh. Verify the Speckle connector appears in the gateway's Connectors tab.

---

## AP-3: Skipping Security Configuration

**Wrong**: Installing the connector and immediately trying to load data without configuring third-party data source settings.

**Why it fails**: Power BI blocks custom connectors by default. The connector will NOT appear in Get Data or will fail to load.

**Correct approach**: ALWAYS configure: File > Options and settings > Options > Security > Data Extensions > "Allow any extension to load without validation or warning". Alternatively, register the certificate thumbprint via Windows registry for enterprise deployments.

---

## AP-4: Ignoring Version Pinning

**Wrong**: Using unpinned model URLs for audit reports, compliance dashboards, or baseline comparisons.

**Why it fails**: Without the `@versionId` suffix, every data refresh loads the latest version. Historical comparisons become impossible because the baseline keeps changing.

**Correct approach**: ALWAYS use version-pinned URLs (with `@versionId`) for any report that must reflect a specific point in time. Use unpinned URLs only for live dashboards that should show current data.

---

## AP-5: Passing Tables to Object-Level Functions

**Wrong**:
```m
// WRONG — passing table instead of record
Speckle.Objects.Properties(Source, {"Volume"})
```

**Why it fails**: `Speckle.Objects.Properties`, `Speckle.Objects.CompositeStructure`, and `Speckle.Objects.MaterialQuantities` are object-level functions that expect a single record (one row), NOT an entire table.

**Correct approach**: ALWAYS use `Table.AddColumn` to apply object-level functions per row:
```m
// CORRECT — applying per row
Table.AddColumn(Source, "Props", each Speckle.Objects.Properties(_, {"Volume"}))
```

---

## AP-6: Using CompositeStructure on Non-Revit/Archicad Data

**Wrong**: Applying `Speckle.Objects.CompositeStructure` to objects from Rhino, AutoCAD, Tekla, or other connectors.

**Why it fails**: Composite structure data is ONLY published by the Revit and Archicad connectors. Objects from other sources return null, producing empty columns that waste processing time.

**Correct approach**: ALWAYS filter to Revit or Archicad objects before applying `Speckle.Objects.CompositeStructure`. Check the source connector of your data before using this function.

---

## AP-7: Forgetting Speckle Desktop Services

**Wrong**: Attempting to authenticate or load data without Speckle Desktop Services running.

**Why it fails**: The Power BI connector depends on Speckle Desktop Services for authentication token management. Without it, connection attempts fail with "Cannot connect to Desktop Service" errors.

**Correct approach**: ALWAYS verify `Speckle.Desktop.Services` is running in Task Manager before using the connector. If missing, launch it manually: `%APPDATA%\Speckle\Desktop Services\Speckle.Desktop.Services.exe`.

---

## AP-8: Not Using ExpandRecord for Nested Data

**Wrong**: Manually calling `Table.ExpandRecordColumn` with hardcoded field names for every record column.

**Why it fails**: Speckle objects have dynamic property structures that vary by object type and source connector. Hardcoded field names miss properties and break when data changes.

**Correct approach**: ALWAYS use `Speckle.Utils.ExpandRecord` which automatically detects field names. Use the optional `FieldNames` parameter only when you explicitly need a subset of fields.

---

## AP-9: Federation Without Matching Column Schemas

**Wrong**: Federating models from different connectors without considering that column schemas differ.

**Why it fails**: A Revit model has columns like `category`, `family`, `type`, and `level`. A Rhino model has `layer` and geometry columns. Federating them produces a table with many null values and inconsistent column types.

**Correct approach**: When federating cross-connector models, ALWAYS extract and normalize properties first using `Speckle.Objects.Properties` with consistent `filterKeys`. Alternatively, use `excludeData = true` for 3D-only federation where tabular consistency does not matter.

---

## AP-10: Clearing Authentication Incorrectly

**Wrong**: Deleting only the Power BI cache files when authentication fails, or reinstalling the connector.

**Why it fails**: Authentication tokens are cached in multiple locations. Partial cleanup leaves stale tokens that cause repeated failures.

**Correct approach**: Follow the complete cache clearing procedure:
1. File > Options and settings > Data source settings > select server > Clear Permissions
2. Delete `%APPDATA%/Speckle/Projects/PowerBITokenCache.db`
3. Restart Power BI Desktop
4. If switching accounts: also delete `CEF`, `WebView2`, `Cache` folders and `User.zip` from the Power BI installation directory.

---

## AP-11: Using addPrefix Inconsistently

**Wrong**: Calling `Speckle.Models.MaterialQuantities` without `addPrefix = true` when the model table already has columns that match material names.

**Why it fails**: Expanded material columns may collide with existing column names, causing Power Query errors or overwritten data.

**Correct approach**: ALWAYS set `addPrefix = true` when the model table may contain columns whose names match material names. The "MQ." prefix prevents all naming collisions.

---

## AP-12: Expecting Real-Time Refresh

**Wrong**: Building operational dashboards that expect Speckle data to update in real time within Power BI.

**Why it fails**: Power BI refreshes data on a schedule (minimum interval varies by license) or on manual trigger. There is NO real-time streaming from Speckle to Power BI. Each refresh is a full data reload.

**Correct approach**: Design dashboards for periodic refresh cycles. For near-real-time needs, configure the shortest available scheduled refresh interval and set user expectations accordingly.
