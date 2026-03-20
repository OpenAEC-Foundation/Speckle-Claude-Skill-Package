# Speckle Skill Package — REQUIREMENTS

## Quality Guarantees

Every skill in this package MUST meet the following criteria:

### 1. Format-correct
- SKILL.md < 500 lines
- Valid YAML frontmatter with `name` and `description`
- `name`: kebab-case, max 64 characters, prefix `speckle-`
- `description`: max 1024 characters, includes trigger keywords
- `references/` directory with: methods.md, examples.md, anti-patterns.md

### 2. API-accurate
- All GraphQL queries MUST be valid and match the Speckle Server 2.x schema
- All SpecklePy code examples MUST use correct method signatures
- All Speckle Sharp code examples MUST use correct class/method names
- Object model references MUST match the actual Base object hierarchy

### 3. Version-explicit
- Target: Speckle Server 2.x
- SpecklePy: latest stable
- Speckle Sharp: latest stable
- Connectors: specify minimum supported version where applicable
- Note breaking changes between versions where applicable

### 4. Anti-pattern-free
- Every skill MUST document known mistakes in references/anti-patterns.md
- Common API misuse patterns documented
- SDK version incompatibilities documented
- Connector-specific gotchas documented

### 5. Deterministic
- Use ALWAYS/NEVER language
- No hedging words: "might", "consider", "often", "usually"
- Decision trees for conditional logic

### 6. Self-contained
- Each skill works independently without requiring other skills
- All necessary context included within the skill
- Cross-references to related skills are informational only

### 7. English-only
- All skill content in English
- Claude reads English, responds in any language
- No Dutch, German, or other languages in skill files

## Per-Category Requirements

### Core Skills
- MUST cover the complete Speckle object model hierarchy
- MUST document the transport system (local, server, memory)
- MUST cover the GraphQL API surface comprehensively

### Syntax Skills
- MUST include complete method/query catalogs
- MUST show both minimal and full examples
- MUST document all valid parameter values and types

### Implementation Skills
- MUST produce working code that runs against Speckle Server 2.x
- MUST include realistic examples (not just toy examples)
- MUST document connector-specific behaviors and limitations

### Error Skills
- MUST include real error scenarios with reproduction steps
- MUST provide fix patterns for every documented error

### Agent Skills
- MUST include decision trees for workflow selection
- MUST validate data against Speckle schema rules
