---
name: speckle-impl-tekla
description: >
  Use when publishing structural steel/concrete data from Tekla Structures to Speckle.
  Prevents attempting to receive data INTO Tekla (publish-only connector), sending assemblies (unsupported), and expecting drawing views.
  Covers Tekla 2023-2025, publish-only behavior, selectable model objects (beams, plates, bolts), TeklaObject type, and known limitations (no assemblies, no drawings, no numbering series, no receive).
  Keywords: speckle tekla, tekla structures, tekla connector, publish only, TeklaObject, structural steel, beam, plate, bolt.
license: MIT
compatibility: "Designed for Claude Code. Requires Tekla Structures 2023-2025, Speckle Connector for Tekla (latest)."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-tekla

## Quick Reference

### Connector Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| Publish (Send) | Yes | All selectable model objects |
| Receive (Load) | **NO** | Not implemented -- publish-only connector |
| Supported Versions | 2023, 2024, 2025 | Windows only |
| Schema Type | TeklaObject | Extends DataObject |
| Geometry Format | Brep | Stored in `displayValue` |
| Proxy Types | RenderMaterial | Only proxy type used |

### Data Schema Hierarchy

```
Root Collection
  └── Tekla File
        └── Type (Beam, Column, Plate, etc.)
              └── TeklaObject
```

### Critical Warnings

**NEVER** attempt to receive/load data INTO Tekla Structures -- the Tekla connector is **PUBLISH-ONLY**. There is NO receive functionality. If a workflow requires loading data into Tekla, use an intermediate format (IFC) or request the feature via the Speckle Community Forum.

**NEVER** expect assemblies in the published output -- Tekla assemblies are NOT published to Speckle. Only individual parts (beams, plates, bolts, etc.) are converted.

**NEVER** publish from a Tekla drawing view -- the connector ONLY works from the model viewport. Attempting to publish from drawing views ALWAYS fails. ALWAYS switch to the model viewport before publishing.

**NEVER** expect drawing layouts, title blocks, or annotation data in the Speckle output -- drawings are NOT part of the published data.

**NEVER** expect numbering series or sequence settings to appear in the published model -- these Tekla-specific organizational constructs are NOT converted.

**NEVER** expect nested TeklaObjects -- TeklaObjects do NOT contain child TeklaObjects. Each structural element is a flat, independent object in the hierarchy.

---

## Publish-Only Architecture

The Tekla connector is fundamentally different from bidirectional connectors (Revit, Rhino, Blender). It supports ONE direction only:

```
Tekla Structures  ----[publish]---->  Speckle Server
                  <---[receive]----  NOT SUPPORTED
```

### Why This Matters

- **Coordination workflows**: Tekla models can be federated with Revit/Rhino/Archicad models in Speckle for visual review, but changes NEVER flow back into Tekla automatically.
- **Round-trip is impossible**: Any modifications in Speckle or other tools ALWAYS require manual re-creation in Tekla.
- **Automation scope**: Speckle Automate functions can analyze Tekla data but NEVER push results back into Tekla.

---

## TeklaObject

### Type Definition

TeklaObject extends DataObject with the following structure:

| Property | Type | Description |
|----------|------|-------------|
| `speckle_type` | string | ALWAYS `"Objects.Other.TeklaObject"` or similar DataObject variant |
| `type` | string | Element category: `"Beam"`, `"Column"`, `"Plate"`, `"Bolt"`, etc. |
| `displayValue` | array | Geometry array, typically Brep format |
| `properties` | dict | Metadata dictionary with Tekla-native data |
| `properties.Report` | dict | Aggregated report data from Tekla |
| `applicationId` | string | Stable Tekla element identifier |
| `units` | string | Model units (typically `"mm"`) |

### Properties.Report Contents

The `properties.Report` dictionary contains aggregated Tekla-native data:

| Report Field | Description | Example |
|--------------|-------------|---------|
| Profile designation | Section profile name | `"HEA300"`, `"W12X26"` |
| Material specification | Material grade | `"S355"`, `"C30/37"` |
| Physical dimensions | Length, width, height | Numeric values in model units |
| Weight | Part weight | Numeric value |
| Part number | Tekla part mark | String identifier |
| Assembly number | Assembly mark reference | String identifier |
| Coordinates | Part position | X, Y, Z values |

### Geometry

- ALWAYS stored in `displayValue` as an array
- Typically Brep (boundary representation) format for steel profiles
- Plates and other flat elements also use Brep
- Bolts are represented as simplified geometry

---

## Publishable Objects

### Supported Elements

ALL selectable model objects in the Tekla model viewport:

| Element Type | `type` Value | Typical Geometry |
|--------------|-------------|------------------|
| Steel beams | `"Beam"` | Brep (extruded profile) |
| Steel columns | `"Column"` | Brep (extruded profile) |
| Steel plates | `"Plate"` | Brep (flat solid) |
| Bolts | `"Bolt"` | Brep (simplified) |
| Concrete beams | `"Beam"` | Brep |
| Concrete columns | `"Column"` | Brep |
| Concrete slabs | `"Plate"` | Brep |
| Other parts | Varies | Brep |

### NOT Published

| Element | Reason |
|---------|--------|
| Assemblies | Not supported by connector |
| Drawing layouts | Not supported -- model objects only |
| Title blocks | Drawings not supported |
| Numbering series | Organizational data not converted |
| Sequence settings | Organizational data not converted |
| Custom components (as groups) | Exploded to individual parts |
| Reinforcement details | Not supported in current connector |

---

## Publishing Workflow

### Step-by-Step

1. **Open model viewport** -- ALWAYS verify you are in the model viewport, NOT a drawing view
2. **Select objects** -- Select the structural elements to publish, or use filters
3. **Open Speckle connector** -- Access via Tekla Extensions menu
4. **Choose project/model** -- Select the Speckle project and model to publish to
5. **Publish** -- Send selected objects to Speckle

### Selection Strategies

| Strategy | Method | Use Case |
|----------|--------|----------|
| Manual selection | Click/box-select in model | Small targeted exports |
| Selection filter | Tekla selection filters | Category-based exports (all beams, all plates) |
| All visible | Select all visible objects | Full model export |

---

## Federation with Other Connectors

Tekla models are ALWAYS consumers in federated views, never the destination for incoming data:

```
Revit Model --------\
Rhino Model ---------+--> Speckle Server --> Federated View (Viewer/Power BI)
Tekla Model --------/                   \--> NEVER back to Tekla
```

### Common Federation Patterns

| Pattern | Tekla Role | Other Tools |
|---------|-----------|-------------|
| Structural coordination | Publisher of steel/concrete model | Revit (architectural), Rhino (facade) |
| Clash detection | Publisher of structural elements | All other disciplines in viewer |
| Progress tracking | Publisher of as-built model | Speckle Automate for analysis |
| Design review | Publisher of structural model | Viewer for stakeholder review |

---

## Proxy Architecture

The Tekla connector uses ONLY one proxy type:

### RenderMaterial Proxy

- Material appearance data stored at Root Collection level
- Referenced by TeklaObjects via `applicationId`
- Contains color, opacity properties
- Does NOT contain textures (Speckle NEVER transfers textures)

---

## Platform Constraints

| Constraint | Detail |
|------------|--------|
| Operating system | Windows only |
| Tekla versions | 2023, 2024, 2025 |
| Viewport requirement | Model viewport only (not drawing views) |
| Data direction | Publish only |
| Geometry type | Brep (boundary representation) |
| Units | Follows Tekla model units (typically mm) |

---

## Reference Links

- [references/methods.md](references/methods.md) -- TeklaObject properties, publish API, selection methods
- [references/examples.md](references/examples.md) -- Working publish workflows, federation patterns, downstream data access
- [references/anti-patterns.md](references/anti-patterns.md) -- What NOT to do with the Tekla connector

### Official Sources

- Tekla Connector (User Docs): https://docs.speckle.systems/connectors/tekla.md
- Tekla Schema: https://docs.speckle.systems/developers/data-schema/connectors/tekla-schema.md
- Speckle Community Forum: https://speckle.community/
