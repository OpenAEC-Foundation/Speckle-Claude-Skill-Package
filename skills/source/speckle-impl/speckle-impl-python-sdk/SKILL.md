---
name: speckle-impl-python-sdk
description: >
  Use when writing Python code with SpecklePy to send, receive, or query Speckle data.
  Prevents auth token confusion, incorrect transport setup, and missing resource module patterns.
  Covers SpecklePy installation, SpeckleClient authentication, resource modules (project, model, version, active_user, server, workspace), operations (send/receive/serialize/deserialize), ServerTransport configuration, and local data paths.
  Keywords: specklepy, python sdk, SpeckleClient, operations.send, operations.receive, ServerTransport, pip install specklepy, query objects, filter by type, find walls, traverse, search model.
license: MIT
compatibility: "Designed for Claude Code. Requires Python 3.10+, SpecklePy (latest), Speckle Server 2.x/3.x."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-python-sdk

## Quick Reference

### Installation

```bash
pip install specklepy
pip install specklepy==3.2.4        # pin a specific version
pip install --upgrade specklepy     # upgrade existing install
```

**Requirements:** Python 3.10+ (tested on 3.10, 3.11, 3.12, 3.13). ALWAYS use a virtual environment.

**Auto-installed dependencies:** `gql[requests,websockets]`, `pydantic`, `appdirs`, `stringcase`, `ujson`, `deprecated`.

### Core Imports

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account, get_local_accounts
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.objects import Base
from specklepy.objects.geometry import Point, Line, Polyline, Mesh
```

### Critical Warnings

**NEVER** hardcode tokens in source code. ALWAYS load tokens from environment variables or secret managers.

**NEVER** send geometry objects (Point, Line, Mesh) directly without wrapping them in a `Base` container. They will upload successfully but will NOT appear in the 3D viewer.

**NEVER** call `get_id()` in loops on large objects. It serializes the entire object to compute a hash, causing severe performance degradation.

**NEVER** call `ServerTransport.get_object()` directly. It is NOT implemented in the Python SDK and raises `SpeckleException`. ALWAYS use `operations.receive()` instead.

**NEVER** call `send()` with `transports=None` AND `use_default_cache=False`. This raises a `SpeckleException` because there is no destination for the data.

**ALWAYS** use `hasattr()` before accessing properties on received Base objects. Accessing non-existent properties raises `AttributeError`.

**ALWAYS** use current terminology: project (not stream), model (not branch), version (not commit). The `ServerTransport` still uses `stream_id` parameter — pass the project ID there.

---

## SpeckleClient

### Constructor

```python
SpeckleClient(
    host: str = "app.speckle.systems",
    use_ssl: bool = True,
    verify_certificate: bool = True,
) -> None
```

- `host` — the Speckle Server hostname (without protocol prefix)
- `use_ssl` — set to `False` ONLY for local development servers without HTTPS
- `verify_certificate` — set to `False` ONLY for self-signed certificates

### Authentication

**Token-based (primary method):**
```python
import os
from specklepy.api.client import SpeckleClient

client = SpeckleClient(host="app.speckle.systems")
client.authenticate_with_token(os.environ["SPECKLE_TOKEN"])
```

**Account-based (from Speckle Manager):**
```python
from specklepy.api.credentials import get_default_account

account = get_default_account()
client = SpeckleClient(host=account.serverInfo.url)
client.authenticate_with_account(account)
```

**Account object properties:**
- `account.serverInfo.url` / `account.serverInfo.name` / `account.serverInfo.company`
- `account.userInfo.id` / `account.userInfo.name` / `account.userInfo.email`
- `account.token` — the personal access token string
- `account.isDefault` — boolean flag

**Token scopes:** `streams:read`, `streams:write`, `profile:read`, `Profile:email`

### Raw GraphQL

```python
result = client.execute_query(query_string)
```

Use ONLY when the resource modules do not cover a specific need.

---

## Resource Modules

The SpeckleClient exposes typed resource modules as properties:

| Property | Class | Purpose |
|----------|-------|---------|
| `client.project` | `ProjectResource` | Create, get, update, delete, list projects |
| `client.model` | `ModelResource` | Create, get, update, delete, list models |
| `client.version` | `VersionResource` | Create, get, list, update, delete versions |
| `client.active_user` | `ActiveUserResource` | Authenticated user profile and projects |
| `client.other_user` | `OtherUserResource` | Lookup and search other user accounts |
| `client.server` | `ServerResource` | Server information and metadata |
| `client.subscription` | `SubscriptionResource` | Real-time project update notifications |
| `client.workspace` | `WorkspaceResource` | Workspace management (workspace-enabled servers) |
| `client.project_invite` | `ProjectInviteResource` | Project invitation management |
| `client.file_import` | `FileImportResource` | File import operations |

### ProjectResource

```python
from specklepy.core.api.inputs.project_inputs import ProjectCreateInput
from specklepy.core.api.enums import ProjectVisibility

project = client.project.create(ProjectCreateInput(
    name="My Project",
    description="Description",
    visibility=ProjectVisibility.PRIVATE
))
project = client.project.get(project_id)
```

### ModelResource

```python
from specklepy.core.api.inputs.model_inputs import CreateModelInput

model = client.model.create(CreateModelInput(
    project_id=project.id,
    name="Architecture",
    description="Architecture model"
))
```

### VersionResource

```python
from specklepy.core.api.inputs.version_inputs import CreateVersionInput

version = client.version.create(CreateVersionInput(
    project_id=project.id,
    model_id=model.id,
    object_id=object_id,
    message="Initial version"
))
version = client.version.get(project_id, version_id)
root_object_id = version.referenced_object
```

---

## Operations

### send()

```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

transport = ServerTransport(stream_id=project.id, client=client)
object_id = operations.send(
    base=my_object,
    transports=[transport],
    use_default_cache=True,       # default; caches locally in SQLite
)
```

**Parameters:**
- `base` — the root `Base` object to send
- `transports` — list of destination transports (also accepts a single transport)
- `use_default_cache` — when `True` (default), prepends a local SQLiteTransport for caching

**Returns:** the hash string (object ID) of the root object.

**Flow:** Serializes the object tree recursively. Each serialized object is written to ALL transports immediately, then its string representation is garbage collected to minimize memory usage.

### receive()

```python
received = operations.receive(
    obj_id=root_object_id,
    remote_transport=transport,
    local_transport=None,          # defaults to SQLiteTransport
)
```

**Parameters:**
- `obj_id` — hash of the root object
- `remote_transport` — source transport (typically ServerTransport)
- `local_transport` — cache transport (defaults to SQLiteTransport if None)

**Returns:** the deserialized `Base` object with all nested children.

**Flow:** Checks local cache first. On cache miss, fetches from remote via `copy_object_and_children()`, stores in local cache, then deserializes.

### serialize() / deserialize()

```python
json_str = operations.serialize(base_object)
restored = operations.deserialize(json_str)
```

- `serialize()` without transports produces INLINE JSON (no detaching/chunking)
- `deserialize()` without a read transport defaults to SQLiteTransport for resolving references

---

## ServerTransport

### Constructor (3 Authentication Paths)

```python
from specklepy.transports.server import ServerTransport

# Path 1: Authenticated SpeckleClient (RECOMMENDED)
transport = ServerTransport(stream_id=project_id, client=client)

# Path 2: Account object
transport = ServerTransport(stream_id=project_id, account=account)

# Path 3: Raw token + URL
transport = ServerTransport(stream_id=project_id, token=token, url=server_url)
```

**CRITICAL:** The `stream_id` parameter accepts a project ID. The parameter name is legacy terminology — projects were formerly called streams.

**CRITICAL:** You MUST provide at least one authentication method. Omitting all three raises `SpeckleException`.

### Implementation Details

- Uses a `BatchSender` with 1MB maximum batch size for uploads
- `get_object()` is NOT implemented — raises `SpeckleException`
- `has_objects()` returns all IDs mapped to `False` (defers to server during copy)
- `copy_object_and_children()` performs the actual download workflow

---

## Base Class and Object Model

### Base Object

```python
from specklepy.objects import Base

obj = Base()
obj.name = "My Object"            # attribute style
obj["category"] = "structural"    # dictionary style
```

**Identity:**
- `speckle_type` — protected type identifier (e.g., `"Objects.Geometry.Point"`). CANNOT be changed after class definition.
- `get_id()` — content hash. WARNING: expensive for large objects.
- `applicationId` — links objects across sends for tracking native element IDs.

**Introspection:**
- `get_member_names()` — all properties (typed + dynamic)
- `get_typed_member_names()` — class-defined properties only
- `get_dynamic_member_names()` — runtime-added properties only

**Property rules:** Empty strings, multiple `@` symbols, and characters like `.` or `/` are INVALID property names.

### Custom Objects

```python
from specklepy.objects import Base
from typing import Optional

class Wall(Base, speckle_type="MyApp.Wall"):
    height: float
    material: Optional[str] = None
```

ALWAYS use namespace prefixes in `speckle_type` to prevent naming conflicts.

### Geometry Objects

```python
from specklepy.objects.geometry import Point, Line, Polyline, Mesh

point = Point(x=1.0, y=2.0, z=3.0)
line = Line(start=Point(x=0, y=0, z=0), end=Point(x=10, y=10, z=10))
```

**CRITICAL:** Geometry objects sent directly will NOT appear in the 3D viewer. ALWAYS wrap in a Base container:

```python
container = Base()
container.line = line
container.points = [p1, p2, p3]
```

### Detachable and Chunkable Properties

- Properties prefixed with `@` are stored separately and referenced by hash ID (detached)
- Large arrays are automatically split into chunks during serialization
- Both enable lazy loading and deduplication

---

## Local Data Paths

| OS | Default Path |
|----|-------------|
| Windows | `%APPDATA%\Speckle` (typically `C:\Users\{user}\AppData\Roaming\Speckle`) |
| macOS | `~/.config/Speckle` |
| Linux | `$XDG_DATA_HOME/Speckle` or `~/.local/share/Speckle` |

Contents: account data, authentication tokens (managed by Speckle Manager), SQLite cache databases (`Data.db`, `Objects.db`).

### get_default_account()

```python
from specklepy.api.credentials import get_default_account, get_local_accounts

account = get_default_account()     # returns the default account or None
accounts = get_local_accounts()     # returns list of all local accounts
```

Reads account data from the local Speckle data directory. Accounts are registered by the Speckle Manager desktop application.

---

## Error Handling

### SpeckleException Types

- `SpeckleException` — base exception for all Speckle SDK errors
- Raised when: no transports provided, authentication missing, server unreachable, invalid object ID
- ServerTransport raises `SpeckleException` on `get_object()` (not implemented)

### Defensive Patterns

```python
# ALWAYS check property existence during traversal
if hasattr(obj, "parameters"):
    params = obj.parameters

# ALWAYS handle missing accounts
account = get_default_account()
if account is None:
    raise RuntimeError("No default Speckle account. Install Speckle Manager and add an account.")

# ALWAYS validate token before use
token = os.environ.get("SPECKLE_TOKEN")
if not token:
    raise RuntimeError("SPECKLE_TOKEN environment variable not set.")
```

---

## Data Traversal

### Traversal Strategies (ordered by recommendation)

1. **Property-Filtered** — recurse and check `properties` dict for specific values. Best for BIM data.
2. **displayValue-Based** — collect objects with `displayValue` property. These are viewer-selectable elements.
3. **elements[] Hierarchy** — navigate `elements` arrays for organizational structure.
4. **Full Recursive** — visit every object. Most comprehensive, slowest.
5. **Type-Filtered** — check `speckle_type`. Limited for v3 BIM data (most objects are generic `DataObject`).

### Traversal Rules

- ALWAYS verify properties with `hasattr()` before access
- ALWAYS skip private members beginning with underscores
- ALWAYS handle properties that may be single values or lists
- Use early termination when searching for specific objects

---

## Reference Links

- [references/methods.md](references/methods.md) — Complete API signatures for SpeckleClient, resource modules, operations, and ServerTransport
- [references/examples.md](references/examples.md) — Working end-to-end code examples
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do, with explanations

### Official Sources

- https://docs.speckle.systems/developers/sdks/python/introduction.md
- https://docs.speckle.systems/developers/sdks/python/getting-started/installation.md
- https://docs.speckle.systems/developers/sdks/python/getting-started/authentication.md
- https://docs.speckle.systems/developers/sdks/python/api-reference/client.md
- https://github.com/specklesystems/specklepy
