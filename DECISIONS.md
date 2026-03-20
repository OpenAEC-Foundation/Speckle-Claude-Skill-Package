# Speckle Skill Package — DECISIONS

## Architectural Decisions

### D-001: Research-First Methodology
**Date:** 2026-03-20
**Decision:** Use the proven 7-phase research-first methodology from Blender, ERPNext, and Draw.io packages.
**Rationale:** This approach produces higher-quality, deterministic skills because research precedes creation. Proven across 4 previous packages (Blender 73, ERPNext 28, Draw.io 22, Open-Agents 28 skills).

### D-002: Custom MCP Server Evaluation Needed
**Date:** 2026-03-20
**Decision:** Evaluate existing Speckle MCP servers before deciding to build custom or integrate existing.
**Rationale:** Unlike Draw.io which had established MCP servers (jgraph, lgazo), the Speckle MCP ecosystem needs to be researched first. Decision on build vs. integrate deferred to Phase B2.

### D-003: ~22 Skills Preliminary Count
**Date:** 2026-03-20
**Decision:** Target ~22 skills across 5 categories (core: 3, syntax: 4, impl: 10, errors: 3, agents: 2).
**Rationale:** Based on initial technology landscape analysis of Speckle's API surface, SDKs, and connectors. Will be refined in Phase B3 after deep research.

### D-004: Claude-First, No agentskills.io
**Date:** 2026-03-20
**Decision:** Focus on the Claude ecosystem. No explicit agentskills.io open standard compliance.
**Rationale:** Claude-specific features (allowed-tools, plugin marketplace, progressive disclosure) freely used without cross-platform constraints. Inherited from Draw.io package decision D-017.

### D-005: New Terminology (Project/Model/Version)
**Date:** 2026-03-20
**Decision:** Use Speckle's new terminology (Project, Model, Version) throughout all skills, with legacy mapping (Stream, Branch, Commit) documented in the API skill.
**Rationale:** Research confirmed SpecklePy and docs.speckle.systems have fully migrated to new terminology. Old terms still appear in some SDK code and community posts, so mapping is essential.

### D-006: docs.speckle.systems as Primary Docs
**Date:** 2026-03-20
**Decision:** Use docs.speckle.systems as the primary documentation source instead of speckle.guide.
**Rationale:** Research revealed speckle.guide is the legacy docs site with partial redirects. The new site at docs.speckle.systems is current and provides llms.txt for comprehensive doc indexing.

### D-007: 9-Batch Execution Plan
**Date:** 2026-03-20
**Decision:** Execute 26 skills in 9 batches of 3 agents, following the dependency graph from core → syntax → impl → errors → agents → MCP.
**Rationale:** Dependency analysis shows 6 layers. Batching by layer with 3 parallel agents per batch balances parallelism with quality gates. Updated from 22→26 after adding all connector skills.

### D-008: Speckle v2 + v3 Coverage
**Date:** 2026-03-20
**Decision:** Target both Speckle Server 2.x and 3.x. Use inline version tables (✅/❌) per skill when differences exist. One skill per topic, never separate files per version.
**Rationale:** Same pattern as ERPNext package (v14/v15/v16). Treats v2 as baseline, documents v3 breaking changes inline.

### D-009: All Connectors Included
**Date:** 2026-03-20
**Decision:** Include ALL actively maintained Speckle connectors: Revit, Rhino/Grasshopper, Blender, AutoCAD/Civil 3D, Tekla, Power BI. Each major connector gets its own skill.
**Rationale:** User directive: "maximale functionaliteit". Speckle's core value IS cross-tool data exchange. Connectors are the practical heart of the package. The connector code itself is open-source (Apache 2.0).

### D-010: Custom MCP Server
**Date:** 2026-03-20
**Decision:** Build a custom MCP server for Speckle with high quality standards. Must be smooth from installation to usage.
**Rationale:** User directive. Research existing implementations first, then build our own to our quality bar.
