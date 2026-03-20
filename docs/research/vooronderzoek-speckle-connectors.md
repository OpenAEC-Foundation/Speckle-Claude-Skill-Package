# Vooronderzoek: Speckle Connectors

> Status: RAW — not yet processed into core files
> Date: 2026-03-20
> Sources: See "Sources Consulted" section at bottom

---

## 1. Connector Architecture Overview

### What Connectors Do

Speckle connectors are plugins installed inside host applications (Revit, Rhino, Blender, etc.) that bridge the gap between the host application's native data model and Speckle's universal data schema. Every connector performs two core operations:

1. **Publish (ToSpeckle)**: Converts native application objects into Speckle's DataObject/Geometry format and sends them to a Speckle server.
2. **Load (ToHost)**: Receives Speckle objects from a server and converts them back into the host application's native format — or, when native reconstruction is impossible, into generic representations (e.g., Direct Shapes in Revit, GDL Objects in Archicad).

### DUI3 — Desktop User Interface 3

All current connectors share a common UI layer called DUI3. This provides a consistent user experience across all host applications: project/model selection, publish/load controls, version history, and account management. DUI3 communicates with the Speckle Desktop Service for authentication token management.

### Conversion Pipeline

The conversion pipeline follows a strict separation of concerns:

1. **Selection**: User selects objects in the host application (manual, view-based, category-based, or all visible).
2. **Conversion (ToSpeckle)**: Each native object is converted to a Speckle Base Object. Geometry goes into `displayValue` as interoperable primitives (Mesh, Line, Point). Semantic properties go into `properties`. Shared resources (materials, levels, groups) become Proxies at the root level.
3. **Transport**: Serialized objects are sent to the configured Speckle server via the transport layer.
4. **Receive**: On the loading side, objects are fetched from the server.
5. **Conversion (ToHost)**: Each Speckle object is converted back to the host application's format. The converter attempts native reconstruction where possible, falls back to generic geometry otherwise.

### Object Types in the Schema

Every connector produces objects that fit into three categories:

- **Geometry Objects**: Pure geometric primitives (Point, Line, Mesh, Brep, Arc, Polyline). These lack `properties` and `displayValue` fields. Used primarily in CAD workflows (Rhino, AutoCAD).
- **DataObject**: Semantic BIM elements that combine `properties` (metadata dictionaries) with `displayValue` (geometry arrays). Extended by connector-specific types: RevitObject, ArchicadObject, Civil3dObject, TeklaObject, etc.
- **Instance Objects**: References to Definition proxies via `definitionId`, with a 4x4 `transform` matrix for placement. Represent block instances, component instances, and repeated geometry.

### Proxy Architecture

Proxies are relationship containers stored at the Root Collection level. They link objects to shared resources without duplicating data. All proxies share a common structure:

- `speckle_type`: Proxy category identifier
- `applicationId`: Stable identifier for cross-version tracking
- `name`: Human-readable label
- `value`: The actual resource data
- `objects`: Array of `applicationId` strings referencing objects that use this proxy

The five proxy types are:

1. **RenderMaterial**: Color (RGB), opacity, metallic, roughness. A single proxy can reference hundreds of objects.
2. **Level**: Elevation data and level name. Used by BIM connectors (Revit, Archicad) to encode floor associations.
3. **Group**: Functional grouping independent of spatial hierarchy. Objects can belong to multiple groups simultaneously.
4. **Definition**: Stores block/component geometry once for reuse by multiple Instance objects. Contains `displayValue` with mesh/geometry.
5. **Color**: Simple hex color assignments (#RRGGBB). Primarily used by CAD connectors (AutoCAD, Civil 3D).

Critical invariant: Proxies reference objects by `applicationId` (stable across versions), NEVER by `id` (content-based hash that changes when data updates). Proxies do NOT reference other proxies — no circular references are permitted.

### Identity System

- **`id`**: Content-based hash. Objects with identical content share the same `id`. Enables deduplication.
- **`applicationId`**: Source application identifier (Revit ElementId, Rhino GUID, AutoCAD Handle). Enables cross-version tracking and proxy references.
- **`speckle_type`**: Type discriminator string (e.g., `"Objects.Data.DataObject:Objects.Data.RevitObject"`).

### Units

Every object carries a `units` field specifying its measurement system. Supported values include `"m"`, `"mm"`, `"ft"`, `"in"`, and others. Unit conversion happens automatically during the conversion pipeline.

---

## 2. Revit Connector

### Supported Versions
Revit 2022, 2023, 2024, 2025, 2026. Windows only.

### Data Schema Hierarchy
File > Level > Category > Type > RevitObject

RevitObject extends DataObject with connector-specific attributes:
- `type`: Element type name (e.g., "Basic Wall - 200mm")
- `family`: Family classification
- `category`: Revit category (Walls, Doors, Windows, etc.)
- `level`: Associated building level
- `location`: Point or Curve geometry for element position
- `referencePointTransform`: 4x4 transformation matrix based on reference point settings during publication
- `views`: Camera objects for saved 3D perspective views

### Publishing Modes
- **Manual selection**: Select specific elements in the viewport
- **View-based publishing**: Filter and publish from specific Revit views
- **Category-based publishing**: Selective publishing by element category
- All visible elements in the Model category (walls, floors, beams, columns) plus visible gridlines from the Annotation category

### Publishing Settings
- **Include linked models**: Toggle on by default; linked models appear as separate File collections
- **Reference point coordination**: Publish relative to Internal Origin (default), Project Base, or Survey Point
- **Rebar handling**: "Send Rebars As Volumetric" toggle exports rebars as solids instead of curves (warning: significant performance impact)
- **3D perspective views**: Automatically included. Only 3D perspective views are published — NO plans, sections, elevations, or orthographic 3D views.

### Property Capture on Publish
- Element ID, category, workset
- Instance parameters, Type parameters
- Material quantities (volume, area per material)
- Structural material properties (density, compressive strength)

### Receiving (Loading) Behavior
Objects load as **Direct Shapes** (generic models) with a default category. This is ALWAYS the behavior — Speckle does NOT create native Revit elements (walls, doors, etc.) on load.

Advanced loading options:
- **Blocks as Families**: "Receive Blocks as Families" toggle for block instance handling
- **Reference point alignment**: Configure via source, Internal Origin, Project Base, or Survey Point
- **3D view creation**: Views automatically created as 3D views in Revit
- **Material handling**: Existing materials with matching names are reused; direct shapes allow material editing

### Known Limitations
- **No custom property import on receive**: "Currently, you can not load any custom properties on your Speckle model objects into Revit."
- Object categories cannot be modified after loading
- No plans, sections, elevations, or orthographic 3D views
- Material editing only works for direct shapes and family-based blocks
- No nested RevitObjects — geometry exclusively in `displayValue`
- The `type` field is the element type name, NOT the Revit TypeId

### Proxy Types Used
RenderMaterial, Level, Group

---

## 3. Rhino Connector

### Supported Versions
Rhino 7 and 8. Windows only. Rhino 8.9+ recommended for early 8.x framework issues.

### Data Schema Hierarchy
File > Layer > Sublayer > Objects

### Object Types
- **Geometry Objects**: Point, Line, Mesh, Brep — standalone in collections
- **Instance Objects**: Block references via `definitionId` + transform matrix
- **DataObject**: Objects with attached user data (less common)

### Publishing Features
- All types of visible geometry, hatches, text objects, blocks
- Each object includes: name, color, render material, user strings (custom properties)
- **Layer filtering**: Selective publish by layer via filter field
- **Named views**: All perspective views automatically published (parallel projections excluded)
- **Visualization properties**: Optional setting to include vertex normals, colors, texture coordinates (increases file size)

### Loading Features
- Objects load as geometry, text, or blocks
- Render materials, colors, names preserved
- Custom properties load as user strings
- Named views created automatically (will not overwrite existing views)

### Proxy Types Used
RenderMaterial, Color, Group, Definition

### Bundle Note
Rhino and Grasshopper connectors are bundled — installing either covers both.

---

## 4. Grasshopper Connector

### Supported Versions
Grasshopper in Rhino 7 and 8. Windows only. Bundled with Rhino connector.

### Component Inventory

**Authentication and Configuration:**
- **Sign-In**: Account authentication
- **Speckle Model URL**: Project/model selection; supports account switching via right-click

**Publishing Workflow:**
- **Create Collection**: Organizes objects into hierarchical collections (maps to Rhino layers). Supports nested sub-collections, auto-naming via TAB+pipe, empty inputs excluded.
- **Publish**: Sends Collection + Model URL to server
- **Create Properties**: Creates key-value property dictionaries. Supports strings, numbers, booleans, vectors, planes, lists, nested properties.
- **Speckle Properties Passthrough**: Alternative property creation with three modes — Merge (default), Remove, Replace

**Loading Workflow:**
- **Load**: Fetches model from server (latest version by default, or specific version)
- **Query Objects**: Retrieves flattened lists of all objects; expandable outputs filter by geometry type
- **Collection Selector**: Displays full sub-collection paths with search patterns (?, <, >, ;)
- **Expand Collection**: Traverses hierarchy one level at a time
- **Deconstruct**: Accesses individual object fields

**Object Manipulation:**
- **Speckle Geometry Passthrough**: Accepts native geometry or existing Speckle Geometry; adds Name, Properties, Color, Material
- **Block Definition Passthrough**: Creates block definitions from geometry list
- **Block Instance Passthrough**: Creates instances from definitions + transform
- **Data Object Passthrough**: Creates Data Objects from geometry list + properties
- **Filter Objects**: Filters by name, property keys, material name, Application ID, or Speckle ID

### Three Object Types in Grasshopper

1. **Geometry Objects**: Single selectable elements. Cast native Grasshopper geometry directly. Baking preserves path, name, color, material, properties as user strings.
2. **Block Objects**: Definitions (geometry collections) + Instances (definition + transform). Mirror native Rhino block structure.
3. **Data Objects**: Groups of geometries with rich properties. Used for BIM/structural/civil workflows from Revit, Navisworks, IFC, Archicad, Civil 3D, Tekla, ETABS. Cast to single geometry only if containing exactly one piece of geometry.

### Key Limitation
Grasshopper CANNOT create native BIM elements (Revit walls, beams, etc.). It can only create Geometry Objects, Block Objects, and Data Objects. When loaded in Revit, these always become Direct Shapes.

### Change Tracking Problem
Grasshopper parameters lack persistent GUIDs — new GUIDs generate on each solve, disrupting change tracking. Solutions:
- Use passthrough nodes to mutate existing loaded objects (preserves application IDs)
- For new models: create objects once, publish, reload, then use passthrough nodes for mutations

### Reusable Components
Teams can create standardized User Objects (`.ghuser` files) with predefined naming conventions and property structures for consistent project delivery.

---

## 5. Blender Connector

### Supported Versions
Blender 4.2, 4.3, 4.4, 4.5, 5.0. Windows and macOS only. NO Linux support.

### Supported Geometry Types
- Mesh objects
- Bezier curves, circles
- NURBS curves, NURBS circles

### NOT Supported
- Cameras
- Lights
- Textures ("Speckle currently does not support textures")

### Shader Support
The connector recognizes exactly four shader types:
1. Principled
2. Diffuse
3. Emission
4. Glass

For any other shader type, the system reverts to basic material attributes.

### Publishing Features
- "Apply Modifiers" setting to publish objects with modifiers applied
- Objects published with collection hierarchy

### Loading Features
- Block loading offers two modes: **collection instances** (default) or **linked duplicates**
- Material modifications persist across version updates
- Latest version loaded by default; specific versions selectable

### Known Limitations
- No camera or light support
- No texture support
- No custom properties on receive: "properties are not loaded and attached to loaded objects"
- No Linux support
- Only 4 shader types recognized

---

## 6. AutoCAD Connector

### Supported Versions
AutoCAD 2022, 2023, 2024, 2025, 2026. Windows only.

### Data Schema Hierarchy
File > Layer > Objects

### Publishable Content
- All geometry types
- Hatch objects, text objects, blocks
- Color, render materials
- Extended Data (XData) and Extension Dictionaries

### Critical Behavior
**Solids are ALWAYS published as Mesh geometry** — solid-to-mesh conversion is automatic and irreversible in the Speckle pipeline.

### Custom Properties
Extension dictionaries and extended data appear in the `properties` field. The `applicationId` maps to the AutoCAD Handle.

### Loading Behavior
- All objects load as geometry, text, or blocks
- Flattened layer structure matching browser viewer display
- Render materials and colors preserved
- Objects loaded into their own Selection Set for easy selection

### Proxy Types Used
RenderMaterial, Color, Group, Definition

---

## 7. Civil 3D Connector

### Supported Versions
Civil 3D 2022, 2023, 2024, 2025, 2026. Windows only.

### Data Schema Hierarchy
File > Layer > Objects (inherits AutoCAD structure)

### Extends AutoCAD Support
All AutoCAD geometry, hatch, text, and block types are supported, plus Civil 3D-specific entities.

### Civil3dObject
Extends DataObject with:
- `type`: Entity type designation
- `baseCurves`: Array of curve geometry objects representing the fundamental curve of the Civil 3D entity (distinct from `displayValue` which is the visual representation)
- Custom properties including property sets, part data, class-dependent properties

### Custom Properties Captured
- Extension dictionaries
- XData
- Property Sets (organized by name, e.g., "Pipe Properties")
- Part Data with entity-specific information
- Network part specifications
- Catchment hydrological and hydraulic properties
- Surface statistics
- Corridor featurelines and codes

### Additional Proxy Type
**PropertySetDefinition**: Encodes Civil 3D property set structures (in addition to RenderMaterial, Color, Group, Definition).

### Known Limitations
- **No reference point publishing**: No coordinate system alignment option
- Solids convert to mesh format only
- Color display depends on viewer settings (requires Shaded view mode)

---

## 8. Tekla Structures Connector

### Supported Versions
Tekla Structures 2023, 2024, 2025. Windows only.

### PUBLISH-ONLY
The Tekla connector is **publish-only**. There is NO receive/load functionality. Users wanting to load models into Tekla must request this feature via the Community Forum.

### Data Schema Hierarchy
Root Collection > Tekla File > Type > TeklaObject

### TeklaObject
Extends DataObject with:
- `type`: Element category (Beam, Column, Plate, etc.)
- `displayValue`: Geometry array (typically Brep format)
- `properties.Report`: Aggregated Tekla-native data including profile designation, material specification, physical dimensions, weight, part/assembly numbers, coordinates

### Publishable Objects
All selectable model objects: beams, plates, bolts, and other structural elements.

### Properties NOT Published
- Assemblies
- Drawing layouts and title blocks
- Numbering series and sequence settings

### Known Limitations
- Publish-only — no receive/load
- Cannot publish from drawing views — model viewport only
- No nested TeklaObjects
- All metadata confined to `properties.Report`

### Proxy Types Used
RenderMaterial only.

---

## 9. Archicad Connector

### Supported Versions
Archicad 27, 28, 29. Windows only.

### Data Schema Hierarchy
Root Collection > ArchiCAD File > Floor > Type > ArchicadObject

### ArchicadObject
Extends DataObject with:
- `type`: Element category name
- `level`: Floor/level association
- `location`: Point or Curve geometry for placement

### Publishable Elements
- Wall, Slab, Beam, Column
- Door, Window, Curtain Wall, Skylight, Object
- Roof, Shell, Morph, Mesh
- Stair, Railing

### Properties Captured
- Element ID, type, name, level
- Classifications (IFC Type and Category)
- Dimensional properties (volume, area)
- Material quantities
- User-defined properties
- IFC properties (e.g., Pset_WallCommon with IsExternal, LoadBearing)

### Publishing Options
- Optional property extraction toggle (disable for faster publishing)
- Filter by Archicad views or element types

### Loading Behavior
- All objects load as **GDL Objects** (generic models)
- Block instances load as individual generic models
- Objects include render materials and mesh geometry
- Organized into embedded library folders named "Project Name - Model Name"
- Floor plan views show only cut lines at the floor plan cut plane — NO projection lines

### Known Limitations
- No custom property loading into Archicad
- Incorrect model positioning when loading from Revit (reference point dependent)
- No 2D documentation (floor plans, sections, elevations)
- No 2D elements (lines, hatches, dimensions)
- No surface textures
- Some dimensional properties not published
- UI may be blank when floating; docking resolves

### Proxy Types Used
RenderMaterial

---

## 10. SketchUp Connector

### Supported Versions
SketchUp 2021, 2022, 2023, 2024, 2025, 2026. Windows and macOS.

### Publishing
- Components, groups, faces, lines
- Custom user attributes and render materials preserved

### Loading
- Models load as components with matching layer structure
- Object names become component names
- Render materials and properties preserved
- Properties from other applications (e.g., Revit parameters) import as user attributes

### Known Limitations
- Material application issues when materials applied to components instead of faces — ALWAYS apply materials to faces for correct cross-application display
- User attributes require third-party "Attribute Helper" plugin to view in SketchUp

---

## 11. Power BI Connector

### Nature
Power BI is a visualization/analytics connector — fundamentally different from the modeling connectors above. It is read-only: it loads Speckle data for analysis and 3D visualization but does NOT publish data back.

### Two Components
1. **Power BI Connector**: Loads 3D models as tabular data into Power BI
2. **3D Viewer Visual**: Displays and colors models in three dimensions within Power BI reports

### Helper Functions (Speckle Namespace)
- `Speckle.Projects.Issues`: Fetch issues from project/model/version
- `Speckle.Objects.Properties`: Extract object properties without navigating nested structures
- `Speckle.Objects.CompositeStructure`: Extract layered structures (Revit/Archicad only)
- `Speckle.Objects.MaterialQuantities`: Access material quantities
- `Speckle.Models.MaterialQuantities`: Expand material quantities across table columns
- `Speckle.Models.Federate`: Manually federate multiple loaded models
- `Speckle.Utils.ExpandRecord`: Expand record columns into separate fields

### Data Gateway
Required ONLY for scheduled refresh in Power BI Service. Basic connector usage and 3D visualization work without a gateway.

### Authentication
Browser-based sign-in. Power BI caches credentials. Third-party data source approval required (IT administrators can add thumbprint `CDC489B709A709E3283568A9B75D75180B1355BE` to Windows registry).

### Features
- Private project support
- Federated models (multiple models visualized together)
- Interactive tooltips and element selection
- Ghost icon for controlling unselected element visibility
- Shareable via .pbix files or Power BI web publishing

---

## 12. Data Federation and Cross-Tool Exchange

### Federated Views
Speckle's core value proposition is assembling models from multiple tools into a single federated view. An architect's Revit model, a structural engineer's Tekla model, and a landscape designer's Rhino model can all be loaded into a single Speckle project and visualized together.

### applicationId Stability
The `applicationId` field is the key to cross-version tracking. When a Revit wall is modified and republished, its `applicationId` (Revit ElementId) remains stable, allowing Speckle to track changes across versions. The content-based `id` will change (because the data changed), but the `applicationId` persists.

### Asymmetric Fidelity
Publishing preserves MORE information than loading. A Revit wall published to Speckle retains all parameters, material quantities, and type information. When loaded into Rhino, it becomes geometry with properties as user strings — the native Revit "wall-ness" is lost. When loaded back into Revit, it becomes a Direct Shape, not a native wall. This asymmetry is fundamental and by design.

### Geometry Baking for Interoperability
All connectors use "minimum viable interoperable primitives" (Meshes, Lines, Points) in `displayValue`. This ensures ANY receiver can display the geometry, even if it cannot reconstruct native elements. Brep data may be preserved for connectors that support it (Rhino), but Mesh is the universal fallback.

### Common Workflows
- **Revit to Grasshopper to Revit**: Publish from Revit, load in Grasshopper for parametric analysis/modification, publish back. On return to Revit, objects become Direct Shapes.
- **Multi-discipline coordination**: Multiple teams publish to the same Speckle project from different tools. Federated view in the web viewer or Power BI shows all models together.
- **Design option comparison**: Publish multiple versions from different design tools, compare in the viewer.

### Collections Preserve Source Hierarchy
Each connector preserves its native organizational structure within Collections:
- Revit: File > Level > Category > Type
- Rhino: File > Layer > Sublayer
- AutoCAD/Civil 3D: File > Layer
- Archicad: File > Floor > Type
- Tekla: File > Type

This means consumers of federated data can navigate using the source application's familiar hierarchy.

---

## 13. Connector Feature Matrix

| Connector | Versions | OS | Publish | Load | Native on Load | Schema Type |
|-----------|----------|-----|---------|------|-----------------|-------------|
| Revit | 2022-2026 | Win | Yes | Yes | Direct Shapes | RevitObject |
| Rhino | 7, 8 | Win | Yes | Yes | Geometry | Geometry/Instance |
| Grasshopper | (with Rhino) | Win | Yes | Yes | Geometry | Geometry/Block/Data |
| Blender | 4.2-5.0 | Win/Mac | Yes | Yes | Mesh/Curves | Geometry |
| AutoCAD | 2022-2026 | Win | Yes | Yes | Geometry | Geometry/Instance |
| Civil 3D | 2022-2026 | Win | Yes | Yes | Geometry | Civil3dObject |
| Tekla | 2023-2025 | Win | Yes | **No** | N/A | TeklaObject |
| Archicad | 27-29 | Win | Yes | Yes | GDL Objects | ArchicadObject |
| SketchUp | 2021-2026 | Win/Mac | Yes | Yes | Components | Geometry |
| Power BI | N/A | Win | **No** | Yes (read) | Tabular + 3D | N/A |

---

## Anti-Patterns and Common Mistakes

### AP-1: Expecting Native Element Recreation on Load
The most common misconception. When loading a Revit model into Revit from Speckle, users expect native walls, doors, and floors. Speckle ALWAYS creates Direct Shapes in Revit, GDL Objects in Archicad. There is no native element recreation. Plan workflows accordingly.

### AP-2: Publishing Custom Properties and Expecting Them on Receive
Multiple connectors (Revit, Blender, Archicad) explicitly do NOT load custom properties back onto received objects. Properties are preserved in Speckle's data model and visible in the web viewer, but the host application may not attach them. ALWAYS verify property round-trip behavior for your specific connector pair.

### AP-3: Assuming Bidirectional Capability for All Connectors
Tekla is publish-only. Power BI is load-only (read-only visualization). NEVER assume a connector supports both publish and load without checking.

### AP-4: Publishing Non-Perspective Views from Revit
Revit ONLY publishes 3D perspective views. Plans, sections, elevations, and orthographic 3D views are silently excluded. Do NOT rely on Speckle for 2D documentation exchange from Revit.

### AP-5: Using Unsupported Shader Types in Blender
Blender recognizes exactly four shader types: Principled, Diffuse, Emission, Glass. Using any other shader results in fallback to basic material attributes. ALWAYS use one of the four supported shaders for predictable material transfer.

### AP-6: Ignoring the Solids-to-Mesh Conversion in AutoCAD/Civil 3D
Solids are ALWAYS published as Mesh geometry. This is irreversible. If downstream workflows require solid geometry, this connector pipeline is not suitable.

### AP-7: Publishing from Tekla Drawing Views
Tekla can only publish from the model viewport. Attempting to publish from drawing views will fail. ALWAYS ensure you are in the model viewport before publishing.

### AP-8: Applying Materials to Components Instead of Faces in SketchUp
Materials applied at the component level in SketchUp may not display correctly in other applications. ALWAYS apply materials to faces, not components, for cross-application fidelity.

### AP-9: Grasshopper Change Tracking Failure
Grasshopper parameters generate new GUIDs on each solve, breaking change tracking. ALWAYS use passthrough nodes to mutate existing objects rather than creating new ones each solve cycle.

### AP-10: Expecting Linux Support for Blender
Blender connector supports Windows and macOS only. There is NO Linux support despite Blender itself running on Linux.

### AP-11: Neglecting Reference Point Configuration in Revit
Objects may appear in incorrect positions if reference points are not aligned between publish and load operations. ALWAYS verify that the reference point setting (Internal Origin, Project Base, Survey Point) is consistent across your workflow.

### AP-12: Expecting Texture Support
Speckle does NOT support textures across any connector. Only material properties (color, opacity, metallic, roughness) transfer. Do NOT rely on texture UV mapping surviving the Speckle pipeline.

### AP-13: Assuming DataObject Nesting
DataObjects (RevitObject, ArchicadObject, TeklaObject, etc.) generally cannot contain other DataObjects as direct children. Geometry is exclusively in `displayValue`. Exceptions exist (Revit curtain walls, IFC data with `elements` property) but should not be assumed.

---

## Open Questions for Skills

1. **ETABS and Navisworks connectors**: These are mentioned in the connector index and have schema documentation but lack user-facing connector documentation pages. Are they actively maintained? What are their exact capabilities and limitations?

2. **IFC connector**: Listed in the connector index with its own schema. Is this a standalone connector or built into other connectors? How does IFC import/export work in the Speckle ecosystem?

3. **Coordinate system handling across connectors**: The Revit connector has explicit reference point settings. How do other connectors handle coordinate system alignment in federated models?

4. **speckle-sharp-connectors repo**: The task scope mentions this repository. How is the codebase organized? What is the relationship between the C# connectors and the converter architecture?

5. **Performance characteristics**: What are the practical size limits for publishing/loading? How do large models (100k+ elements) perform?

6. **Version update cadence**: How frequently do connector versions update? Is there a compatibility matrix between connector versions and server versions?

7. **Webhook integration with connectors**: Can connectors trigger webhooks on publish? How does this integrate with the Automate platform?

8. **Custom converter development**: Can users extend the conversion pipeline with custom object types? What is the extension mechanism?

9. **Parallel projections in Rhino/Grasshopper**: Named views only support perspective views. Is there a workaround for orthographic views?

10. **Block loading behavior differences**: Blender offers collection instances vs. linked duplicates. How do other connectors handle block/component loading? What are the tradeoffs?

---

## Sources Consulted

| Source | URL | Accessed |
|--------|-----|----------|
| Speckle Docs — LLMs Index | https://docs.speckle.systems/llms.txt | 2026-03-20 |
| Data Schema Overview | https://docs.speckle.systems/developers/data-schema/overview.md | 2026-03-20 |
| Data Schema Concepts | https://docs.speckle.systems/developers/data-schema/concepts.md | 2026-03-20 |
| Object Schema | https://docs.speckle.systems/developers/data-schema/object-schema.md | 2026-03-20 |
| Proxy Schema | https://docs.speckle.systems/developers/data-schema/proxy-schema.md | 2026-03-20 |
| Connector Index | https://docs.speckle.systems/developers/data-schema/connector-index.md | 2026-03-20 |
| Revit Schema | https://docs.speckle.systems/developers/data-schema/connectors/revit-schema.md | 2026-03-20 |
| Rhino Schema | https://docs.speckle.systems/developers/data-schema/connectors/rhino-schema.md | 2026-03-20 |
| AutoCAD Schema | https://docs.speckle.systems/developers/data-schema/connectors/autocad-schema.md | 2026-03-20 |
| Civil 3D Schema | https://docs.speckle.systems/developers/data-schema/connectors/civil3d-schema.md | 2026-03-20 |
| Tekla Schema | https://docs.speckle.systems/developers/data-schema/connectors/tekla-schema.md | 2026-03-20 |
| Archicad Schema | https://docs.speckle.systems/developers/data-schema/connectors/archicad-schema.md | 2026-03-20 |
| Revit Connector (User) | https://docs.speckle.systems/connectors/revit/revit.md | 2026-03-20 |
| Rhino Connector (User) | https://docs.speckle.systems/connectors/rhino/rhino.md | 2026-03-20 |
| Grasshopper Connector (User) | https://docs.speckle.systems/connectors/grasshopper/grasshopper.md | 2026-03-20 |
| Grasshopper Objects | https://docs.speckle.systems/connectors/grasshopper/grasshopper-objects.md | 2026-03-20 |
| Grasshopper Collections | https://docs.speckle.systems/connectors/grasshopper/grasshopper-collections.md | 2026-03-20 |
| Grasshopper Properties | https://docs.speckle.systems/connectors/grasshopper/grasshopper-properties.md | 2026-03-20 |
| Grasshopper Recommendations | https://docs.speckle.systems/connectors/grasshopper/grasshopper-recommendations.md | 2026-03-20 |
| Blender Connector (User) | https://docs.speckle.systems/connectors/blender.md | 2026-03-20 |
| AutoCAD Connector (User) | https://docs.speckle.systems/connectors/autocad.md | 2026-03-20 |
| Civil 3D Connector (User) | https://docs.speckle.systems/connectors/civil3d.md | 2026-03-20 |
| Tekla Connector (User) | https://docs.speckle.systems/connectors/tekla.md | 2026-03-20 |
| SketchUp Connector (User) | https://docs.speckle.systems/connectors/sketchup.md | 2026-03-20 |
| Archicad Connector (User) | https://docs.speckle.systems/connectors/archicad.md | 2026-03-20 |
| Power BI Connector (User) | https://docs.speckle.systems/connectors/power-bi/power-bi.md | 2026-03-20 |
