---
name: speckle-impl-powerbi
description: >
  Use when connecting Power BI to Speckle for BIM data analytics and visualization dashboards.
  Prevents confusing Power BI connector with design connectors (read-only, analytics-focused), and missing Data Gateway setup for scheduled refresh.
  Covers Power BI connector setup, 7 helper functions, Data Gateway configuration for scheduled refresh, read-only data access, and analytics use cases distinct from design connectors.
  Keywords: speckle power bi, powerbi, analytics, dashboard, visualization, data gateway, scheduled refresh, BIM analytics, BIM dashboard, visualize model data, reports from Speckle.
license: MIT
compatibility: "Designed for Claude Code. Requires Power BI Desktop, Speckle Connector for Power BI (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-powerbi

## Quick Reference

### Connector Nature

The Power BI connector is fundamentally different from all other Speckle connectors. It is **read-only** and **analytics-focused**. It does NOT publish data back to Speckle. It loads Speckle model data as tabular rows for dashboards, reports, and 3D visualization within Power BI.

| Aspect | Power BI Connector | Design Connectors (Revit, Rhino, etc.) |
|--------|-------------------|----------------------------------------|
| Direction | Read-only (load) | Bidirectional (publish + load) |
| Purpose | Analytics, dashboards, visualization | Model authoring, design exchange |
| Output | Tabular data + 3D visual | Native geometry in host app |
| Data modification | NEVER modifies Speckle data | Creates new versions on publish |

### Two Components

| Component | File Type | Install Location | Purpose |
|-----------|-----------|-----------------|---------|
| Power BI Connector | `.pqx` | `%UserProfile%\Power BI Desktop\Custom Connectors\` | Loads Speckle data as tables |
| 3D Viewer Visual | `.pbiviz` | `%UserProfile%\Power BI Desktop\Custom Visuals\` | Renders 3D models in reports |

### Critical Warnings

**NEVER** assume the Power BI connector can publish data back to Speckle -- it is strictly read-only. Use design connectors (Revit, Rhino, etc.) for publishing.

**NEVER** skip Data Gateway setup when deploying reports to Power BI Service with scheduled refresh -- without a gateway, reports will NOT refresh automatically.

**NEVER** forget to enable third-party data sources in Power BI security settings -- the connector will NOT load without this configuration.

**ALWAYS** verify Speckle Desktop Services is running before using the connector -- the connector depends on this background process for authentication.

**ALWAYS** use `@` in the model URL to pin a specific version -- without it, the connector loads the latest version on every refresh.

---

## Installation

### Automated Installation

1. Download the Speckle Power BI connector from the official connectors page
2. Run the installer -- it places `.pqx` and `.pbiviz` files automatically
3. Configure Power BI security: File > Options and settings > Options > Security > Data Extensions > select "Allow any extension to load without validation or warning"
4. Restart Power BI Desktop

### Manual Installation

1. Extract the downloaded ZIP archive
2. Copy `.pqx` to `%UserProfile%\Power BI Desktop\Custom Connectors\` (create folder if needed)
3. Copy `.pbiviz` to `%UserProfile%\Power BI Desktop\Custom Visuals\` (create folder if needed)
4. Register the certificate thumbprint (requires administrator access):
   - Open Registry Editor (`regedit`)
   - Navigate to `HKEY_LOCAL_MACHINE\Software\Policies\Microsoft\Power BI Desktop`
   - Create `TrustedCertificateThumbprints` as `REG_MULTI_SZ` value
   - Add thumbprints: `5270B3C69218C25BE2F20AB2DD76429DDAA38F61` (v3.2.2 and earlier) and `CDC489B709A709E3283568A9B75D75180B1355BE` (v3.2.3 and later)
5. Configure security settings as above, restart Power BI Desktop

### Prerequisites

- Power BI Desktop (Windows only)
- Speckle Desktop Services running as background process (`%APPDATA%\Speckle\Desktop Services\Speckle.Desktop.Services.exe`)
- Speckle account with access to target projects

---

## Authentication

### Initial Sign-In

1. Select Get Data > search "Speckle" > Connect
2. Paste model URL and select OK
3. Browser authentication window opens automatically
4. Sign in with Speckle account credentials
5. Power BI caches credentials for future sessions

### Switching Accounts

To switch Speckle accounts on the same server:
1. Close Power BI Desktop completely
2. Navigate to Power BI installation folder
3. Delete `CEF`, `WebView2`, `Cache` folders and `User.zip` file
4. Restart Power BI Desktop

### Troubleshooting Authentication

| Error | Solution |
|-------|----------|
| "Access to resource is forbidden" | Clear "Use my default web browser" in Options > Security > Authentication Browser |
| "Value cannot be null. Parameter name: uriString" | Same fix as above |
| "Cannot connect to Desktop Service" | Clear data source permissions, delete `%APPDATA%/Speckle/Projects/PowerBITokenCache.db`, restart |
| Desktop Service not running | Launch `%APPDATA%\Speckle\Desktop Services\Speckle.Desktop.Services.exe` via Task Manager > Run new task |

---

## Loading Model Data

### Basic Data Loading

1. Copy model URL from the Speckle web app
2. Select Get Data > Speckle > paste URL > OK
3. Power BI imports the model as a tabular dataset
4. Each row represents one Speckle object with its properties

### Version Pinning

- URL without `@` symbol: ALWAYS loads the latest version on every refresh
- URL with `@` symbol (e.g., `https://app.speckle.systems/projects/{id}/models/{id}@{versionId}`): loads ONLY that specific version, ignoring subsequent updates

### Refreshing Data

Select the Refresh button to reload with the latest version (unless version-pinned). For automatic refresh in Power BI Service, configure a Data Gateway.

---

## 3D Viewer Visual

### Setup

1. In the Visualizations pane, select the three dots (`...`)
2. Choose "Import a visual from a file"
3. Navigate to `Documents/Power BI Desktop/Custom Visuals`
4. Select `Speckle 3D Visual.pbiviz`

### Required Column Mappings

| Field | Required | Purpose |
|-------|----------|---------|
| Model Info | YES | Provides 3D geometry for rendering |
| Object IDs | YES | Enables element interactivity (click, hover) |
| Tooltip | No | Accepts any column for hover information display |
| Color by | No | Accepts any column for element coloring |

### Visual Controls

- **Ghost icon**: Controls visibility of unselected elements -- toggled ON shows ghosted (translucent) elements, toggled OFF hides them completely
- **Logo visibility**: Arrow in top bar hides Speckle branding (paid plans only)
- **Element selection**: Click elements to select; selections filter other visuals on the report page
- **Tooltips**: Hover over elements to display mapped column values

### Updating the Visual

To apply a new version of the 3D visual: temporarily replace with a Table visual, then reselect Speckle 3D Visual and remap columns.

---

## Helper Functions

All 7 helper functions are available in Power Query (M language). They are accessed via the formula bar or Advanced Editor.

### Speckle.Projects.Issues

```
Speckle.Projects.Issues(url as text, getReplies as bool) as table
```

Fetches project issues from Speckle. Accepts project, model, or version URLs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | text | YES | Project, model, or version URL |
| `getReplies` | bool | No | When true, extracts issue replies |

Returns table with columns: Id, Title, Description, Status, Priority, Assignee, Due Date, Created, Updated, Labels, Replies, URL.

### Speckle.Objects.Properties

```
Speckle.Objects.Properties(inputRecord as record, optional filterKeys as list) as record
```

Extracts object properties without navigating nested record structures.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputRecord` | record | YES | A single object record from the model table |
| `filterKeys` | list | No | List of property keys to extract (omit for all) |

### Speckle.Objects.CompositeStructure

```
Speckle.Objects.CompositeStructure(inputRecord as record, optional outputAsList as nullable logical) as any
```

Extracts layered material structures from Walls, Floors, and Roofs. Works ONLY with Revit and Archicad data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputRecord` | record | YES | A single object record |
| `outputAsList` | logical | No | When true, returns list format for row expansion; default returns record |

### Speckle.Objects.MaterialQuantities

```
Speckle.Objects.MaterialQuantities(inputRecord as record, optional outputAsList as logical) as any
```

Accesses material quantities (volume, area per material) for a single object.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputRecord` | record | YES | A single object record |
| `outputAsList` | logical | No | When true, returns list format for row expansion |

### Speckle.Models.MaterialQuantities

```
Speckle.Models.MaterialQuantities(inputTable as table, optional addPrefix as logical) as table
```

Expands material quantities across all rows in a table, creating columns per material.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `inputTable` | table | YES | The full model data table |
| `addPrefix` | logical | No | When true, prefixes columns with "MQ." (e.g., "MQ.Concrete", "MQ.area") |

### Speckle.Models.Federate

```
Speckle.Models.Federate(tables as list, optional excludeData as logical) as table
```

Combines multiple model tables into a single federated table for the 3D visual.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tables` | list | YES | List of model tables to combine |
| `excludeData` | logical | No | When true, federates metadata only without full data import |

### Speckle.Utils.ExpandRecord

```
Speckle.Utils.ExpandRecord(table as table, columnName as text, optional FieldNames as list, optional UseCombinedNames as logical) as table
```

Expands record-type columns into separate table columns.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | table | YES | Input table containing the record column |
| `columnName` | text | YES | Name of the record column to expand |
| `FieldNames` | list | No | Specific fields to expand (omit for all) |
| `UseCombinedNames` | logical | No | When true, prefixes expanded columns with source column name |

---

## Data Gateway Configuration

A Data Gateway is required ONLY for scheduled refresh in Power BI Service. Basic connector usage and 3D visualization work without a gateway.

### Personal Mode Gateway

Best for individual users with basic scheduled refresh needs.

1. Download Power BI connector from Speckle connectors page
2. Install "On-premises data gateway (personal mode)" from Microsoft
3. Sign into the gateway application
4. Verify gateway appears in Power BI Service: Settings > Manage connections and gateways
5. Confirm Speckle connector appears in the Connectors tab
6. Publish your report

### Standard Mode Gateway

Best for organizations requiring multi-user access, DirectQuery support, and centralized management.

1. Install the standard "On-premises data gateway"
2. Sign into the gateway
3. Locate Custom Connectors folder (typically `C:\WINDOWS\ServiceProfiles\PBIEgwService\Documents\Power BI Desktop\Custom Connectors`)
4. Download and extract the Power BI connector ZIP
5. Copy `Speckle.pqx` to the Custom Connectors directory
6. Verify Speckle appears under Custom Connectors tab in gateway settings

### Configuring Scheduled Refresh (Both Modes)

1. Open published report in Power BI Service
2. Select More Options (...) > View semantic model
3. Access Refresh > Schedule Refresh
4. Expand "Gateway and cloud connections"
5. Locate your gateway
6. Select Data source credentials > Speckle > Edit credentials
7. Choose OAuth2 authentication method
8. Sign into Speckle account
9. Set privacy level per organizational requirements
10. Configure refresh schedule

### Standard Mode: Manual Gateway Connection

If gateway shows "Not configured correctly":
1. Select "View data sources"
2. Click "Manually add to gateway"
3. Create new connection with model URL
4. Use "Speckle Account" authentication
5. Map connection to semantic model via dropdown
6. Select Apply

### Gateway Troubleshooting

**Error: "Query contains unknown function name: Speckle.GetByUrl"** -- The custom connector is not registered. Publish a dataset with standard connectors (CSV, Excel) first, set its data source credentials, then retry the Speckle report. The system requires a verified connector dataset before custom connectors function.

---

## Federation and Multi-Model Analytics

### Web App Federation

1. Create a federated model in the Speckle web app (combines multiple models)
2. Copy the federated model URL
3. Load into Power BI using the standard connector workflow

### Manual Federation via Helper Function

```
let
    Model1 = Speckle.GetByUrl("https://app.speckle.systems/projects/.../models/..."),
    Model2 = Speckle.GetByUrl("https://app.speckle.systems/projects/.../models/..."),
    Federated = Speckle.Models.Federate({Model1, Model2})
in
    Federated
```

Use `excludeData = true` to federate metadata only (faster loading for large models).

### Analytics Use Cases

| Use Case | Functions Used | Description |
|----------|---------------|-------------|
| Material takeoff | `Speckle.Models.MaterialQuantities` | Expand material volumes/areas across all elements |
| Wall layer analysis | `Speckle.Objects.CompositeStructure` | Break down composite wall/floor/roof layers |
| Property extraction | `Speckle.Objects.Properties` | Flatten nested properties for filtering and aggregation |
| Multi-discipline dashboard | `Speckle.Models.Federate` | Combine structural, architectural, MEP models |
| Issue tracking | `Speckle.Projects.Issues` | Visualize project issues with 3D context |
| Cross-model comparison | Multiple `Speckle.GetByUrl` calls | Compare versions or design options side by side |

---

## Sharing and Publishing

### Direct File Sharing

Share `.pbix` files directly. Recipients can view reports and 3D visualizations but may face limitations editing queries or refreshing data without proper Speckle credentials.

### Power BI Service Publishing

Publish to Power BI Service for web access. Other users access reports via the online platform. Scheduled refresh requires Data Gateway configuration (see above).

### Permission Requirements

- Viewing data requires Speckle project access
- Private projects require authenticated credentials
- "Permission denied" errors indicate the Speckle account lacks project access

---

## Reference Links

- [references/methods.md](references/methods.md) -- Complete helper function signatures and parameters
- [references/examples.md](references/examples.md) -- Working Power Query examples for common analytics workflows
- [references/anti-patterns.md](references/anti-patterns.md) -- Common mistakes and how to avoid them

### Official Sources

- https://docs.speckle.systems/connectors/power-bi/power-bi.md
- https://docs.speckle.systems/connectors/power-bi/gateway.md
- https://docs.speckle.systems/connectors/manual-installation/powerbi.md
