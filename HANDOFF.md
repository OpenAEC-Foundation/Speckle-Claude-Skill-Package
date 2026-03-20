# Handoff: Speckle-Claude-Skill-Package

> Gegenereerd: 2026-03-20 vanuit Skill-Package-Workflow-Template

## Status
- **Fase:** B0 Bootstrap DONE — docs compleet, skills/ structuur aangemaakt
- **Skills:** 0/22 geschreven
- **GitHub remote:** Nog niet aangemaakt
- **README:** Ontbreekt

## Wat er is
Alle governance docs zijn klaar: CLAUDE.md, ROADMAP.md, INDEX.md, WAY_OF_WORK.md, DECISIONS.md, LESSONS.md, SOURCES.md, REQUIREMENTS.md, CHANGELOG.md, START-PROMPT.md.
De `skills/source/` directory structuur met 22 lege skill mappen staat klaar.

## Wat er moet gebeuren
1. **Fase B1: Raw Masterplan** — Map het complete Speckle landschap
2. **Fase B2: Deep Research** — 4 research documenten (min. 2000 woorden elk)
3. **Fase B3: Masterplan Refinement** — Skill inventory definitief maken
4. **Fase B4+B5: Skill Creation** — Batches van 3 skills, dependency-aware
5. **Fase B6: Validation** — Quality gates
6. **Fase B7: Publication** — README, LICENSE, GitHub remote, compliance audit

## Batch volgorde
1. core (object-model, transport, api) — 3 skills
2. syntax (base-objects, graphql, webhooks, automate) — 4 skills
3. impl deel 1 (python-sdk, sharp-sdk, connectors, revit, rhino-grasshopper) — 5 skills
4. impl deel 2 (blender, viewer, automate-functions, federation, versioning) — 5 skills
5. errors (transport, conversion, auth) — 3 skills
6. agents (model-coordinator, data-validator) — 2 skills

## Hoe te starten
Open deze map in VS Code → Claude Code → typ:
```
Lees START-PROMPT.md en begin fase B1 (Raw Masterplan).
Gebruik Speckle-widgets/ als research input.
```

## Bijzonderheden
- Wereldwijd bestaan er GEEN Speckle Claude skills — first-mover
- Speckle v3 API wijkt significant af van v2
- MCP evaluatie is gepland als parallel track
- Cross-Tech-AEC package hangt af van dit package (speckle-blender, speckle-revit skills)
