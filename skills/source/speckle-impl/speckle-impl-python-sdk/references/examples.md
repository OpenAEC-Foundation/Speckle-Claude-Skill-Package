# examples.md — SpecklePy Working Code Examples

## Example 1: Complete End-to-End Workflow

This example demonstrates the full lifecycle: authenticate, create a project/model, build objects, send data, create a version, receive data back, and traverse the result.

```python
import os
from specklepy.api.client import SpeckleClient
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.objects import Base
from specklepy.objects.geometry import Point, Line
from specklepy.core.api.inputs.project_inputs import ProjectCreateInput
from specklepy.core.api.inputs.model_inputs import CreateModelInput
from specklepy.core.api.inputs.version_inputs import CreateVersionInput
from specklepy.core.api.enums import ProjectVisibility

# --- Step 1: Authenticate ---
client = SpeckleClient(host="app.speckle.systems")
token = os.environ.get("SPECKLE_TOKEN")
if not token:
    raise RuntimeError("SPECKLE_TOKEN environment variable not set.")
client.authenticate_with_token(token)

# --- Step 2: Create project and model ---
project = client.project.create(ProjectCreateInput(
    name="Python SDK Demo",
    description="End-to-end workflow example",
    visibility=ProjectVisibility.PRIVATE,
))
print(f"Project created: {project.id}")

model = client.model.create(CreateModelInput(
    project_id=project.id,
    name="Structural Grid",
    description="Grid lines for structural layout",
))
print(f"Model created: {model.id}")

# --- Step 3: Build Speckle objects ---
# CRITICAL: Wrap geometry in a Base container for viewer visibility
container = Base()
container["name"] = "Structural Grid"
container["category"] = "Structure"

grid_lines = []
for i in range(5):
    line = Line(
        start=Point(x=float(i * 5), y=0.0, z=0.0),
        end=Point(x=float(i * 5), y=20.0, z=0.0),
    )
    grid_lines.append(line)

container["gridLines"] = grid_lines
container["gridSpacing"] = 5.0
container["gridCount"] = 5

# --- Step 4: Send to server ---
transport = ServerTransport(stream_id=project.id, client=client)
object_id = operations.send(base=container, transports=[transport])
print(f"Sent object: {object_id}")

# --- Step 5: Create a version ---
version = client.version.create(CreateVersionInput(
    project_id=project.id,
    model_id=model.id,
    object_id=object_id,
    message="Initial structural grid",
))
print(f"Version created: {version.id}")

# --- Step 6: Receive data back ---
received = operations.receive(
    obj_id=object_id,
    remote_transport=transport,
)
print(f"Received object type: {received.speckle_type}")
print(f"Grid spacing: {received['gridSpacing']}")

# --- Step 7: Traverse received data ---
if hasattr(received, "gridLines"):
    for idx, line in enumerate(received["gridLines"]):
        print(f"Grid line {idx}: ({line.start.x}, {line.start.y}) -> ({line.end.x}, {line.end.y})")
```

---

## Example 2: Token Authentication with Environment Variable

```python
import os
from specklepy.api.client import SpeckleClient

client = SpeckleClient(host="app.speckle.systems")

token = os.environ.get("SPECKLE_TOKEN")
if not token:
    raise RuntimeError("Set SPECKLE_TOKEN environment variable.")

client.authenticate_with_token(token)
print(f"Authenticated as: {client.account.userInfo.name}")
```

---

## Example 3: Local Account Authentication via Speckle Manager

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account, get_local_accounts

# List all available accounts
accounts = get_local_accounts()
for acc in accounts:
    print(f"Account: {acc.userInfo.name} on {acc.serverInfo.url} (default: {acc.isDefault})")

# Use the default account
account = get_default_account()
if account is None:
    raise RuntimeError("No default account. Install Speckle Manager and add an account.")

client = SpeckleClient(host=account.serverInfo.url)
client.authenticate_with_account(account)
```

---

## Example 4: Self-Hosted Server with Custom SSL Settings

```python
from specklepy.api.client import SpeckleClient

# Self-hosted server without SSL (local development only)
client = SpeckleClient(host="speckle.local", use_ssl=False)
client.authenticate_with_token("your-local-token")

# Self-hosted server with self-signed certificate
client = SpeckleClient(
    host="speckle.company.internal",
    use_ssl=True,
    verify_certificate=False,
)
client.authenticate_with_token("your-token")
```

---

## Example 5: Three ServerTransport Authentication Paths

```python
import os
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account
from specklepy.transports.server import ServerTransport

project_id = "abc123def456"

# Path 1: SpeckleClient (RECOMMENDED)
client = SpeckleClient(host="app.speckle.systems")
client.authenticate_with_token(os.environ["SPECKLE_TOKEN"])
transport_1 = ServerTransport(stream_id=project_id, client=client)

# Path 2: Account object
account = get_default_account()
transport_2 = ServerTransport(stream_id=project_id, account=account)

# Path 3: Raw token + URL
transport_3 = ServerTransport(
    stream_id=project_id,
    token=os.environ["SPECKLE_TOKEN"],
    url="https://app.speckle.systems",
)
```

---

## Example 6: Sending Custom Objects with Geometry

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Point, Line, Mesh
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

# Custom object class with namespace prefix
class StructuralBeam(Base, speckle_type="MyApp.Structural.Beam"):
    length: float = 0.0
    section: str = ""
    material: str = ""

# Build objects
beam = StructuralBeam()
beam.length = 6.0
beam.section = "W12x26"
beam.material = "A992 Steel"
beam["startPoint"] = Point(x=0.0, y=0.0, z=3.0)
beam["endPoint"] = Point(x=6.0, y=0.0, z=3.0)

# CRITICAL: Wrap in container for viewer visibility
container = Base()
container["beams"] = [beam]
container["name"] = "Structural Frame"

# Send
transport = ServerTransport(stream_id=project_id, client=client)
object_id = operations.send(base=container, transports=[transport])
```

---

## Example 7: Receiving and Traversing BIM Data

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

transport = ServerTransport(stream_id=project_id, client=client)
root = operations.receive(obj_id=version.referenced_object, remote_transport=transport)

def traverse(obj, depth=0):
    """Recursively traverse a Speckle object tree."""
    indent = "  " * depth
    obj_type = getattr(obj, "speckle_type", "unknown")
    print(f"{indent}Type: {obj_type}")

    # Check for elements array (collection pattern)
    if hasattr(obj, "elements") and isinstance(obj.elements, list):
        for child in obj.elements:
            if isinstance(child, Base):
                traverse(child, depth + 1)

    # Check for displayValue (viewer-renderable geometry)
    if hasattr(obj, "displayValue"):
        print(f"{indent}  -> Has display geometry")

    # Check dynamic properties
    for name in obj.get_dynamic_member_names():
        if name.startswith("_"):
            continue
        value = obj[name]
        if isinstance(value, Base):
            traverse(value, depth + 1)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, Base):
                    traverse(item, depth + 1)

traverse(root)
```

---

## Example 8: Serialize and Deserialize (Offline/Testing)

```python
from specklepy.api import operations
from specklepy.objects import Base
from specklepy.objects.geometry import Point

# Build object
obj = Base()
obj["name"] = "Test Object"
obj["origin"] = Point(x=1.0, y=2.0, z=3.0)

# Serialize to JSON (no transport = inline, no detaching)
json_str = operations.serialize(obj)
print(f"Serialized: {json_str[:100]}...")

# Deserialize back
restored = operations.deserialize(json_str)
print(f"Name: {restored['name']}")
print(f"Origin: ({restored['origin'].x}, {restored['origin'].y}, {restored['origin'].z})")
```

---

## Example 9: Using MemoryTransport for Testing

```python
from specklepy.api import operations
from specklepy.transports.memory import MemoryTransport
from specklepy.objects import Base

# MemoryTransport for unit tests — no disk or network I/O
mem = MemoryTransport()

obj = Base()
obj["test_value"] = 42

# Send to memory (disable default SQLite cache)
object_id = operations.send(
    base=obj,
    transports=[mem],
    use_default_cache=False,
)

# Receive from memory
received = operations.receive(
    obj_id=object_id,
    remote_transport=None,
    local_transport=mem,
)
assert received["test_value"] == 42
```

---

## Example 10: Property-Filtered Traversal for BIM Data

```python
def find_objects_by_property(obj, property_name, property_value, results=None):
    """Find all objects where properties[property_name] == property_value."""
    if results is None:
        results = []

    # Check properties dict (common in v3 BIM data)
    if hasattr(obj, "properties") and isinstance(obj.properties, dict):
        if obj.properties.get(property_name) == property_value:
            results.append(obj)

    # Recurse into all Base children
    for name in obj.get_member_names():
        if name.startswith("_"):
            continue
        try:
            value = getattr(obj, name, None)
        except Exception:
            continue

        if isinstance(value, Base):
            find_objects_by_property(value, property_name, property_value, results)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, Base):
                    find_objects_by_property(item, property_name, property_value, results)

    return results

# Usage: find all objects on Level 2
level_2_objects = find_objects_by_property(root, "Level", "Level 2")
print(f"Found {len(level_2_objects)} objects on Level 2")
```

---

## Example 11: Sending to Multiple Transports

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.transports.memory import MemoryTransport

server_transport = ServerTransport(stream_id=project_id, client=client)
memory_transport = MemoryTransport()

# Send to both server and memory simultaneously
object_id = operations.send(
    base=container,
    transports=[server_transport, memory_transport],
    use_default_cache=True,  # also writes to local SQLite cache
)
# Data is now in: server, memory, AND local SQLite cache
```

---

## Example 12: Version Retrieval and Referenced Object

```python
# Get a specific version
version = client.version.get(project_id, version_id)
print(f"Version message: {version.message}")
print(f"Root object ID: {version.referenced_object}")

# Receive the version's data
transport = ServerTransport(stream_id=project_id, client=client)
data = operations.receive(
    obj_id=version.referenced_object,
    remote_transport=transport,
)
```
