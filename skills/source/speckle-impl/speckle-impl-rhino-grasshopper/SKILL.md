---
name: speckle-impl-rhino-grasshopper
description: >
  Use when sending geometry from Rhino or Grasshopper to Speckle, or receiving Speckle data into Rhino.
  Prevents missing user strings on receive, broken block handling, and attempting to create native BIM objects from Grasshopper (which is impossible).
  Covers Rhino 7/8 connector (geometry, hatches, text, blocks, user strings, named views, layers), Grasshopper 15+ components (Sign-In, Publish, Load, Query, Filter, Create Collection/Properties/Data Object), 3 object types, and block handling.
  Keywords: speckle rhino, grasshopper, rhino connector, GH component, block, user strings, layers, publish, load, query, filter, send from Rhino, Grasshopper to Speckle.
license: MIT
compatibility: "Designed for Claude Code. Requires Rhino 7/8 (Windows), Speckle Connector for Rhino (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-rhino-grasshopper

## Quick Reference

### Platform Requirements

| Requirement | Value |
|-------------|-------|
| Rhino versions | 7, 8 (8.9+ recommended) |
| OS | Windows only |
| Connector bundle | Rhino + Grasshopper (single installer) |
| Authentication | Via Speckle Desktop Service |

### Rhino Data Schema

```
File > Layer > Sublayer > Objects
```

### Object Types in Rhino

| Type | Description | Speckle Mapping |
|------|-------------|-----------------|
| Geometry Objects | Point, Line, Mesh, Brep — standalone primitives | Geometry Objects (no `properties`, no `displayValue`) |
| Block Instances | References to block definitions with transform | Instance Objects (`definitionId` + 4x4 `transform`) |
| Data Objects | Objects with attached user data | DataObject (`properties` + `displayValue`) |

### Proxy Types Used by Rhino

| Proxy | Purpose |
|-------|---------|
| RenderMaterial | Color (RGB), opacity, metallic, roughness |
| Color | Hex color assignments (#RRGGBB) |
| Group | Functional grouping of objects |
| Definition | Block geometry stored once, reused by instances |

### Critical Warnings

**NEVER** attempt to create native BIM elements (Revit walls, beams, columns) from Grasshopper. Grasshopper can ONLY create Geometry Objects, Block Objects, and Data Objects. When loaded into Revit, these ALWAYS become Direct Shapes.

**NEVER** expect parallel projection views to publish. Rhino and Grasshopper ONLY publish perspective named views. Parallel projections are silently excluded.

**NEVER** rely on Grasshopper parameter GUIDs for change tracking. Grasshopper generates new GUIDs on every solve cycle, breaking Speckle's change tracking. ALWAYS use passthrough nodes to mutate existing loaded objects.

**ALWAYS** use Rhino 8.9+ when working with Rhino 8. Earlier 8.x versions have known framework issues with the Speckle connector.

---

## Rhino Connector

### Publishing from Rhino

The Rhino connector publishes the following content:

| Content Type | Details |
|--------------|---------|
| Geometry | All visible geometry types (Point, Line, Curve, Mesh, Brep, Surface, Extrusion) |
| Hatches | Pattern fills |
| Text | Text objects and annotations |
| Blocks | Block definitions and instances |
| User strings | Custom key-value properties attached to objects |
| Named views | Perspective views only (parallel projections excluded) |
| Layers | Full layer hierarchy preserved as Collections |

Each published object includes: name, color, render material, and user strings.

### Publishing Settings

| Setting | Effect |
|---------|--------|
| Layer filter | Publish only objects on selected layers |
| Visualization properties | Include vertex normals, colors, texture coordinates (increases file size) |

### Loading into Rhino

| Data | Behavior |
|------|----------|
| Geometry | Loads as native Rhino geometry (Point, Curve, Mesh, Brep) |
| Text | Loads as text objects |
| Blocks | Loads as block definitions + instances |
| Render materials | Preserved and applied |
| Colors | Preserved and applied |
| Names | Preserved as object names |
| Custom properties | Loaded as user strings |
| Named views | Created automatically (NEVER overwrites existing views with same name) |

### User Strings Round-Trip

User strings are the mechanism for custom property transfer in Rhino:

1. **Publish**: User strings attached to Rhino objects appear in `properties` on the Speckle server.
2. **Load**: Properties from Speckle objects are written back as user strings on received Rhino geometry.

This round-trip works for Rhino-to-Rhino workflows. Properties from other connectors (Revit parameters, Tekla report data) also load as user strings in Rhino.

---

## Grasshopper Connector

### Component Inventory

#### Authentication and Configuration

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Sign-In** | Account authentication | Required before any publish/load |
| **Speckle Model URL** | Project/model selection | Right-click to switch accounts |

#### Publishing Workflow

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Create Collection** | Organize objects into hierarchical collections | Maps to Rhino layers. Supports nesting via TAB+pipe. Empty inputs excluded automatically. |
| **Publish** | Send Collection + Model URL to server | Requires a Collection and a Model URL input |
| **Create Properties** | Create key-value property dictionaries | Supports: strings, numbers, booleans, vectors, planes, lists, nested properties |
| **Speckle Properties Passthrough** | Alternative property creation | Three modes: Merge (default), Remove, Replace |

#### Loading Workflow

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Load** | Fetch model from server | Latest version by default, or specific version |
| **Query Objects** | Retrieve flattened list of all objects | Expandable outputs filter by geometry type |
| **Collection Selector** | Display full sub-collection paths | Search patterns: `?` (single char), `<` (starts with), `>` (ends with), `;` (multiple patterns) |
| **Expand Collection** | Traverse hierarchy one level at a time | Use iteratively for deep hierarchies |
| **Deconstruct** | Access individual object fields | Returns field names, values, and types |

#### Object Manipulation

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Speckle Geometry Passthrough** | Add metadata to geometry | Accepts native GH geometry or existing Speckle Geometry. Adds: Name, Properties, Color, Material |
| **Block Definition Passthrough** | Create block definitions | Input: geometry list. Output: reusable definition |
| **Block Instance Passthrough** | Create block instances | Input: definition + transform matrix |
| **Data Object Passthrough** | Create Data Objects | Input: geometry list + properties dictionary |
| **Filter Objects** | Filter loaded objects | Filter by: name, property keys, material name, Application ID, Speckle ID |

### Three Object Types in Grasshopper

#### 1. Geometry Objects

- Single selectable elements
- Cast native Grasshopper geometry directly (Point, Curve, Mesh, Brep, Surface)
- Baking preserves: layer path, name, color, material, properties as user strings
- Use **Speckle Geometry Passthrough** to attach metadata

#### 2. Block Objects

- **Definitions**: Geometry collections created via Block Definition Passthrough
- **Instances**: Placement references created via Block Instance Passthrough (definition + transform)
- Mirror native Rhino block structure
- ALWAYS create the definition first, then create instances that reference it

#### 3. Data Objects

- Groups of geometries with rich property dictionaries
- Used for BIM/structural/civil workflows received from Revit, Navisworks, IFC, Archicad, Civil 3D, Tekla, ETABS
- Cast to single geometry ONLY when containing exactly one piece of geometry
- NEVER cast a Data Object with multiple geometries to a single geometry — this silently drops geometry

### Collection Nesting

Create nested collections using TAB+pipe naming:

```
Collection "Architecture"
  ├── Sub-collection "Walls"    (name: "Architecture | Walls")
  ├── Sub-collection "Floors"   (name: "Architecture | Floors")
  └── Sub-collection "Roofs"    (name: "Architecture | Roofs")
```

The pipe character (`|`) preceded by TAB creates hierarchy levels. ALWAYS use this pattern for organizing published data from Grasshopper.

### Property Creation

Use **Create Properties** to build property dictionaries:

```
Key inputs:     "height", "material", "load_bearing"
Value inputs:   3.5,      "concrete",  true
```

Supported value types: strings, numbers, booleans, vectors, planes, lists, nested property dictionaries.

ALWAYS attach properties via **Create Properties** or **Speckle Properties Passthrough** BEFORE publishing. Properties cannot be added after publish.

---

## Block Handling

### Publishing Blocks from Rhino

1. Block definitions are stored as **Definition proxies** at the root Collection level
2. Each block instance becomes an **Instance Object** with `definitionId` + 4x4 `transform` matrix
3. The definition geometry is stored once; instances reference it (deduplication)

### Creating Blocks in Grasshopper

```
Step 1: Create geometry list → Block Definition Passthrough → definition
Step 2: definition + transform → Block Instance Passthrough → instance
Step 3: instance → Create Collection → Publish
```

### Loading Blocks

- Blocks load as native Rhino block definitions + instances
- Nested blocks are supported (definitions referencing other definitions)
- Transform matrices are applied on load to position instances

---

## Change Tracking in Grasshopper

### The Problem

Grasshopper parameters generate new GUIDs on every solve cycle. Speckle uses `applicationId` for change tracking. New GUIDs mean Speckle treats every solve as entirely new objects — no updates, only additions.

### The Solution

1. Create objects once and publish
2. Load the published model back into Grasshopper
3. Use **passthrough nodes** to mutate the loaded objects (preserves `applicationId`)
4. Publish the mutated objects

This preserves `applicationId` across versions, enabling proper change tracking and version comparison.

### For New Models

ALWAYS follow this sequence for models that will be updated over time:

1. Create initial geometry and properties
2. Publish to Speckle
3. Load the published version back
4. Use passthrough nodes for ALL subsequent modifications
5. Re-publish

---

## Reusable Components

Teams can create standardized **User Objects** (`.ghuser` files) with predefined:
- Naming conventions
- Property structures
- Collection hierarchies
- Publishing configurations

Distribute `.ghuser` files to team members for consistent project delivery across Grasshopper definitions.

---

## Cross-Connector Behavior

### Rhino to Revit

- Rhino geometry → Revit Direct Shapes (ALWAYS)
- User strings → NOT imported into Revit (Revit does not load custom properties)
- Blocks → Direct Shapes or Families (with "Receive Blocks as Families" setting in Revit)
- Named views → 3D views in Revit

### Revit to Rhino

- RevitObjects → Geometry with properties as user strings
- Revit parameters → Rhino user strings (readable, editable)
- Material quantities → User string properties
- Level associations → User string properties

### Grasshopper to Revit

- Geometry Objects → Direct Shapes
- Block Objects → Direct Shapes or Families
- Data Objects → Direct Shapes
- NEVER native BIM elements — this is a fundamental limitation

---

## Reference Links

- [references/methods.md](references/methods.md) — Grasshopper component signatures and Rhino connector API
- [references/examples.md](references/examples.md) — Working workflow examples for publish, load, and round-trip
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do, with WHY explanations

### Official Sources

- https://docs.speckle.systems/connectors/rhino/rhino.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper-objects.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper-collections.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper-properties.md
- https://docs.speckle.systems/connectors/grasshopper/grasshopper-recommendations.md
- https://docs.speckle.systems/developers/data-schema/connectors/rhino-schema.md
