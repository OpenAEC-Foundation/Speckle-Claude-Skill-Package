---
name: speckle-impl-versioning
description: >
  Use when managing Speckle versions (commits), comparing model changes, implementing rollback strategies, or organizing models with branches.
  Prevents version history corruption, incorrect diff interpretation, and orphaned model branches.
  Covers version management (create/compare/rollback), sync strategies, version history traversal, DiffExtension in viewer, branch/model management, and multi-model coordination patterns.
  Keywords: speckle version, commit, branch, model, diff, compare, rollback, history, version management, model management.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-versioning

## Quick Reference

### Terminology Map

| Current Term | Legacy Term | Description |
|-------------|-------------|-------------|
| Project | Stream | Top-level container for all data |
| Model | Branch | Named series of versions within a project |
| Version | Commit | Immutable snapshot of data at a point in time |

**ALWAYS** use current terminology (project/model/version) in new code. Legacy terms still appear in some SDK parameter names (e.g., `stream_id` in ServerTransport).

### Version Lifecycle

```
[Send Object] --> [Create Version] --> [Version in History]
                                            |
                                    [Compare Versions]
                                            |
                                    [Rollback = new version
                                     pointing to old object]
```

### Critical Warnings

**NEVER** attempt to modify an existing version -- versions are IMMUTABLE snapshots. To "update" data, ALWAYS create a new version.

**NEVER** delete versions from the middle of a history chain without understanding that downstream references (webhooks, automation runs, viewer URLs) will break.

**NEVER** use `referencedObject` as a stable identifier across sessions -- it is a content hash that changes when data changes. Use the `version.id` for stable references.

**ALWAYS** include a descriptive `message` when creating versions -- empty messages make history unusable for collaboration.

**ALWAYS** set `sourceApplication` when creating versions programmatically -- this enables filtering and audit trails.

---

## Version CRUD Operations

### Create a Version

A version links an uploaded object (by its hash ID) to a model within a project.

**Step 1: Upload the object**

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

transport = ServerTransport(stream_id=project_id, client=client)
object_id = operations.send(base=my_object, transports=[transport])
```

**Step 2: Create the version record**

```python
from specklepy.core.api.inputs.version_inputs import CreateVersionInput

version = client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=object_id,
    message="Added structural grid layout",
    source_application="MyApp/1.0"
))
```

**GraphQL equivalent:**

```graphql
mutation VersionCreate($input: CreateVersionInput!) {
  versionMutations {
    create(input: $input) {
      id
      referencedObject
      message
      sourceApplication
      createdAt
    }
  }
}
```

Variables:
```json
{
  "input": {
    "objectId": "<uploaded-object-hash>",
    "modelId": "<model-id>",
    "projectId": "<project-id>",
    "message": "Added structural grid layout",
    "sourceApplication": "MyApp/1.0",
    "parents": ["<previous-version-id>"]
  }
}
```

The `parents` field is optional. It records lineage but does NOT enforce ordering.

### Get a Version

```python
version = client.version.get(project_id, version_id)
# version.id            -- stable identifier
# version.referenced_object  -- object hash for receive
# version.message       -- human-readable description
# version.created_at    -- timestamp
# version.source_application -- origin app
```

**GraphQL:**

```graphql
query VersionGet($projectId: String!, $versionId: String!) {
  project(id: $projectId) {
    version(id: $versionId) {
      id
      referencedObject
      message
      sourceApplication
      createdAt
      previewUrl
      authorUser { id name avatar }
    }
  }
}
```

### List Versions for a Model

```python
versions = client.version.list(
    project_id=project_id,
    model_id=model_id,
    limit=25
)
for v in versions.items:
    print(f"{v.id}: {v.message} ({v.created_at})")
```

**GraphQL (paginated):**

```graphql
query ModelVersions(
  $projectId: String!
  $modelId: String!
  $limit: Int!
  $cursor: String
) {
  project(id: $projectId) {
    model(id: $modelId) {
      versions(limit: $limit, cursor: $cursor) {
        items {
          id
          referencedObject
          message
          sourceApplication
          createdAt
          authorUser { id name }
        }
        totalCount
        cursor
      }
    }
  }
}
```

**ALWAYS** use cursor-based pagination when listing versions. NEVER attempt to load all versions at once on models with extensive history.

### Update a Version

Only the `message` field is updatable on an existing version.

```python
from specklepy.core.api.inputs.version_inputs import UpdateVersionInput

client.version.update(UpdateVersionInput(
    version_id=version_id,
    project_id=project_id,
    message="Corrected structural grid layout v2"
))
```

**GraphQL:**

```graphql
mutation VersionUpdate($input: UpdateVersionInput!) {
  versionMutations {
    update(input: $input) {
      id
      message
    }
  }
}
```

### Delete Versions

```python
from specklepy.core.api.inputs.version_inputs import DeleteVersionsInput

client.version.delete(DeleteVersionsInput(
    version_ids=[version_id],
    project_id=project_id
))
```

**GraphQL:**

```graphql
mutation VersionDelete($input: DeleteVersionsInput!) {
  versionMutations {
    delete(input: $input)
  }
}
```

Returns `Boolean!`. **NEVER** delete versions that are referenced by active Automate runs or shared viewer URLs.

### Move Versions Between Models

```graphql
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) {
      id
    }
  }
}
```

This relocates versions from one model to another within the same project. Use this to reorganize misplaced data without re-uploading.

---

## Version Comparison and Diff

### Retrieving Data for Comparison

To compare two versions, receive both root objects and traverse their trees:

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

transport = ServerTransport(stream_id=project_id, client=client)

old_version = client.version.get(project_id, old_version_id)
new_version = client.version.get(project_id, new_version_id)

old_data = operations.receive(obj_id=old_version.referenced_object, remote_transport=transport)
new_data = operations.receive(obj_id=new_version.referenced_object, remote_transport=transport)
```

### Object-Level Diff Strategy

Speckle objects have content-addressable IDs (hashes). Two objects with the same hash are identical.

```python
def build_object_map(base_obj, obj_map=None):
    """Recursively build a map of applicationId -> object hash."""
    if obj_map is None:
        obj_map = {}
    if hasattr(base_obj, "applicationId") and base_obj.applicationId:
        obj_map[base_obj.applicationId] = base_obj.get_id()
    for name in base_obj.get_member_names():
        if name.startswith("_"):
            continue
        value = getattr(base_obj, name, None)
        if hasattr(value, "get_member_names"):
            build_object_map(value, obj_map)
        elif isinstance(value, list):
            for item in value:
                if hasattr(item, "get_member_names"):
                    build_object_map(item, obj_map)
    return obj_map

old_map = build_object_map(old_data)
new_map = build_object_map(new_data)

added = {k: v for k, v in new_map.items() if k not in old_map}
removed = {k: v for k, v in old_map.items() if k not in new_map}
modified = {k: new_map[k] for k in old_map if k in new_map and old_map[k] != new_map[k]}
unchanged = {k: new_map[k] for k in old_map if k in new_map and old_map[k] == new_map[k]}
```

**ALWAYS** use `applicationId` as the correlation key for diffing -- it persists across versions for the same native element. Object hashes change whenever any property changes.

### DiffExtension in the Viewer

The `@speckle/viewer` package includes a `DiffExtension` for visual comparison:

```typescript
import { Viewer, DiffExtension, SpeckleLoader, UrlHelper } from "@speckle/viewer";

const diff = viewer.createExtension(DiffExtension);

// Load both versions into the viewer
const oldUrl = `https://app.speckle.systems/projects/${projectId}/models/${modelId}@${oldVersionId}`;
const newUrl = `https://app.speckle.systems/projects/${projectId}/models/${modelId}@${newVersionId}`;

// DiffExtension highlights:
// - GREEN: added elements
// - RED: removed elements
// - YELLOW: modified elements
// - GREY: unchanged elements
```

**ALWAYS** create the DiffExtension AFTER `viewer.init()` completes. Creating extensions before init causes silent failures.

---

## Rollback Strategy

Speckle has NO built-in rollback mutation. Rollback is achieved by creating a NEW version that references the same object as a previous version.

### Rollback Pattern

```python
# 1. Get the target version to roll back to
target_version = client.version.get(project_id, target_version_id)

# 2. Create a new version pointing to the same object
rollback_version = client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=target_version.referenced_object,
    message=f"Rollback to version {target_version_id}: {target_version.message}",
    source_application="rollback-script"
))
```

This preserves the full history chain. The rollback version is a new entry that points to an existing object -- no data duplication occurs because objects are content-addressed.

**NEVER** delete intermediate versions to simulate rollback. This destroys audit history and breaks references.

---

## Model (Branch) Management

### Create a Model

```python
from specklepy.core.api.inputs.model_inputs import CreateModelInput

model = client.model.create(CreateModelInput(
    project_id=project_id,
    name="structural/foundations",
    description="Foundation structural model"
))
```

**GraphQL:**

```graphql
mutation ModelCreate($input: CreateModelInput!) {
  modelMutations {
    create(input: $input) {
      id
      name
      displayName
      description
    }
  }
}
```

Model names support `/` separators for hierarchical organization (e.g., `structural/foundations`, `structural/framing`). The viewer and web UI render these as nested folders.

### Other Model Operations

```python
from specklepy.core.api.inputs.model_inputs import UpdateModelInput, DeleteModelInput

# List models
models = client.model.get_models(project_id=project_id, limit=50)

# Update
client.model.update(UpdateModelInput(
    project_id=project_id, model_id=model_id,
    name="structural/foundations-v2", description="Updated foundation model"
))

# Delete
client.model.delete(DeleteModelInput(project_id=project_id, id=model_id))
```

**NEVER** delete a model that has versions actively used in Automate functions or shared viewer URLs. ALWAYS verify downstream dependencies first. See [references/methods.md](references/methods.md) for full GraphQL signatures and filter options.

---

## Multi-Model Coordination

### Loading Multiple Models in the Viewer

Iterate over model URLs, calling `UrlHelper.getResourceUrls()` and `viewer.loadObject(loader, false)` for each. **ALWAYS** pass `autoFit=false` when loading multiple models, then call `camera.setCameraView([], true)` once after all models are loaded. See [references/examples.md](references/examples.md) for the full TypeScript implementation.

### Cross-Model Version Synchronization

Coordinate versions across models by creating tagged snapshots with a shared timestamp in the message. Iterate over model IDs, fetch each model's latest version, and create a new version with a coordination message prefix (e.g., `[Coordinated 2024-01-15T10:00:00] Milestone review`). See [references/examples.md](references/examples.md) for full implementation.

### Model Naming Conventions

| Pattern | Example | Use Case |
|---------|---------|----------|
| Discipline prefix | `architecture/floor-plans` | Multi-discipline projects |
| Phase prefix | `phase-1/demolition` | Phased construction |
| Source prefix | `revit/central-model` | Multi-tool workflows |
| Flat naming | `structural-analysis` | Simple single-discipline projects |

**ALWAYS** establish a naming convention before creating models. Inconsistent naming makes multi-model coordination difficult.

---

## Version History Traversal

### Walking the Version Timeline

```python
def get_full_version_history(client, project_id, model_id):
    """Retrieve complete version history for a model."""
    all_versions = []
    cursor = None

    while True:
        result = client.version.list(
            project_id=project_id,
            model_id=model_id,
            limit=25,
            cursor=cursor
        )
        all_versions.extend(result.items)
        if not result.cursor or len(result.items) < 25:
            break
        cursor = result.cursor

    return all_versions
```

### Mark Version as Received

After successfully receiving and processing a version, mark it:

```graphql
mutation MarkReceived($input: MarkReceivedVersionInput!) {
  versionMutations {
    markReceived(input: $input)
  }
}
```

This updates the version's received status, useful for tracking sync state across distributed systems.

---

## Reference Links

- [references/methods.md](references/methods.md) -- API signatures for version, model, and diff operations
- [references/examples.md](references/examples.md) -- Complete working examples for version management workflows
- [references/anti-patterns.md](references/anti-patterns.md) -- Common mistakes in version and model management

### Official Sources

- https://docs.speckle.systems/developers/sdks/python/api-reference/client.md
- https://docs.speckle.systems/developers/server-api/graphql-api.md
- https://docs.speckle.systems/developers/viewer/extensions
- https://speckle.guide/dev/python.html
