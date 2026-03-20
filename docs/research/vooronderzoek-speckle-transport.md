# Vooronderzoek: Speckle Transport System

> Status: RAW — not yet processed into core files
> Date: 2026-03-20
> Sources: Speckle official docs, SpecklePy source code, Speckle.Sdk source code

---

## 1. Overview: What Are Transports?

Transports are the persistence layer of the Speckle ecosystem. They take serialized Speckle objects from memory and persist them to a specific storage backend — or retrieve them back. Every send and receive operation in Speckle flows through one or more transports.

The transport abstraction decouples the serialization logic from the storage mechanism. The serializer does not know or care whether objects end up in a local SQLite database, on a remote Speckle Server, in memory, or on a network drive. This enables powerful patterns: sending to multiple destinations simultaneously, using local caches transparently, and building custom storage backends for specialized workflows.

The transport system is implemented in both the C# SDK (`Speckle.Sdk`) and the Python SDK (`SpecklePy`), with equivalent semantics but language-appropriate implementations.

## 2. The Transport Interface

### 2.1 Python: AbstractTransport

All Python transports inherit from `AbstractTransport`, an abstract base class (ABC) that defines the contract:

```python
from abc import ABC, abstractmethod
from typing import Dict, List, Optional

class AbstractTransport(ABC):

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable identifier for this transport."""
        pass

    @abstractmethod
    def begin_write(self) -> None:
        """Signals that writes are about to begin. Used for batch initialization."""
        pass

    @abstractmethod
    def end_write(self) -> None:
        """Signals that no more items will be written. Used for flushing batches."""
        pass

    @abstractmethod
    def save_object(self, id: str, serialized_object: str) -> None:
        """Saves a single serialized object identified by its hash."""
        pass

    @abstractmethod
    def save_object_from_transport(
        self, id: str, source_transport: "AbstractTransport"
    ) -> None:
        """Saves an object by retrieving it from another transport."""
        pass

    @abstractmethod
    def get_object(self, id: str) -> Optional[str]:
        """Retrieves a serialized object by hash. Returns None if not found."""
        pass

    @abstractmethod
    def has_objects(self, id_list: List[str]) -> Dict[str, bool]:
        """Checks presence of multiple objects. Returns {id: bool} mapping."""
        pass

    @abstractmethod
    def copy_object_and_children(
        self, id: str, target_transport: "AbstractTransport"
    ) -> str:
        """Copies a parent object and all its children to the target transport."""
        pass
```

### 2.2 C#: ITransport Interface

The C# interface is richer, with additional support for async operations, progress reporting, cancellation, and telemetry:

```csharp
public interface ITransport
{
    // Identity
    string TransportName { get; }
    Dictionary<string, object> TransportContext { get; }

    // Telemetry
    TimeSpan Elapsed { get; }

    // Control
    CancellationToken CancellationToken { get; set; }
    IProgress<ProgressArgs>? OnProgressAction { get; set; }

    // Write lifecycle
    void BeginWrite();
    void EndWrite();
    Task WriteComplete();

    // Object operations
    void SaveObject(string id, string serializedObject);
    Task<string?> GetObject(string id);
    Task<string> CopyObjectAndChildren(string id, ITransport targetTransport);
    Task<Dictionary<string, bool>> HasObjects(IReadOnlyList<string> objectIds);
}
```

Additionally, `IBlobCapableTransport` extends `ITransport` with blob storage:
```csharp
public interface IBlobCapableTransport : ITransport
{
    string BlobStorageFolder { get; }
    void SaveBlob(Blob obj);
}
```

Key differences from Python:
- `GetObject`, `CopyObjectAndChildren`, and `HasObjects` are async (`Task<T>`)
- `WriteComplete()` provides an awaitable signal for when all queued writes finish
- Built-in `CancellationToken` support for graceful cancellation
- `IProgress<ProgressArgs>` for progress reporting to UI layers
- `TimeSpan Elapsed` for performance measurement

All methods may throw `TransportException`, `OperationCanceledException`, or `ArgumentException`.

## 3. ServerTransport

The `ServerTransport` communicates with a Speckle Server instance over HTTP. It is the primary transport for collaborative workflows — sending data to and receiving data from shared Speckle projects.

### 3.1 Python ServerTransport

```python
class ServerTransport(AbstractTransport):
    def __init__(
        self,
        stream_id: str,
        client: Optional[SpeckleClient] = None,
        account: Optional[Account] = None,
        token: Optional[str] = None,
        url: Optional[str] = None,
        name: str = "RemoteTransport",
    ) -> None
```

**Authentication**: You MUST provide one of three authentication approaches:
1. A `SpeckleClient` object (already authenticated)
2. An `Account` object (contains token + server URL)
3. A `token` + `url` pair (raw credentials)

If none are provided, construction fails with a `SpeckleException`.

**Key implementation details**:
- Uses a `BatchSender` internally with a 1MB maximum batch size for uploads
- `begin_write()` resets the object counter
- `end_write()` flushes all pending batch operations
- `save_object(id, serialized_object)` queues the object for batch upload
- `get_object(id)` is NOT implemented — raises `SpeckleException` (objects are retrieved via `copy_object_and_children` instead)
- `has_objects(id_list)` returns all IDs mapped to `False` (defers to server-side checks during copy operations)
- `copy_object_and_children(id, target_transport)` performs the actual download: fetches the root object, checks the target transport for existing children, retrieves missing children via batch API, and writes all objects to the target

**API Endpoints**:
- `/objects/{stream_id}/{id}/single` — download a single object
- `/api/getobjects/{stream_id}` — batch download multiple objects

### 3.2 C# ServerTransport

```csharp
public class ServerTransport : IServerTransport, IBlobCapableTransport
{
    public ServerTransport(
        ISpeckleHttp http,
        ISdkActivityFactory activityFactory,
        Account account,
        string streamId,
        int timeoutSeconds = 60,
        string? blobStorageFolder = null
    )
}
```

**Key implementation details**:
- Uses dependency injection (`ISpeckleHttp`, `ISdkActivityFactory`) for testability
- Authentication via `Account.token` (bearer token)
- Maintains a `_sendBuffer` list that accumulates objects until the batch threshold
- Runs a dedicated `SendingThreadMain()` background thread for processing uploads
- Implements deduplication: calls `HasObjects()` on the server before uploading to skip objects that already exist
- Separates blob uploads from object uploads
- `BeginWrite()` starts the background sending thread
- `WriteComplete()` polls until all queued data has been uploaded
- `EndWrite()` terminates the sending thread

**Server API methods** (via `ParallelServerApi`):
- `DownloadSingleObject()` / `DownloadObjects()` — retrieve objects
- `UploadObjects()` / `UploadBlobs()` — send objects/files
- `HasObjects()` / `HasBlobs()` — check existence for deduplication
- `DownloadBlobs()` — retrieve binary files

## 4. SQLiteTransport

The `SQLiteTransport` provides persistent local storage using SQLite databases. It serves as the default local cache for all Speckle operations, ensuring that once an object has been downloaded, it does not need to be fetched from the server again.

### 4.1 Python SQLiteTransport

```python
class SQLiteTransport(AbstractTransport):
    def __init__(
        self,
        base_path: str = None,
        app_name: str = None,
        scope: str = None,
        max_batch_size_mb: float = None,
    ) -> None
```

**Database path resolution**: Uses `speckle_path_provider.user_application_data_path()` for the base path when not specified. The database file is named using the `scope` parameter (default: `"Objects.db"`).

**Write behavior**:
- `save_object()` accumulates objects in `_current_batch` (list of tuples)
- Tracks `_current_batch_size` in bytes
- When batch size exceeds `max_batch_size_mb`, flushes to SQLite via `executemany()` with `INSERT OR IGNORE` (idempotent writes)
- `begin_write()` and `end_write()` manage transaction lifecycle
- Tracks `saved_obj_count` for progress reporting

**Read behavior**:
- `get_object(id)` retrieves a single object by hash
- `has_objects(id_list)` performs bulk existence checks, returning `{id: bool}` mapping
- `get_all_objects()` fetches the entire database (WARNING: unsafe for large datasets)

**Connection management**:
- `__check_connection()` auto-reconnects if the connection drops
- `close()` explicitly terminates the connection
- `__del__` ensures cleanup on garbage collection

### 4.2 C# SQLiteTransport

```csharp
public class SQLiteTransport : ITransport, IDisposable, IBlobCapableTransport
{
    public SQLiteTransport(
        string? basePath = null,
        string? applicationName = null,
        string? scope = null
    )
}
```

**Path construction**: `{basePath}/{applicationName}/{scope}.db`

Defaults:
- `basePath` → `SpecklePathProvider.UserApplicationDataPath()`
- `applicationName` → `"Speckle"`
- `scope` → `"Data"`

**Batch write optimization**:
- Uses a `ConcurrentQueue` to buffer writes
- `ConsumeQueue()` processes up to 1,000 items per transaction
- A 500ms timer triggers automatic queue consumption
- `SaveObjectSync()` available for direct synchronous writes

**Key methods**:
- `SaveObject(id, serializedObject)` — enqueues for batch insert
- `GetObject(id)` — retrieves with cancellation support
- `HasObjects(objectIds)` — bulk existence check
- `DeleteObject(id)` / `UpdateObject(id, serialized)` — modify records
- `GetAllObjects()` — returns everything (use with caution)

### 4.3 Local Data Paths Per Operating System

The default Speckle data directory varies by platform:

| OS | Default Path | Environment Variable Override |
|----|-------------|-------------------------------|
| **Windows** | `%APPDATA%\Speckle` (typically `C:\Users\{user}\AppData\Roaming\Speckle`) | `APPDATA` |
| **macOS** | `~/.config/Speckle` | — |
| **Linux** | `$XDG_DATA_HOME/Speckle` or `~/.local/share/Speckle` | `XDG_DATA_HOME` |

Within this directory, the default SQLite cache database lives at:
- `{speckle_dir}/Data.db` (default scope)
- `{speckle_dir}/Objects.db` (alternative scope name)

Account data and authentication tokens are also stored in this directory, managed by the Speckle Manager application.

## 5. MemoryTransport

The `MemoryTransport` stores objects in an in-memory dictionary. It is the simplest transport and is used for testing, temporary operations, and serverless/containerized environments where disk I/O should be avoided.

### 5.1 Python MemoryTransport

```python
class MemoryTransport(AbstractTransport):
    def __init__(self, name: str = "Memory") -> None:
        self._name = name
        self.objects: Dict[str, str] = {}
        self.saved_object_count: int = 0

    def save_object(self, id: str, serialized_object: str) -> None:
        self.objects[id] = serialized_object
        self.saved_object_count += 1

    def get_object(self, id: str) -> Optional[str]:
        return self.objects.get(id, None)

    def has_objects(self, id_list: List[str]) -> Dict[str, bool]:
        return {id: id in self.objects for id in id_list}

    def begin_write(self) -> None:
        self.saved_object_count = 0

    def end_write(self) -> None:
        pass  # no-op
```

**Limitations**:
- `save_object_from_transport()` — NOT implemented, raises error
- `copy_object_and_children()` — NOT implemented, raises error
- All data is lost when the transport is garbage collected
- No size limits — large datasets will consume proportional memory

### 5.2 C# MemoryTransport

Similar implementation using a `ConcurrentDictionary<string, string>`. Implements the full `ITransport` interface including async methods.

### 5.3 Use Cases
- **Unit testing**: Create objects, serialize, verify without disk or network
- **Temporary pipelines**: Process data in memory without persistence
- **Serverless functions**: Lambda/Cloud Functions where disk access is limited
- **Benchmarking**: Measure serialization speed without I/O overhead

## 6. DiskTransport

The `DiskTransport` stores each object as a separate file on the filesystem. Available in the C# SDK.

### 6.1 Use Cases
- **Project-local storage**: Store Speckle data alongside source files (e.g., `.speckle/` directory in a project)
- **Version control integration**: Each object file can be tracked by git
- **Network drives**: Share Speckle data via mounted network storage
- **Inspection**: Human-readable individual object files for debugging

### 6.2 Custom Path Example
```csharp
var transport = new SQLiteTransport(basePath: @"{projectPath}/.speckle");
```

While DiskTransport uses individual files, the SQLiteTransport with a custom `basePath` achieves similar project-local storage with better performance for large datasets.

## 7. MongoDBTransport

Referenced in the C# SDK documentation as an additional transport option for NoSQL database storage. This enables integration with MongoDB for scenarios requiring:
- Horizontal scaling of object storage
- Integration with existing MongoDB infrastructure
- Query capabilities beyond hash-based lookup

## 8. The Send Flow

The `send()` / `Operations.Send()` function is the primary entry point for persisting Speckle data. It serializes an object tree and writes the result to one or more transports.

### 8.1 Python send()

```python
def send(
    base: Base,
    transports: Optional[List[AbstractTransport]] = None,
    use_default_cache: bool = True,
) -> str
```

**Parameters**:
- `base` — the root object to send
- `transports` — list of destination transports (accepts a single transport too, automatically wraps in list)
- `use_default_cache` — when `True`, automatically prepends a `SQLiteTransport` to the transport list for local caching

**Flow**:
1. If `use_default_cache` is `True`, create a `SQLiteTransport` and prepend it to the transports list
2. If `use_default_cache` is `False` AND no transports provided → raise `SpeckleException`
3. Create a `BaseObjectSerializer` with the transport list
4. Serialize the root object — this triggers recursive traversal of the entire object tree
5. As each object finishes serialization, it is immediately sent to ALL transports (its string representation is then garbage collected to reduce memory pressure)
6. Return the root object's `id` (hash)

**Return value**: The hash string of the root object — this is what you store as a reference (e.g., in a commit) to retrieve the data later.

### 8.2 C# Operations.Send()

```csharp
public async Task<(string rootObjId, IReadOnlyDictionary<string, ObjectReference> convertedReferences)> Send(
    Base value,
    IReadOnlyCollection<ITransport> transports,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

**Parameters**:
- `value` — the root Base object to send
- `transports` — collection of destination transports (MUST NOT be empty)
- `onProgressAction` — optional progress callback
- `cancellationToken` — optional cancellation support

**Flow**:
1. Validate: `value` must not be null, `transports` must not be empty
2. Configure each transport with progress action and cancellation token
3. Call `BeginWrite()` on all transports
4. Create `SpeckleObjectSerializer` with transports and cancellation support
5. Serialize the root object via `SerializerSend()`
6. Record elapsed time and performance metrics
7. Call `EndWrite()` on all transports (in finally block)
8. Return tuple of (root object hash, dictionary of converted references)

**Multi-transport behavior**: Objects are written to ALL provided transports simultaneously. This enables patterns like:
```csharp
var id = await Operations.Send(
    myData,
    transports: new ITransport[] { serverTransport, sqliteTransport, diskTransport },
    useDefaultCache: false
);
```

**Memory optimization**: "Whenever an object finishes serialisation, it's sent to a transport for storage... its string representation gets garbage collected." This prevents the entire serialized tree from existing in memory simultaneously.

### 8.3 Error Handling During Send

C# distinguishes between fatal and non-fatal exceptions:
- `OperationCanceledException` and `SpeckleException` are re-thrown directly
- All other exceptions are wrapped in `SpeckleException`
- Transport cleanup (`EndWrite()`) runs in the finally block regardless of success/failure

Python raises `SpeckleException` for configuration errors (no transports and no cache).

## 9. The Receive Flow

The `receive()` / `Operations.Receive()` function retrieves and deserializes a Speckle object by its hash.

### 9.1 Python receive()

```python
def receive(
    obj_id: str,
    remote_transport: Optional[AbstractTransport] = None,
    local_transport: Optional[AbstractTransport] = None,
) -> Base
```

**Parameters**:
- `obj_id` — the hash of the root object to retrieve
- `remote_transport` — the source transport (typically ServerTransport)
- `local_transport` — the cache transport (defaults to SQLiteTransport if not provided)

**Flow**:
1. If `local_transport` is None, create a default `SQLiteTransport`
2. Check if the object exists in `local_transport` (the cache)
3. If found locally → deserialize directly from cache
4. If NOT found locally → fetch from `remote_transport` via `copy_object_and_children()`, which:
   a. Downloads the root object from the remote
   b. Checks which children already exist in the local transport
   c. Downloads only the missing children in batches
   d. Writes all downloaded objects to the local transport
5. Deserialize from the local transport using `BaseObjectSerializer`
6. Return the reconstructed `Base` object

**Cache-first strategy**: The local transport is ALWAYS checked first. Only on cache miss does the system contact the remote. After a remote fetch, objects are written to the local cache for future use.

### 9.2 C# Operations.Receive()

```csharp
public async Task<Base> Receive(
    string objectId,
    ITransport? remoteTransport = null,
    ITransport? localTransport = null,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

**Flow**:
1. If `localTransport` is null, use default `SQLiteTransport` (via `UseDefaultTransportIfNull()`)
2. Configure both transports with progress callbacks and cancellation tokens
3. Create `SpeckleObjectDeserializer` with local transport as read source
4. Attempt retrieval from local transport first
5. If not found locally, fall back to remote transport:
   a. Call `CopyObjectAndChildren(objectId, localTransport)` on the remote
   b. This downloads root + all children to local cache
6. Deserialize from local transport
7. Return the deserialized `Base` object

**Important**: Only ONE transport serves as the data source during receive. The remote is used only as a fallback when the local cache misses.

## 10. Serialization and Deserialization

Beyond send/receive (which combine serialization with transport), both SDKs expose raw serialization functions.

### 10.1 Python serialize() / deserialize()

```python
def serialize(
    base: Base,
    write_transports: List[AbstractTransport] | None = None,
) -> str
```
Serializes a Base object to JSON. When `write_transports` is None or empty, serialization happens WITHOUT detaching or chunking — the entire object tree is inlined. When transports are provided, detaching and chunking occur normally.

```python
def deserialize(
    obj_string: str,
    read_transport: Optional[AbstractTransport] = None,
) -> Base
```
Deserializes a JSON string back into a Base object. When `read_transport` is provided, referenced (detached) children are fetched from it. When None, defaults to SQLiteTransport.

### 10.2 C# Serialize / DeserializeAsync

```csharp
public string Serialize(Base value, CancellationToken cancellationToken = default)
```
Synchronous. Returns JSON string representation.

```csharp
public async Task<Base> DeserializeAsync(string value, CancellationToken cancellationToken = default)
```
Asynchronous. Returns the deserialized Base object. Handles `ArgumentNullException`, `JsonReaderException`, `SpeckleException`, and `TransportException`.

## 11. Caching Strategy and Invalidation

### 11.1 How Caching Works

Speckle's caching is built on content-addressing. Since every object's `id` is a hash of its content:
- An object with a given `id` ALWAYS has the same content
- Objects NEVER need invalidation — they are immutable
- If an object exists in the cache, it is guaranteed to be correct
- New versions of the same conceptual object (e.g., a modified wall) have DIFFERENT ids

This is fundamentally different from traditional caching where you must worry about stale data. In Speckle, cached data is NEVER stale.

### 11.2 Cache Population

The cache is populated automatically during:
1. **Send operations** (when `use_default_cache=True`): All serialized objects are written to the local SQLiteTransport AND the target transport(s)
2. **Receive operations**: Objects fetched from remote are written to the local SQLiteTransport for future use
3. **Manual operations**: Users can explicitly write to any transport

### 11.3 Cache Location

The default cache database is at:
- Windows: `%APPDATA%\Speckle\Data.db`
- macOS: `~/.config/Speckle/Data.db`
- Linux: `$XDG_DATA_HOME/Speckle/Data.db` or `~/.local/share/Speckle/Data.db`

### 11.4 Cache Growth

Since objects are never invalidated, the cache grows monotonically. There is no built-in garbage collection or LRU eviction. Over time, heavy Speckle users accumulate large cache databases. Users can manually delete the cache database — it will be recreated on next use, but previously cached objects will need to be re-downloaded.

### 11.5 Deduplication in Transport

During send to a ServerTransport, the C# implementation performs deduplication:
1. Serialize all objects locally
2. Call `HasObjects()` on the server with the list of object ids
3. Upload only the objects the server does not already have

This means sending the same data twice only transmits the delta. Sending data that partially overlaps with existing server data (e.g., a model where only 5% of objects changed) only uploads the 5% that changed.

## 12. Progress Reporting

### 12.1 C# Progress

The C# SDK uses `IProgress<ProgressArgs>` for reporting:
```csharp
var progress = new Progress<ProgressArgs>(args =>
{
    Console.WriteLine($"{args.ProgressEvent}: {args.Count}");
});

await Operations.Send(data, transports, onProgressAction: progress);
```

Both send and receive operations report progress through this mechanism.

### 12.2 Python Progress

The Python SDK tracks progress via `saved_obj_count` on transport instances:
```python
transport = ServerTransport(stream_id="...", client=client)
# After send, check transport.saved_obj_count
```

## 13. Custom Transport Development

Both SDKs support creating custom transports by implementing the interface.

### 13.1 Python Custom Transport

```python
class S3Transport(AbstractTransport):
    @property
    def name(self):
        return "S3"

    def save_object(self, id: str, serialized_object: str) -> None:
        # Write to S3 bucket
        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=f"objects/{id}",
            Body=serialized_object.encode()
        )

    def get_object(self, id: str) -> Optional[str]:
        # Read from S3 bucket
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=f"objects/{id}")
            return response['Body'].read().decode()
        except:
            return None

    # ... implement remaining abstract methods
```

### 13.2 C# Custom Transport

Implement `ITransport` (or `IBlobCapableTransport` for file support). The SDK documentation explicitly encourages this for custom backends: S3, Azure Blob Storage, network drives, or proprietary systems.

---

## Anti-Patterns and Common Mistakes

### A-001: Not Using Default Cache During Send
**Mistake**: Calling `send(base, transports=[server_transport], use_default_cache=False)`.
**Why it's wrong**: Without local caching, every receive operation must fetch ALL objects from the server, even ones you just sent. This wastes bandwidth and time.
**Correct approach**: ALWAYS use `use_default_cache=True` (the default) unless you have a specific reason not to (e.g., ephemeral serverless environment).

### A-002: Calling send() Without Any Transport
**Mistake**: `send(base, transports=None, use_default_cache=False)`.
**Why it's wrong**: This raises a `SpeckleException` — there is nowhere to write the data.
**Correct approach**: Always provide at least one transport, OR leave `use_default_cache=True` to use the local SQLite cache.

### A-003: Using get_object() on ServerTransport (Python)
**Mistake**: Calling `server_transport.get_object(id)` to retrieve a single object.
**Why it's wrong**: In the Python SDK, `ServerTransport.get_object()` is NOT implemented and raises `SpeckleException`. The server transport is designed for bulk operations via `copy_object_and_children()`.
**Correct approach**: Use `operations.receive(obj_id, remote_transport=server_transport)` which handles the copy-to-local-cache flow internally.

### A-004: Forgetting to Call end_write()
**Mistake**: Saving objects to a transport but not calling `end_write()` before reading them back.
**Why it's wrong**: Transports use batch writes. Without `end_write()`, the last batch may not be flushed. The `Operations.Send()` / `operations.send()` functions handle this automatically, but manual transport usage requires explicit lifecycle management.
**Correct approach**: ALWAYS call `begin_write()` before writes and `end_write()` after the last write. Or better yet, use the `send()` function which manages the lifecycle automatically.

### A-005: Assuming MemoryTransport Persists Data
**Mistake**: Storing important data only in a MemoryTransport and expecting it to survive process restarts.
**Why it's wrong**: MemoryTransport is an in-memory dictionary. All data is lost when the process exits or the transport is garbage collected.
**Correct approach**: Use MemoryTransport only for testing, temporary operations, or as a secondary transport alongside a persistent one.

### A-006: Not Handling Authentication on ServerTransport
**Mistake**: Creating a `ServerTransport` without providing any authentication.
**Why it's wrong**: All Speckle Server API calls require authentication. The transport will fail on first operation.
**Correct approach**: ALWAYS provide authentication via one of the three methods: `SpeckleClient`, `Account` object, or `token` + `url` pair.

### A-007: Deleting the SQLite Cache and Expecting No Impact
**Mistake**: Deleting `%APPDATA%\Speckle\Data.db` to save disk space without understanding the consequences.
**Why it's wrong**: While safe (the database is recreated automatically), ALL previously cached objects are lost. The next receive operation for any previously-fetched data will require a full re-download from the server.
**Correct approach**: Delete the cache only when disk space is critical. Consider that re-downloading large models is significantly slower than reading from local cache.

### A-008: Using SQLiteTransport.get_all_objects() on Large Databases
**Mistake**: Calling `get_all_objects()` on a cache database with millions of objects.
**Why it's wrong**: This loads the entire database into memory. For large caches (multiple GB), this causes memory exhaustion.
**Correct approach**: Use `get_object(id)` for specific objects or `has_objects(id_list)` for bulk existence checks.

### A-009: Not Setting CancellationToken (C#)
**Mistake**: Running long send/receive operations without providing a `CancellationToken`.
**Why it's wrong**: Without cancellation support, there is no way to gracefully stop a long-running operation. The user may have to kill the process.
**Correct approach**: ALWAYS pass a `CancellationToken` to `Operations.Send()` and `Operations.Receive()` in interactive applications.

### A-010: Constructing ServerTransport with Wrong Stream ID
**Mistake**: Using a stream ID from one server with credentials for another server.
**Why it's wrong**: The transport will connect successfully (authentication is server-level) but all object operations will fail with 404 errors because the stream does not exist on that server.
**Correct approach**: Ensure the `stream_id` matches a stream on the server identified by the `url` or `Account.serverInfo`.

---

## Open Questions for Skills

1. **What is the exact batch size for ServerTransport uploads?** Python uses 1MB batches. What does the C# SDK use? Is this configurable?

2. **How does the C# ServerTransport handle connection failures?** Is there retry logic? Exponential backoff? The Python SDK has a `retry_policy.py` module — what does it implement?

3. **What happens when SQLiteTransport runs out of disk space?** Does it fail gracefully or corrupt the database?

4. **Is there a DiskTransport in the Python SDK?** The C# SDK has one, but the Python SDK's transport directory only shows `abstract_transport.py`, `server/`, `sqlite.py`, and `memory.py`.

5. **How does the MongoDBTransport work in practice?** Is it production-ready? Is it maintained? What are the performance characteristics vs SQLite?

6. **Can transports be composed?** E.g., a CachingTransport that wraps a ServerTransport with a local SQLiteTransport automatically. Or is this only achievable via the `send()` function's multi-transport support?

7. **What is the maximum object size the ServerTransport can handle?** Are there HTTP request size limits? How does the batch sender handle objects larger than the batch size?

8. **How does the SpecklePy `copy_object_and_children` implementation handle very large hierarchies?** Does it stream or load everything into memory?

---

## Sources Consulted

| Source | URL | Accessed |
|--------|-----|----------|
| Speckle Transports Guide | https://speckle.guide/dev/transports.html | 2026-03-20 |
| Speckle .NET SDK Guide | https://speckle.guide/dev/dotnet.html | 2026-03-20 |
| Speckle Python SDK Guide | https://speckle.guide/dev/python.html | 2026-03-20 |
| SpecklePy AbstractTransport source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/transports/abstract_transport.py | 2026-03-20 |
| SpecklePy ServerTransport source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/transports/server/server.py | 2026-03-20 |
| SpecklePy SQLiteTransport source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/transports/sqlite.py | 2026-03-20 |
| SpecklePy MemoryTransport source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/transports/memory.py | 2026-03-20 |
| SpecklePy Operations source | https://github.com/specklesystems/specklepy/blob/main/src/specklepy/core/api/operations.py | 2026-03-20 |
| Speckle.Sdk ITransport.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Transports/ITransport.cs | 2026-03-20 |
| Speckle.Sdk ServerTransport.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Transports/ServerTransport.cs | 2026-03-20 |
| Speckle.Sdk SQLiteTransport.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Transports/SQLiteTransport.cs | 2026-03-20 |
| Speckle.Sdk Operations.Send.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Api/Operations/Operations.Send.cs | 2026-03-20 |
| Speckle.Sdk Operations.Receive.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Api/Operations/Operations.Receive.cs | 2026-03-20 |
| Speckle.Sdk Operations.Serialize.cs source | https://github.com/specklesystems/speckle-sharp-sdk/blob/main/src/Speckle.Sdk/Api/Operations/Operations.Serialize.cs | 2026-03-20 |
