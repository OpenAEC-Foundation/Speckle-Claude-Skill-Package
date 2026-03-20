---
name: speckle-core-transport
description: >
  Use when sending or receiving Speckle objects, configuring transports, or debugging data transfer issues.
  Prevents SQLite lock errors, auth token expiry during long transfers, and missing cache-first receive patterns.
  Covers ServerTransport, SQLiteTransport, MemoryTransport, DiskTransport, send/receive flow, caching strategy, and progress callbacks.
  Keywords: speckle transport, server transport, sqlite transport, send, receive, cache, operations, upload, download.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-core-transport

## Quick Reference

### Transport Comparison Table

| Transport | Storage | Persistent | Network | Use Case |
|-----------|---------|-----------|---------|----------|
| **ServerTransport** | Speckle Server (HTTP) | Yes (remote) | Yes | Collaborative send/receive to shared projects |
| **SQLiteTransport** | Local SQLite database | Yes (local) | No | Default local cache, offline access |
| **MemoryTransport** | In-memory dictionary | No | No | Testing, temporary pipelines, benchmarking |
| **DiskTransport** | Individual files on disk | Yes (local) | No | Project-local storage, git-tracked objects (C# only) |

### Decision Tree: Choosing the Right Transport

```
Need to share data with others?
├── YES → ServerTransport (+ SQLiteTransport as cache)
└── NO
    ├── Need persistence across restarts?
    │   ├── YES
    │   │   ├── Need git-trackable individual files? → DiskTransport (C# only)
    │   │   └── Need fast bulk read/write? → SQLiteTransport
    │   └── NO
    │       ├── Testing or benchmarking? → MemoryTransport
    │       └── Serverless / ephemeral environment? → MemoryTransport
```

### Critical Warnings

**NEVER** call `ServerTransport.get_object()` in Python -- it is NOT implemented and raises `SpeckleException`. ALWAYS use `operations.receive()` or `copy_object_and_children()` instead.

**NEVER** call `send()` with `use_default_cache=False` and an empty transport list -- this raises `SpeckleException` because there is no destination for the data.

**NEVER** rely on `MemoryTransport` for persistent storage -- all data is lost when the process exits or the transport is garbage collected.

**NEVER** call `get_all_objects()` on a large SQLiteTransport -- this loads the entire database into memory and causes memory exhaustion on large caches.

**NEVER** create a `ServerTransport` without authentication -- all Speckle Server API calls require a valid token. Construction succeeds but every operation fails.

**NEVER** omit `CancellationToken` in C# interactive applications -- without it, long send/receive operations cannot be gracefully stopped.

**NEVER** forget to call `end_write()` after manual transport writes -- batched data may not be flushed. Use `operations.send()` instead, which manages the lifecycle automatically.

**ALWAYS** use the default cache (`use_default_cache=True`) during send unless you have a specific reason not to -- without it, every receive requires a full re-download from the server.

---

## Transport Interface

All transports implement a common interface that decouples serialization from storage. The serializer writes to any transport without knowing the backend.

### Python: AbstractTransport

All Python transports inherit from `AbstractTransport` (ABC). Core methods:

| Method | Purpose |
|--------|---------|
| `save_object(id, serialized_object)` | Store one serialized object by hash |
| `get_object(id) -> Optional[str]` | Retrieve by hash, `None` if not found |
| `has_objects(id_list) -> Dict[str, bool]` | Bulk existence check |
| `begin_write()` | Signal start of write batch |
| `end_write()` | Flush pending writes |
| `save_object_from_transport(id, source)` | Copy from another transport |
| `copy_object_and_children(id, target)` | Copy object tree to target |

### C#: ITransport

The C# interface adds async support, cancellation, progress reporting, and telemetry:

| Member | Purpose |
|--------|---------|
| `SaveObject(id, serializedObject)` | Enqueue object for storage |
| `GetObject(id) -> Task<string?>` | Async retrieval by hash |
| `HasObjects(objectIds) -> Task<Dict<string, bool>>` | Async bulk existence check |
| `BeginWrite()` / `EndWrite()` | Write lifecycle control |
| `WriteComplete() -> Task` | Await completion of all queued writes |
| `CancellationToken` | Graceful cancellation support |
| `OnProgressAction` | `IProgress<ProgressArgs>` callback |
| `Elapsed` | `TimeSpan` for performance measurement |

`IBlobCapableTransport` extends `ITransport` with `BlobStorageFolder` and `SaveBlob(Blob)` for binary file support.

---

## ServerTransport

Communicates with a Speckle Server over HTTP. Primary transport for collaborative workflows.

### Python Constructor

```python
ServerTransport(
    stream_id: str,
    client: Optional[SpeckleClient] = None,   # Auth path 1
    account: Optional[Account] = None,         # Auth path 2
    token: Optional[str] = None,               # Auth path 3 (pair with url)
    url: Optional[str] = None,                 # Auth path 3 (pair with token)
    name: str = "RemoteTransport",
)
```

You MUST provide exactly one authentication path:
1. `client` -- an already-authenticated `SpeckleClient`
2. `account` -- an `Account` object containing token + server URL
3. `token` + `url` -- raw credentials

### C# Constructor

```csharp
new ServerTransport(
    ISpeckleHttp http,
    ISdkActivityFactory activityFactory,
    Account account,
    string streamId,
    int timeoutSeconds = 60,
    string? blobStorageFolder = null
)
```

Uses dependency injection for `ISpeckleHttp` and `ISdkActivityFactory`. Authentication via `Account.token`.

### Implementation Details

| Aspect | Python | C# |
|--------|--------|----|
| Batch upload size | 1 MB | Configurable via send buffer |
| `get_object()` | NOT implemented (raises exception) | Async, functional |
| Deduplication | Defers to copy operations | Calls `HasObjects()` before upload |
| Background sending | No | Dedicated `SendingThreadMain()` thread |
| Blob support | No | Yes (`IBlobCapableTransport`) |

### Server API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/objects/{stream_id}/{id}/single` | Download single object |
| `/api/getobjects/{stream_id}` | Batch download multiple objects |

---

## SQLiteTransport

Persistent local storage using SQLite. Serves as the default local cache for all Speckle operations.

### Constructors

**Python:**
```python
SQLiteTransport(
    base_path: str = None,       # Defaults to Speckle app data path
    app_name: str = None,
    scope: str = None,           # Database filename (default: "Objects.db")
    max_batch_size_mb: float = None,
)
```

**C#:**
```csharp
new SQLiteTransport(
    string? basePath = null,          // Defaults to SpecklePathProvider
    string? applicationName = null,   // Default: "Speckle"
    string? scope = null              // Default: "Data"
)
```

Path construction: `{basePath}/{applicationName}/{scope}.db`

### Default Data Paths Per OS

| OS | Default Path |
|----|-------------|
| **Windows** | `%APPDATA%\Speckle` (typically `C:\Users\{user}\AppData\Roaming\Speckle`) |
| **macOS** | `~/.config/Speckle` |
| **Linux** | `$XDG_DATA_HOME/Speckle` or `~/.local/share/Speckle` |

Default cache database: `{speckle_dir}/Data.db` (C#) or `{speckle_dir}/Objects.db` (Python).

### Write Optimization

- Python: Accumulates objects in `_current_batch`, flushes via `executemany()` with `INSERT OR IGNORE` when batch size exceeds `max_batch_size_mb`
- C#: Uses `ConcurrentQueue` with a 500ms auto-flush timer, processes up to 1,000 items per transaction

---

## MemoryTransport

Stores objects in an in-memory dictionary. Simplest transport.

**Python:** `Dict[str, str]` backing store. `save_object_from_transport()` and `copy_object_and_children()` are NOT implemented.

**C#:** `ConcurrentDictionary<string, string>` backing store. Full `ITransport` implementation including async methods.

**Use cases:** Unit testing, temporary pipelines, serverless functions, benchmarking serialization speed.

**Limitation:** No size limits -- large datasets consume proportional memory. All data lost on garbage collection.

---

## DiskTransport (C# Only)

Stores each object as a separate file on the filesystem. Useful for project-local storage, git-tracked objects, network drive sharing, and human-readable debugging.

For project-local SQLite storage (better performance for large datasets), use `SQLiteTransport` with a custom `basePath` instead.

---

## Send Flow

### Python: `operations.send()`

```python
send(
    base: Base,
    transports: Optional[List[AbstractTransport]] = None,
    use_default_cache: bool = True,
) -> str  # Returns root object hash
```

**Flow:**
1. If `use_default_cache=True` → prepend a `SQLiteTransport` to the transport list
2. If `use_default_cache=False` AND no transports → raise `SpeckleException`
3. Create `BaseObjectSerializer` with all transports
4. Serialize root object recursively -- each finished object is immediately sent to ALL transports
5. String representations are garbage collected after sending (memory optimization)
6. Return root object hash

### C#: `Operations.Send()`

```csharp
async Task<(string rootObjId, IReadOnlyDictionary<string, ObjectReference> convertedReferences)> Send(
    Base value,
    IReadOnlyCollection<ITransport> transports,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

**Flow:**
1. Validate: `value` not null, `transports` not empty
2. Configure each transport with progress action and cancellation token
3. Call `BeginWrite()` on all transports
4. Serialize via `SpeckleObjectSerializer`
5. Call `EndWrite()` on all transports (in `finally` block)
6. Return tuple of (root hash, converted references dictionary)

**Multi-transport:** Objects are written to ALL provided transports simultaneously.

---

## Receive Flow

### Python: `operations.receive()`

```python
receive(
    obj_id: str,
    remote_transport: Optional[AbstractTransport] = None,
    local_transport: Optional[AbstractTransport] = None,
) -> Base
```

### C#: `Operations.Receive()`

```csharp
async Task<Base> Receive(
    string objectId,
    ITransport? remoteTransport = null,
    ITransport? localTransport = null,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

### Cache-First Strategy (Both SDKs)

1. If `localTransport` is `None` → create default `SQLiteTransport`
2. Check local transport for the object
3. If found locally → deserialize directly from cache
4. If NOT found → call `copy_object_and_children()` on remote transport:
   - Download root object
   - Check which children exist locally
   - Download only missing children in batches
   - Write all to local transport
5. Deserialize from local transport
6. Return reconstructed `Base` object

The local transport is ALWAYS checked first. After a remote fetch, objects are cached locally for future use.

---

## Caching Strategy

### Content-Addressed Immutability

Speckle objects are content-addressed: every object's `id` is a SHA256 hash of its content. This means:

- An object with a given `id` ALWAYS has the same content
- Cached data is NEVER stale -- objects are immutable
- New versions of conceptual objects (e.g., a modified wall) have DIFFERENT ids
- No cache invalidation logic is needed

### Cache Growth

The cache grows monotonically -- there is no built-in garbage collection or LRU eviction. Users can manually delete the cache database (it is recreated on next use), but all previously cached objects must be re-downloaded.

### Deduplication During Send (C#)

1. Serialize all objects locally
2. Call `HasObjects()` on the server with the list of object ids
3. Upload only objects the server does not already have

Sending the same data twice transmits only the delta. A model where 5% of objects changed uploads only that 5%.

---

## Progress Reporting

### C# -- IProgress<ProgressArgs>

```csharp
var progress = new Progress<ProgressArgs>(args =>
{
    Console.WriteLine($"{args.ProgressEvent}: {args.Count}");
});
await Operations.Send(data, transports, onProgressAction: progress);
```

### Python -- Transport Object Count

```python
transport = ServerTransport(stream_id="...", client=client)
hash = send(my_object, transports=[transport])
# After send: transport.saved_obj_count contains the number of objects sent
```

---

## Reference Links

- [references/methods.md](references/methods.md) -- API signatures for all transport types in Python and C#
- [references/examples.md](references/examples.md) -- Working code examples for send/receive with transports
- [references/anti-patterns.md](references/anti-patterns.md) -- Transport misuse patterns with fixes

### Official Sources

- https://speckle.guide/dev/transports.html
- https://speckle.guide/dev/dotnet.html
- https://speckle.guide/dev/python.html
- https://github.com/specklesystems/specklepy
- https://github.com/specklesystems/speckle-sharp-sdk
