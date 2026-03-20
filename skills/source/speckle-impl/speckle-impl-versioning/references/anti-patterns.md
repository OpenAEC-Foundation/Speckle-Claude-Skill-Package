# anti-patterns.md — speckle-impl-versioning

## AP-001: Modifying Versions Instead of Creating New Ones

**Wrong:**
```python
# Attempting to "update" a version's data
version = client.version.get(project_id, version_id)
data = operations.receive(obj_id=version.referenced_object, remote_transport=transport)
data.some_property = "new value"
operations.send(base=data, transports=[transport])
# The version still points to the OLD object hash!
```

**Why it fails:** Versions are immutable snapshots. The `referencedObject` field on a version NEVER changes after creation. Sending modified data creates a new object on the server, but the version record still points to the original hash.

**Correct:**
```python
# Send modified data and create a NEW version
new_object_id = operations.send(base=modified_data, transports=[transport])
new_version = client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=new_object_id,
    message="Updated property values"
))
```

---

## AP-002: Deleting Versions for Rollback

**Wrong:**
```python
# Deleting recent versions to "go back in time"
versions = client.version.list(project_id, model_id, limit=5)
for v in versions.items[:3]:
    client.version.delete(DeleteVersionsInput(
        version_ids=[v.id], project_id=project_id
    ))
```

**Why it fails:** Deleting versions destroys audit history. Any webhooks, Automate function runs, shared viewer URLs, or external references to those versions will break permanently. There is no way to recover deleted versions.

**Correct:**
```python
# Rollback by creating a new version pointing to the target object
target = client.version.get(project_id, target_version_id)
client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=target.referenced_object,
    message=f"Rollback to {target_version_id}"
))
```

---

## AP-003: Using Object Hash as Stable Identifier

**Wrong:**
```python
# Storing referencedObject as a permanent reference
db.save(element_id=version.referenced_object, metadata={"project": project_id})
# Later: the hash changes when ANY property changes
```

**Why it fails:** `referencedObject` is a content-addressable hash. ANY change to the root object or ANY of its children produces a different hash. It is deterministic (same content = same hash) but NOT stable across edits.

**Correct:**
```python
# Use version.id as the stable reference
db.save(version_id=version.id, project_id=project_id)
# version.id NEVER changes
```

---

## AP-004: Loading All Versions Without Pagination

**Wrong:**
```python
# Attempting to get all versions in one call
versions = client.version.list(project_id, model_id, limit=99999)
```

**Why it fails:** Models with extensive history (hundreds or thousands of versions) will cause excessive memory usage and slow API responses. The server may also enforce a maximum limit per request.

**Correct:**
```python
# Use cursor-based pagination
all_versions = []
cursor = None
while True:
    result = client.version.list(project_id, model_id, limit=25, cursor=cursor)
    all_versions.extend(result.items)
    if not result.cursor or len(result.items) < 25:
        break
    cursor = result.cursor
```

---

## AP-005: Creating Versions Without Messages

**Wrong:**
```python
version = client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=object_id
    # No message, no source_application
))
```

**Why it fails:** Version history becomes unusable for collaboration. Team members cannot determine what changed, when, or why. Automated tools cannot filter or search versions effectively.

**Correct:**
```python
version = client.version.create(CreateVersionInput(
    project_id=project_id,
    model_id=model_id,
    object_id=object_id,
    message="Added level 3 floor slab with openings for MEP risers",
    source_application="revit-sync/2.1"
))
```

---

## AP-006: Diffing by Object Hash Instead of applicationId

**Wrong:**
```python
# Comparing objects by their content hash
old_ids = {obj.get_id() for obj in old_objects}
new_ids = {obj.get_id() for obj in new_objects}
changed = old_ids.symmetric_difference(new_ids)
# This tells you SOMETHING changed but not WHAT objects changed
```

**Why it fails:** Content hashes change when ANY property changes. If a wall moves 1mm, its hash is completely different. Comparing hashes alone cannot distinguish between "wall A was modified" and "wall A was deleted and wall B was added."

**Correct:**
```python
# Use applicationId as the correlation key
old_map = {obj.applicationId: obj.get_id() for obj in old_objects if hasattr(obj, "applicationId") and obj.applicationId}
new_map = {obj.applicationId: obj.get_id() for obj in new_objects if hasattr(obj, "applicationId") and obj.applicationId}

added = set(new_map.keys()) - set(old_map.keys())
removed = set(old_map.keys()) - set(new_map.keys())
modified = {k for k in old_map if k in new_map and old_map[k] != new_map[k]}
```

---

## AP-007: Auto-Fitting Camera on Each Model Load

**Wrong:**
```typescript
// Auto-fitting on every model load in a multi-model workflow
for (const modelUrl of modelUrls) {
    const urls = await UrlHelper.getResourceUrls(modelUrl);
    for (const url of urls) {
        const loader = new SpeckleLoader(viewer.getWorldTree(), url, token);
        await viewer.loadObject(loader, true);  // autoFit=true on EACH load
    }
}
// Camera jumps erratically with each model, final view only fits the last model
```

**Why it fails:** Each `autoFit=true` call resets the camera to frame only the most recently loaded model. When loading multiple models, the final camera position only shows the last model, hiding previously loaded content.

**Correct:**
```typescript
// Load all models without auto-fit, then fit once
for (const modelUrl of modelUrls) {
    const urls = await UrlHelper.getResourceUrls(modelUrl);
    for (const url of urls) {
        const loader = new SpeckleLoader(viewer.getWorldTree(), url, token);
        await viewer.loadObject(loader, false);
    }
}
camera.setCameraView([], true);  // Fit to ALL loaded content
```

---

## AP-008: Deleting Models Without Checking Dependencies

**Wrong:**
```python
# Blindly deleting a model
client.model.delete(DeleteModelInput(project_id=project_id, id=model_id))
```

**Why it fails:** The model may have versions referenced by:
- Active Automate function triggers
- Shared viewer URLs sent to stakeholders
- Webhook subscriptions monitoring version_create events
- External systems syncing based on model ID

All these integrations break silently when the model is deleted.

**Correct:**
```python
# Check for versions and downstream dependencies first
versions = client.version.list(project_id, model_id, limit=1)
if versions.total_count > 0:
    print(f"WARNING: Model has {versions.total_count} versions.")
    print("Verify no active Automate functions, webhooks, or shared URLs reference this model.")
    confirm = input("Proceed with deletion? (yes/no): ")
    if confirm != "yes":
        print("Deletion cancelled.")
        return

client.model.delete(DeleteModelInput(project_id=project_id, id=model_id))
```

---

## AP-009: Creating DiffExtension Before Viewer Init

**Wrong:**
```typescript
const viewer = new Viewer(container, params);
const diff = viewer.createExtension(DiffExtension);  // BEFORE init!
await viewer.init();
```

**Why it fails:** Extensions depend on internal viewer state that is set up during `init()`. Creating extensions before init leads to silent failures -- the extension may appear to exist but will not function correctly.

**Correct:**
```typescript
const viewer = new Viewer(container, params);
await viewer.init();
const diff = viewer.createExtension(DiffExtension);  // AFTER init
```

---

## AP-010: Inconsistent Model Naming in Multi-Discipline Projects

**Wrong:**
```python
client.model.create(CreateModelInput(project_id=pid, name="Architecture"))
client.model.create(CreateModelInput(project_id=pid, name="struct_foundations"))
client.model.create(CreateModelInput(project_id=pid, name="MEP - HVAC"))
client.model.create(CreateModelInput(project_id=pid, name="plumbing"))
```

**Why it fails:** Inconsistent naming conventions (mixed case, different separators, no hierarchy) make it impossible to programmatically filter, sort, or coordinate across models. The viewer renders `/`-separated names as nested folders, but only if the convention is consistent.

**Correct:**
```python
client.model.create(CreateModelInput(project_id=pid, name="architecture/plans"))
client.model.create(CreateModelInput(project_id=pid, name="structural/foundations"))
client.model.create(CreateModelInput(project_id=pid, name="mep/hvac"))
client.model.create(CreateModelInput(project_id=pid, name="mep/plumbing"))
```
