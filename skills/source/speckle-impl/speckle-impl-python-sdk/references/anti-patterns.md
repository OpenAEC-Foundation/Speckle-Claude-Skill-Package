# anti-patterns.md — SpecklePy Common Mistakes

## AP-001: Hardcoding Tokens in Source Code

**WRONG:**
```python
client.authenticate_with_token("spk-abc123-secret-token-value")
```

**WHY:** Tokens committed to version control are exposed to anyone with repository access. Leaked tokens grant full API access to your Speckle account.

**CORRECT:**
```python
import os
token = os.environ.get("SPECKLE_TOKEN")
if not token:
    raise RuntimeError("SPECKLE_TOKEN environment variable not set.")
client.authenticate_with_token(token)
```

ALWAYS store tokens in environment variables, `.env` files (excluded from git), or a secret manager.

---

## AP-002: Sending Geometry Without a Base Container

**WRONG:**
```python
from specklepy.objects.geometry import Point
from specklepy.api import operations

point = Point(x=1.0, y=2.0, z=3.0)
object_id = operations.send(base=point, transports=[transport])
# Upload succeeds, but the point is INVISIBLE in the 3D viewer
```

**WHY:** The Speckle Viewer renders objects that are properties of a Base container. Naked geometry objects are stored but have no viewer context.

**CORRECT:**
```python
from specklepy.objects import Base
from specklepy.objects.geometry import Point

container = Base()
container["origin"] = Point(x=1.0, y=2.0, z=3.0)
container["points"] = [Point(x=i, y=0, z=0) for i in range(10)]
object_id = operations.send(base=container, transports=[transport])
```

ALWAYS wrap geometry in a Base container with named properties.

---

## AP-003: Calling get_id() in Loops on Large Objects

**WRONG:**
```python
for obj in large_object_list:
    print(f"ID: {obj.get_id()}")  # serializes ENTIRE object each call
```

**WHY:** `get_id()` computes a hash by serializing the entire object tree. For large objects (meshes with thousands of vertices), this is extremely expensive. Calling it in a loop multiplies the cost.

**CORRECT:**
```python
# Compute ID once and store it
object_id = obj.get_id()

# Or use operations.send() which returns the ID as part of the send flow
object_id = operations.send(base=obj, transports=[transport])
```

NEVER call `get_id()` repeatedly on the same object. Compute it once and cache the result.

---

## AP-004: Calling get_object() on ServerTransport

**WRONG:**
```python
transport = ServerTransport(stream_id=project_id, client=client)
obj_json = transport.get_object(object_id)  # raises SpeckleException
```

**WHY:** In the Python SDK, `ServerTransport.get_object()` is NOT implemented. It raises `SpeckleException`. The server transport retrieves objects through `copy_object_and_children()`, which is called internally by `operations.receive()`.

**CORRECT:**
```python
received = operations.receive(
    obj_id=object_id,
    remote_transport=transport,
)
```

ALWAYS use `operations.receive()` to retrieve objects from a server.

---

## AP-005: Sending Without Any Transport or Cache

**WRONG:**
```python
object_id = operations.send(
    base=my_object,
    transports=None,
    use_default_cache=False,
)
# Raises SpeckleException — no destination for data
```

**WHY:** With no transports and no default cache, there is nowhere to write the serialized data.

**CORRECT:**
```python
# Option A: Provide a transport
object_id = operations.send(base=my_object, transports=[transport])

# Option B: Use default cache (default behavior)
object_id = operations.send(base=my_object, use_default_cache=True)
```

ALWAYS provide at least one transport OR leave `use_default_cache=True`.

---

## AP-006: Accessing Properties Without hasattr() Check

**WRONG:**
```python
# Crashes with AttributeError if 'parameters' does not exist
params = received_obj.parameters
level = received_obj.properties["Level"]
```

**WHY:** Speckle objects are dynamic. Different sources produce objects with different properties. A wall from Revit has different properties than a wall from Rhino.

**CORRECT:**
```python
if hasattr(received_obj, "parameters"):
    params = received_obj.parameters

if hasattr(received_obj, "properties") and isinstance(received_obj.properties, dict):
    level = received_obj.properties.get("Level", "Unknown")
```

ALWAYS check property existence with `hasattr()` before access. ALWAYS use `.get()` with a default value for dictionary lookups.

---

## AP-007: Using Deprecated Stream/Branch/Commit Terminology

**WRONG:**
```python
# Using legacy API (may still work but is deprecated)
stream = client.stream.get(stream_id)
branch = client.branch.get(stream_id, branch_name)
commit = client.commit.get(stream_id, commit_id)
```

**WHY:** Speckle has migrated from stream/branch/commit to project/model/version terminology. Legacy API methods may be removed in future releases.

**CORRECT:**
```python
project = client.project.get(project_id)
model = client.model.get(project_id, model_id)   # if available
version = client.version.get(project_id, version_id)
```

ALWAYS use current terminology: project (not stream), model (not branch), version (not commit).

---

## AP-008: Assuming Flat Data Structures

**WRONG:**
```python
# Assumes all objects are at the top level
for obj in received.elements:
    process(obj)
```

**WHY:** Speckle data is hierarchical. BIM models have 3+ levels of nesting. Collections contain sub-collections contain elements. Skipping recursive traversal means missing most of the data.

**CORRECT:**
```python
def traverse(obj, callback):
    callback(obj)
    for name in obj.get_member_names():
        if name.startswith("_"):
            continue
        value = getattr(obj, name, None)
        if isinstance(value, Base):
            traverse(value, callback)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, Base):
                    traverse(item, callback)

traverse(root, process)
```

ALWAYS implement recursive traversal for Speckle data. NEVER assume a flat structure.

---

## AP-009: Creating ServerTransport Without Authentication

**WRONG:**
```python
transport = ServerTransport(stream_id=project_id)
# Raises SpeckleException — no authentication provided
```

**WHY:** All Speckle Server API calls require authentication. The transport validates authentication at construction time.

**CORRECT:**
```python
# Provide one of three authentication methods
transport = ServerTransport(stream_id=project_id, client=client)
transport = ServerTransport(stream_id=project_id, account=account)
transport = ServerTransport(stream_id=project_id, token=token, url=url)
```

ALWAYS provide authentication when constructing a ServerTransport.

---

## AP-010: Ignoring the Return Value of send()

**WRONG:**
```python
operations.send(base=my_object, transports=[transport])
# Object ID is lost — cannot create a version or receive the data later
```

**WHY:** The `send()` function returns the root object's hash, which is needed to create versions and to receive the data later. Without it, the data is on the server but unreferenceable.

**CORRECT:**
```python
object_id = operations.send(base=my_object, transports=[transport])

version = client.version.create(CreateVersionInput(
    project_id=project.id,
    model_id=model.id,
    object_id=object_id,
    message="My version",
))
```

ALWAYS capture the return value of `operations.send()`.

---

## AP-011: Disabling Default Cache Without Good Reason

**WRONG:**
```python
object_id = operations.send(
    base=my_object,
    transports=[transport],
    use_default_cache=False,
)
# Data is on the server but NOT cached locally
```

**WHY:** Without local caching, every `operations.receive()` call must download ALL objects from the server, even ones you just sent. This wastes bandwidth and dramatically increases latency.

**CORRECT:**
```python
# Leave default cache enabled (the default)
object_id = operations.send(base=my_object, transports=[transport])
```

ALWAYS keep `use_default_cache=True` (the default) unless running in an ephemeral/serverless environment where disk I/O must be avoided.

---

## AP-012: Using MemoryTransport for Persistent Data

**WRONG:**
```python
mem = MemoryTransport()
object_id = operations.send(base=data, transports=[mem], use_default_cache=False)
# Process exits — all data is lost
```

**WHY:** MemoryTransport stores data in a Python dictionary. All data is lost when the process exits or the transport is garbage collected.

**CORRECT:**
```python
# Use ServerTransport or SQLiteTransport for persistent data
transport = ServerTransport(stream_id=project_id, client=client)
object_id = operations.send(base=data, transports=[transport])

# MemoryTransport is ONLY for testing and temporary operations
```

NEVER rely on MemoryTransport for data that must survive process restarts.

---

## AP-013: Modifying speckle_type on an Existing Object

**WRONG:**
```python
obj = Base()
obj.speckle_type = "MyCustomType"  # silently ignored
```

**WHY:** `speckle_type` is a protected property. Attempts to modify it at runtime are silently ignored. The type must be set at class definition time.

**CORRECT:**
```python
class MyCustomType(Base, speckle_type="MyApp.CustomType"):
    pass

obj = MyCustomType()
print(obj.speckle_type)  # "MyApp.CustomType"
```

ALWAYS define `speckle_type` in the class declaration, NEVER try to set it on an instance.

---

## AP-014: Using Invalid Property Names

**WRONG:**
```python
obj = Base()
obj[""] = "empty name"           # INVALID: empty string
obj["my.prop"] = "dotted"        # INVALID: contains dot
obj["my/prop"] = "slashed"       # INVALID: contains slash
obj["@@double"] = "at signs"     # INVALID: multiple @ symbols
```

**WHY:** Speckle's serialization system uses these characters internally. Invalid property names cause serialization failures or data corruption.

**CORRECT:**
```python
obj = Base()
obj["myProp"] = "camelCase"
obj["my_prop"] = "snake_case"
obj["@detachedProp"] = some_large_object  # single @ = detached
```

ALWAYS use alphanumeric names with underscores or camelCase. A single `@` prefix is valid (marks detached property).

---

## AP-015: Mixing Up stream_id and project_id in ServerTransport

**WRONG:**
```python
# Using a model ID or version ID instead of project ID
transport = ServerTransport(stream_id=model_id, client=client)
```

**WHY:** `ServerTransport.stream_id` expects a PROJECT ID (formerly called stream ID). Using a model ID or version ID causes 404 errors on all operations.

**CORRECT:**
```python
transport = ServerTransport(stream_id=project.id, client=client)
```

ALWAYS pass the PROJECT ID to `stream_id`. The parameter name is legacy terminology.
