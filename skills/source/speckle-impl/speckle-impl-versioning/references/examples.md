# examples.md — speckle-impl-versioning

## Example 1: Complete Version Creation Workflow (Python)

```python
import os
from specklepy.api.client import SpeckleClient
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.objects import Base
from specklepy.objects.geometry import Point
from specklepy.core.api.inputs.version_inputs import CreateVersionInput

# Authenticate
client = SpeckleClient(host="app.speckle.systems")
client.authenticate_with_token(os.environ["SPECKLE_TOKEN"])

project_id = "abc123"
model_id = "def456"

# Build data
container = Base()
container["@points"] = [Point(x=i, y=0, z=0) for i in range(100)]
container.name = "Grid Points"

# Upload object
transport = ServerTransport(stream_id=project_id, client=client)
object_id = operations.send(base=container, transports=[transport])

# Create version
version = client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=object_id,
    message="Added 100 grid points along X axis",
    source_application="grid-generator/1.0"
))

print(f"Version created: {version.id}")
print(f"Object hash: {version.referenced_object}")
```

---

## Example 2: List and Paginate Through Version History

```python
def get_all_versions(client, project_id, model_id):
    """Retrieve every version for a model using cursor pagination."""
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

        # Stop when no more pages
        if not result.cursor or len(result.items) < 25:
            break
        cursor = result.cursor

    return all_versions

versions = get_all_versions(client, project_id, model_id)
for v in versions:
    print(f"[{v.created_at}] {v.id}: {v.message} (by {v.source_application})")
```

---

## Example 3: Rollback to a Previous Version

```python
from specklepy.core.api.inputs.version_inputs import CreateVersionInput

def rollback_model(client, project_id, model_id, target_version_id):
    """Roll back a model by creating a new version pointing to a previous object."""
    target = client.version.get(project_id, target_version_id)

    rollback = client.version.create(CreateVersionInput(
        project_id=project_id,
        model_id=model_id,
        object_id=target.referenced_object,
        message=f"Rollback to version {target_version_id}: {target.message}",
        source_application="rollback-script"
    ))
    return rollback

# Roll back to a known good version
rollback_version = rollback_model(client, project_id, model_id, "known-good-version-id")
print(f"Rolled back. New version: {rollback_version.id}")
```

---

## Example 4: Compare Two Versions (Object-Level Diff)

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

def build_app_id_map(obj, result=None):
    """Build a map of applicationId -> content hash for diff comparison."""
    if result is None:
        result = {}
    if hasattr(obj, "applicationId") and obj.applicationId:
        result[obj.applicationId] = obj.get_id()
    for name in obj.get_member_names():
        if name.startswith("_"):
            continue
        value = getattr(obj, name, None)
        if hasattr(value, "get_member_names"):
            build_app_id_map(value, result)
        elif isinstance(value, list):
            for item in value:
                if hasattr(item, "get_member_names"):
                    build_app_id_map(item, result)
    return result

def diff_versions(client, project_id, old_version_id, new_version_id):
    """Compare two versions and return added/removed/modified/unchanged sets."""
    transport = ServerTransport(stream_id=project_id, client=client)

    old_ver = client.version.get(project_id, old_version_id)
    new_ver = client.version.get(project_id, new_version_id)

    old_data = operations.receive(obj_id=old_ver.referenced_object, remote_transport=transport)
    new_data = operations.receive(obj_id=new_ver.referenced_object, remote_transport=transport)

    old_map = build_app_id_map(old_data)
    new_map = build_app_id_map(new_data)

    return {
        "added": {k for k in new_map if k not in old_map},
        "removed": {k for k in old_map if k not in new_map},
        "modified": {k for k in old_map if k in new_map and old_map[k] != new_map[k]},
        "unchanged": {k for k in old_map if k in new_map and old_map[k] == new_map[k]},
    }

result = diff_versions(client, project_id, "version-a", "version-b")
print(f"Added: {len(result['added'])}")
print(f"Removed: {len(result['removed'])}")
print(f"Modified: {len(result['modified'])}")
print(f"Unchanged: {len(result['unchanged'])}")
```

---

## Example 5: Model (Branch) Management

```python
from specklepy.core.api.inputs.model_inputs import (
    CreateModelInput, UpdateModelInput, DeleteModelInput
)

# Create hierarchical models
models_to_create = [
    ("architecture/plans", "Floor plans"),
    ("architecture/sections", "Section cuts"),
    ("structural/foundations", "Foundation layout"),
    ("structural/framing", "Steel framing"),
    ("mep/hvac", "HVAC systems"),
    ("mep/plumbing", "Plumbing layout"),
]

created_models = {}
for name, description in models_to_create:
    model = client.model.create(CreateModelInput(
        project_id=project_id,
        name=name,
        description=description
    ))
    created_models[name] = model.id
    print(f"Created model: {name} ({model.id})")

# Update a model
client.model.update(UpdateModelInput(
    project_id=project_id,
    model_id=created_models["structural/framing"],
    name="structural/steel-framing",
    description="Revised steel framing model"
))

# List all models
models = client.model.get_models(project_id=project_id, limit=50)
for m in models.items:
    print(f"  {m.name}: {m.description}")
```

---

## Example 6: Multi-Model Viewer Loading (TypeScript)

```typescript
import {
    Viewer,
    DefaultViewerParams,
    SpeckleLoader,
    UrlHelper,
    CameraController,
    SelectionExtension,
    FilteringExtension,
} from "@speckle/viewer";

async function loadMultiModelView(
    containerId: string,
    projectId: string,
    modelIds: string[],
    authToken: string
) {
    const container = document.getElementById(containerId)!;
    const viewer = new Viewer(container, DefaultViewerParams);
    await viewer.init();

    const camera = viewer.createExtension(CameraController);
    viewer.createExtension(SelectionExtension);
    viewer.createExtension(FilteringExtension);

    // Load each model WITHOUT auto-fitting
    for (const modelId of modelIds) {
        const modelUrl = `https://app.speckle.systems/projects/${projectId}/models/${modelId}`;
        const urls = await UrlHelper.getResourceUrls(modelUrl);
        for (const url of urls) {
            const loader = new SpeckleLoader(viewer.getWorldTree(), url, authToken);
            await viewer.loadObject(loader, false);
        }
    }

    // Fit camera ONCE after all models are loaded
    camera.setCameraView([], true);

    return viewer;
}
```

---

## Example 7: GraphQL Version Management (Raw Queries)

```python
# Using SpeckleClient.execute_query for operations not covered by SDK resources

# Move versions to a different model
move_query = """
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) { id }
  }
}
"""
result = client.execute_query(move_query, variables={
    "input": {
        "versionIds": ["ver-1", "ver-2"],
        "targetModelId": "new-model-id",
        "projectId": project_id
    }
})

# Mark a version as received
mark_query = """
mutation MarkReceived($input: MarkReceivedVersionInput!) {
  versionMutations {
    markReceived(input: $input)
  }
}
"""
client.execute_query(mark_query, variables={
    "input": {
        "versionId": "ver-1",
        "projectId": project_id,
        "sourceApplication": "sync-service",
        "message": "Received and processed"
    }
})
```

---

## Example 8: Version History Report

```python
from datetime import datetime

def version_history_report(client, project_id, model_id):
    """Generate a summary report of version activity."""
    versions = get_all_versions(client, project_id, model_id)

    if not versions:
        print("No versions found.")
        return

    print(f"Total versions: {len(versions)}")
    print(f"First version: {versions[-1].created_at}")
    print(f"Latest version: {versions[0].created_at}")
    print()

    # Group by source application
    by_source = {}
    for v in versions:
        src = v.source_application or "unknown"
        by_source.setdefault(src, []).append(v)

    print("Versions by source application:")
    for src, vlist in sorted(by_source.items()):
        print(f"  {src}: {len(vlist)} versions")

    print()
    print("Recent 10 versions:")
    for v in versions[:10]:
        print(f"  [{v.created_at}] {v.message or '(no message)'}")

version_history_report(client, project_id, model_id)
```
