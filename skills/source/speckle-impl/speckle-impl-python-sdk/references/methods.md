# methods.md — SpecklePy API Signatures

## SpeckleClient

### Constructor

```python
SpeckleClient(
    host: str = "app.speckle.systems",
    use_ssl: bool = True,
    verify_certificate: bool = True,
) -> None
```

### Authentication Methods

```python
def authenticate_with_token(token: str) -> None
```
Authenticates using a personal access token. Creates a synchronous GraphQL entrypoint internally.

```python
def authenticate_with_account(account: Account) -> None
```
Authenticates using an Account object from locally stored credentials.

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `account` | `Account` | Currently authenticated account |
| `project` | `ProjectResource` | Project operations |
| `model` | `ModelResource` | Model operations |
| `version` | `VersionResource` | Version operations |
| `active_user` | `ActiveUserResource` | Authenticated user operations |
| `other_user` | `OtherUserResource` | Other user lookup |
| `server` | `ServerResource` | Server metadata |
| `subscription` | `SubscriptionResource` | Real-time subscriptions |
| `workspace` | `WorkspaceResource` | Workspace management |
| `project_invite` | `ProjectInviteResource` | Invitation management |
| `file_import` | `FileImportResource` | File import operations |

### Raw Query

```python
def execute_query(query: str) -> Dict
```
Executes an arbitrary GraphQL query string. Returns the response as a dictionary.

---

## Credentials Module

```python
from specklepy.api.credentials import get_default_account, get_local_accounts
```

```python
def get_default_account() -> Optional[Account]
```
Returns the default account from local Speckle Manager data, or `None` if no default is set.

```python
def get_local_accounts() -> List[Account]
```
Returns all locally stored accounts.

### Account Object

| Property | Type | Description |
|----------|------|-------------|
| `account.token` | `str` | Personal access token |
| `account.isDefault` | `bool` | Whether this is the default account |
| `account.serverInfo.url` | `str` | Server URL |
| `account.serverInfo.name` | `str` | Server display name |
| `account.serverInfo.company` | `str` | Server company |
| `account.userInfo.id` | `str` | User ID |
| `account.userInfo.name` | `str` | User display name |
| `account.userInfo.email` | `str` | User email |

---

## Resource Modules

### ProjectResource (`client.project`)

```python
def create(input: ProjectCreateInput) -> Project
def get(project_id: str) -> Project
```

**ProjectCreateInput:**
```python
from specklepy.core.api.inputs.project_inputs import ProjectCreateInput
from specklepy.core.api.enums import ProjectVisibility

ProjectCreateInput(
    name: str,
    description: Optional[str] = None,
    visibility: ProjectVisibility = ProjectVisibility.PRIVATE,
)
```

**ProjectVisibility enum:** `PRIVATE`, `UNLISTED`, `PUBLIC`

### ModelResource (`client.model`)

```python
def create(input: CreateModelInput) -> Model
```

**CreateModelInput:**
```python
from specklepy.core.api.inputs.model_inputs import CreateModelInput

CreateModelInput(
    project_id: str,
    name: str,
    description: Optional[str] = None,
)
```

### VersionResource (`client.version`)

```python
def create(input: CreateVersionInput) -> Version
def get(project_id: str, version_id: str) -> Version
```

**CreateVersionInput:**
```python
from specklepy.core.api.inputs.version_inputs import CreateVersionInput

CreateVersionInput(
    project_id: str,
    model_id: str,
    object_id: str,
    message: Optional[str] = None,
)
```

**Version object:**
| Property | Type | Description |
|----------|------|-------------|
| `version.id` | `str` | Version ID |
| `version.referenced_object` | `str` | Root object hash |
| `version.message` | `str` | Version message |

### ActiveUserResource (`client.active_user`)

Operations on the authenticated user's profile and project list.

### ServerResource (`client.server`)

Server information and metadata retrieval.

---

## Operations Module

```python
from specklepy.api import operations
```

### send()

```python
def send(
    base: Base,
    transports: Optional[List[AbstractTransport]] = None,
    use_default_cache: bool = True,
) -> str
```

**Parameters:**
- `base` — root Base object to serialize and send
- `transports` — destination transport(s); also accepts a single transport
- `use_default_cache` — prepend local SQLiteTransport for caching (default: `True`)

**Returns:** root object hash string (the object ID).

**Raises:** `SpeckleException` if `transports` is None/empty AND `use_default_cache` is `False`.

### receive()

```python
def receive(
    obj_id: str,
    remote_transport: Optional[AbstractTransport] = None,
    local_transport: Optional[AbstractTransport] = None,
) -> Base
```

**Parameters:**
- `obj_id` — hash of the root object to retrieve
- `remote_transport` — source transport (typically ServerTransport)
- `local_transport` — cache transport (defaults to SQLiteTransport if None)

**Returns:** deserialized Base object with all nested children.

### serialize()

```python
def serialize(
    base: Base,
    write_transports: Optional[List[AbstractTransport]] = None,
) -> str
```

Without transports: produces inline JSON (no detaching/chunking).
With transports: detaching and chunking occur normally.

### deserialize()

```python
def deserialize(
    obj_string: str,
    read_transport: Optional[AbstractTransport] = None,
) -> Base
```

Without transport: defaults to SQLiteTransport for resolving detached references.

---

## ServerTransport

```python
from specklepy.transports.server import ServerTransport
```

### Constructor

```python
ServerTransport(
    stream_id: str,
    client: Optional[SpeckleClient] = None,
    account: Optional[Account] = None,
    token: Optional[str] = None,
    url: Optional[str] = None,
    name: str = "RemoteTransport",
) -> None
```

**Authentication (provide ONE):**
1. `client` — already-authenticated SpeckleClient
2. `account` — Account object with token and server URL
3. `token` + `url` — raw credentials

**Raises:** `SpeckleException` if no authentication is provided.

### Key Methods

| Method | Description |
|--------|-------------|
| `begin_write()` | Resets object counter, prepares for batch writes |
| `end_write()` | Flushes all pending batch operations |
| `save_object(id, serialized_object)` | Queues object for batch upload |
| `get_object(id)` | NOT IMPLEMENTED — raises `SpeckleException` |
| `has_objects(id_list)` | Returns all IDs mapped to `False` |
| `copy_object_and_children(id, target_transport)` | Downloads root + children to target |

---

## Base Class

```python
from specklepy.objects import Base
```

### Constructor

```python
Base(**kwargs) -> None
```

Accepts arbitrary keyword arguments as dynamic properties.

### Identity Properties

| Property | Type | Description |
|----------|------|-------------|
| `speckle_type` | `str` | Protected type identifier. CANNOT be changed after class definition. |
| `applicationId` | `Optional[str]` | Native application element reference |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get_id()` | `str` | Content hash. WARNING: serializes entire object. |
| `get_member_names()` | `List[str]` | All properties (typed + dynamic) |
| `get_typed_member_names()` | `List[str]` | Class-defined properties only |
| `get_dynamic_member_names()` | `List[str]` | Runtime-added properties only |

---

## Geometry Classes

```python
from specklepy.objects.geometry import Point, Line, Polyline, Mesh
```

### Point

```python
Point(x: float = 0.0, y: float = 0.0, z: float = 0.0)
```

### Line

```python
Line(start: Point, end: Point)
```

### Polyline

Constructed from a flat list of coordinate values.

### Mesh

Large geometry structure with `vertices`, `faces`, `colors`, and `texture_coordinates` as large arrays. Supports automatic detachment and chunking.

---

## SQLiteTransport

```python
from specklepy.transports.sqlite import SQLiteTransport
```

### Constructor

```python
SQLiteTransport(
    base_path: Optional[str] = None,
    app_name: Optional[str] = None,
    scope: Optional[str] = None,
    max_batch_size_mb: Optional[float] = None,
) -> None
```

Uses `speckle_path_provider.user_application_data_path()` when `base_path` is None.

---

## MemoryTransport

```python
from specklepy.transports.memory import MemoryTransport
```

### Constructor

```python
MemoryTransport(name: str = "Memory") -> None
```

Stores objects in `self.objects: Dict[str, str]`. All data lost on garbage collection.
