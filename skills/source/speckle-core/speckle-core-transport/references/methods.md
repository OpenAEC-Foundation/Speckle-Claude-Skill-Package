# Transport Methods Reference

> Complete API signatures for all Speckle transport types in Python (SpecklePy) and C# (Speckle.Sdk).

---

## Python: AbstractTransport (ABC)

```python
from specklepy.transports.abstract_transport import AbstractTransport

class AbstractTransport(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable identifier for this transport."""

    @abstractmethod
    def begin_write(self) -> None:
        """Signal start of write batch. Used for batch initialization."""

    @abstractmethod
    def end_write(self) -> None:
        """Signal end of writes. Flushes pending batch operations."""

    @abstractmethod
    def save_object(self, id: str, serialized_object: str) -> None:
        """Save a single serialized object identified by its SHA256 hash."""

    @abstractmethod
    def save_object_from_transport(
        self, id: str, source_transport: "AbstractTransport"
    ) -> None:
        """Save an object by retrieving it from another transport."""

    @abstractmethod
    def get_object(self, id: str) -> Optional[str]:
        """Retrieve a serialized object by hash. Returns None if not found."""

    @abstractmethod
    def has_objects(self, id_list: List[str]) -> Dict[str, bool]:
        """Bulk existence check. Returns {id: bool} mapping."""

    @abstractmethod
    def copy_object_and_children(
        self, id: str, target_transport: "AbstractTransport"
    ) -> str:
        """Copy a parent object and all children to the target transport."""
```

---

## Python: ServerTransport

```python
from specklepy.transports.server import ServerTransport

class ServerTransport(AbstractTransport):
    def __init__(
        self,
        stream_id: str,
        client: Optional[SpeckleClient] = None,
        account: Optional[Account] = None,
        token: Optional[str] = None,
        url: Optional[str] = None,
        name: str = "RemoteTransport",
    ) -> None:
        """
        MUST provide one of:
          1. client (SpeckleClient) -- already authenticated
          2. account (Account) -- contains token + server URL
          3. token + url -- raw credentials pair
        Raises SpeckleException if no authentication is provided.
        """

    def save_object(self, id: str, serialized_object: str) -> None:
        """Queue object for batch upload (1MB batch size)."""

    def get_object(self, id: str) -> Optional[str]:
        """NOT IMPLEMENTED. Raises SpeckleException. Use receive() instead."""

    def has_objects(self, id_list: List[str]) -> Dict[str, bool]:
        """Returns all IDs mapped to False. Defers to server-side checks."""

    def copy_object_and_children(
        self, id: str, target_transport: AbstractTransport
    ) -> str:
        """
        Download root object + children from server.
        Checks target transport for existing children (deduplication).
        Retrieves missing children via batch API.
        Writes all objects to target transport.
        """

    def begin_write(self) -> None:
        """Reset object counter."""

    def end_write(self) -> None:
        """Flush all pending batch operations."""
```

---

## Python: SQLiteTransport

```python
from specklepy.transports.sqlite import SQLiteTransport

class SQLiteTransport(AbstractTransport):
    def __init__(
        self,
        base_path: str = None,
        app_name: str = None,
        scope: str = None,
        max_batch_size_mb: float = None,
    ) -> None:
        """
        base_path: defaults to speckle_path_provider.user_application_data_path()
        scope: database filename (default: "Objects.db")
        max_batch_size_mb: flush threshold for batch writes
        """

    def save_object(self, id: str, serialized_object: str) -> None:
        """
        Accumulate in _current_batch. Auto-flush via executemany()
        with INSERT OR IGNORE when batch size exceeds max_batch_size_mb.
        """

    def get_object(self, id: str) -> Optional[str]:
        """Retrieve single object by hash."""

    def has_objects(self, id_list: List[str]) -> Dict[str, bool]:
        """Bulk existence check against SQLite database."""

    def get_all_objects(self) -> List:
        """
        Fetch entire database. WARNING: unsafe for large datasets.
        Loads everything into memory.
        """

    def close(self) -> None:
        """Explicitly terminate the database connection."""

    # Properties
    saved_obj_count: int  # Number of objects written in current batch
```

---

## Python: MemoryTransport

```python
from specklepy.transports.memory import MemoryTransport

class MemoryTransport(AbstractTransport):
    def __init__(self, name: str = "Memory") -> None:
        """Initialize with empty in-memory dictionary."""

    objects: Dict[str, str]          # Direct access to backing store
    saved_object_count: int          # Counter for saved objects

    def save_object(self, id: str, serialized_object: str) -> None:
        """Store in self.objects dict. Increment counter."""

    def get_object(self, id: str) -> Optional[str]:
        """Return self.objects.get(id, None)."""

    def has_objects(self, id_list: List[str]) -> Dict[str, bool]:
        """Check membership in self.objects."""

    def save_object_from_transport(self, id, source) -> None:
        """NOT IMPLEMENTED. Raises error."""

    def copy_object_and_children(self, id, target) -> str:
        """NOT IMPLEMENTED. Raises error."""

    def begin_write(self) -> None:
        """Reset saved_object_count to 0."""

    def end_write(self) -> None:
        """No-op."""
```

---

## Python: Operations

```python
from specklepy.core.api.operations import send, receive, serialize, deserialize

def send(
    base: Base,
    transports: Optional[List[AbstractTransport]] = None,
    use_default_cache: bool = True,
) -> str:
    """
    Serialize and persist a Base object to one or more transports.
    Returns: root object hash (str).
    Raises SpeckleException if use_default_cache=False and transports is empty.
    """

def receive(
    obj_id: str,
    remote_transport: Optional[AbstractTransport] = None,
    local_transport: Optional[AbstractTransport] = None,
) -> Base:
    """
    Retrieve and deserialize a Base object by hash.
    Cache-first: checks local_transport before remote_transport.
    local_transport defaults to SQLiteTransport if None.
    """

def serialize(
    base: Base,
    write_transports: List[AbstractTransport] | None = None,
) -> str:
    """
    Serialize Base to JSON string.
    Without transports: no detaching/chunking (entire tree inlined).
    With transports: normal detaching and chunking.
    """

def deserialize(
    obj_string: str,
    read_transport: Optional[AbstractTransport] = None,
) -> Base:
    """
    Deserialize JSON string to Base object.
    read_transport used to fetch detached children.
    Defaults to SQLiteTransport if None.
    """
```

---

## C#: ITransport Interface

```csharp
namespace Speckle.Sdk.Transports;

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

public interface IBlobCapableTransport : ITransport
{
    string BlobStorageFolder { get; }
    void SaveBlob(Blob obj);
}
```

### Exceptions

All `ITransport` methods may throw:
- `TransportException` -- transport-specific failure
- `OperationCanceledException` -- operation was cancelled via `CancellationToken`
- `ArgumentException` -- invalid arguments

---

## C#: ServerTransport

```csharp
namespace Speckle.Sdk.Transports;

public class ServerTransport : IServerTransport, IBlobCapableTransport
{
    public ServerTransport(
        ISpeckleHttp http,
        ISdkActivityFactory activityFactory,
        Account account,
        string streamId,
        int timeoutSeconds = 60,
        string? blobStorageFolder = null
    );

    // Inherited from ITransport -- all functional
    void SaveObject(string id, string serializedObject);
    Task<string?> GetObject(string id);
    Task<Dictionary<string, bool>> HasObjects(IReadOnlyList<string> objectIds);
    Task<string> CopyObjectAndChildren(string id, ITransport targetTransport);

    // Write lifecycle
    void BeginWrite();    // Starts background sending thread
    Task WriteComplete();  // Polls until send buffer is empty
    void EndWrite();       // Terminates sending thread
}
```

### Server API Methods (via ParallelServerApi)

| Method | Purpose |
|--------|---------|
| `DownloadSingleObject()` | Retrieve one object by hash |
| `DownloadObjects()` | Batch retrieve multiple objects |
| `UploadObjects()` | Batch upload serialized objects |
| `UploadBlobs()` | Upload binary files |
| `HasObjects()` | Check existence for deduplication |
| `HasBlobs()` | Check blob existence |
| `DownloadBlobs()` | Retrieve binary files |

---

## C#: SQLiteTransport

```csharp
namespace Speckle.Sdk.Transports;

public class SQLiteTransport : ITransport, IDisposable, IBlobCapableTransport
{
    public SQLiteTransport(
        string? basePath = null,           // Default: SpecklePathProvider.UserApplicationDataPath()
        string? applicationName = null,    // Default: "Speckle"
        string? scope = null               // Default: "Data"
    );

    // Path: {basePath}/{applicationName}/{scope}.db

    void SaveObject(string id, string serializedObject);   // Enqueue for batch insert
    void SaveObjectSync(string id, string serializedObject); // Direct synchronous write
    Task<string?> GetObject(string id);                    // Retrieve with cancellation
    Task<Dictionary<string, bool>> HasObjects(IReadOnlyList<string> objectIds);
    void DeleteObject(string id);
    void UpdateObject(string id, string serializedObject);
    IEnumerable<string> GetAllObjects();  // WARNING: returns entire DB

    void Dispose();  // Clean up SQLite connection
}
```

### Batch Write Details

- Uses `ConcurrentQueue` to buffer writes
- `ConsumeQueue()` processes up to 1,000 items per transaction
- 500ms timer triggers automatic queue consumption

---

## C#: MemoryTransport

```csharp
namespace Speckle.Sdk.Transports;

public class MemoryTransport : ITransport
{
    // Backing store: ConcurrentDictionary<string, string>

    void SaveObject(string id, string serializedObject);
    Task<string?> GetObject(string id);
    Task<Dictionary<string, bool>> HasObjects(IReadOnlyList<string> objectIds);
    Task<string> CopyObjectAndChildren(string id, ITransport targetTransport);
}
```

---

## C#: Operations

```csharp
namespace Speckle.Sdk.Api;

public partial class Operations
{
    public async Task<(string rootObjId, IReadOnlyDictionary<string, ObjectReference> convertedReferences)> Send(
        Base value,
        IReadOnlyCollection<ITransport> transports,
        IProgress<ProgressArgs>? onProgressAction = null,
        CancellationToken cancellationToken = default
    );

    public async Task<Base> Receive(
        string objectId,
        ITransport? remoteTransport = null,
        ITransport? localTransport = null,
        IProgress<ProgressArgs>? onProgressAction = null,
        CancellationToken cancellationToken = default
    );

    public string Serialize(
        Base value,
        CancellationToken cancellationToken = default
    );

    public async Task<Base> DeserializeAsync(
        string value,
        CancellationToken cancellationToken = default
    );
}
```

### C# Error Handling

| Exception | When |
|-----------|------|
| `OperationCanceledException` | CancellationToken triggered -- re-thrown directly |
| `SpeckleException` | Speckle-specific error -- re-thrown directly |
| Other exceptions | Wrapped in `SpeckleException` |
| `ArgumentNullException` | Null value passed to Serialize/Deserialize |
| `JsonReaderException` | Malformed JSON in DeserializeAsync |
| `TransportException` | Transport-level failure |
