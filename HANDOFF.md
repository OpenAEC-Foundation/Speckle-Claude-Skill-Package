# Handoff: Speckle-Claude-Skill-Package

> Gegenereerd: 2026-03-20 vanuit Skill-Package-Workflow-Template

## Status
- **Fase:** v1.1.0 COMPLETE — 25 skills + MCP server met 13 tools
- **Skills:** 25/25 geschreven (100 bestanden)
- **GitHub remote:** https://github.com/OpenAEC-Foundation/Speckle-Claude-Skill-Package
- **README:** Compleet met banner, skill catalog, installatie-instructies

## Wat er is
- 25 deterministic skills across 5 categories (core, syntax, impl, errors, agents)
- 6 deep research documents (~24K woorden)
- Definitive masterplan met 25 agent prompts
- Social preview banner in OpenAEC stijl
- Validatie: 99.6% pass rate

## Wat er is afgerond
- **GitHub Release** — v1.0.0 tag en release aangemaakt
- **Social Preview PNG** — Banner HTML gerenderd naar PNG en gecommit
- **GitHub Push** — Gepusht naar remote, topics ingesteld (claude, skills, speckle, ai, deterministic, openaec, aec, bim)
- **Repo description** — Ingesteld op GitHub
- **MCP Server** — Custom TypeScript MCP server met 13 tools (D-010), .mcp.json configuratie

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
