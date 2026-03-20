# Transport Error-Related API Methods

## Python SDK (SpecklePy)

### operations.send()

```python
def send(
    base: Base,
    transports: Optional[List[AbstractTransport]] = None,
    use_default_cache: bool = True,
) -> str
```

**Throws**:
- `SpeckleException` — when `transports` is empty/None AND `use_default_cache=False`
- `SpeckleException` — when serialization fails
- `requests.exceptions.ConnectionError` — when server is unreachable
- `requests.exceptions.Timeout` — when HTTP request times out
- `sqlite3.OperationalError` — when local cache write fails (locked, disk full)

**Return**: Root object hash (string).

---

### operations.receive()

```python
def receive(
    obj_id: str,
    remote_transport: Optional[AbstractTransport] = None,
    local_transport: Optional[AbstractTransport] = None,
) -> Base
```

**Throws**:
- `SpeckleException` — when object not found in any transport
- `SpeckleException` — when deserialization fails
- `requests.exceptions.ConnectionError` — when remote server unreachable
- `sqlite3.OperationalError` — when local cache read/write fails

**Return**: Deserialized `Base` object.

---

### ServerTransport.__init__()

```python
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

**Throws**:
- `SpeckleException` — when no authentication is provided (no client, no account, no token+url)

**Authentication precedence**: `client` > `account` > `token + url`.

---

### ServerTransport.get_object()

```python
def get_object(self, id: str) -> Optional[str]
```

**Throws**: `SpeckleException` — ALWAYS. This method is NOT implemented on ServerTransport in Python. Use `copy_object_and_children()` or `operations.receive()` instead.

---

### ServerTransport.copy_object_and_children()

```python
def copy_object_and_children(
    self, id: str, target_transport: AbstractTransport
) -> str
```

**Throws**:
- `requests.exceptions.HTTPError` — 401 (auth expired), 404 (wrong stream/object), 5xx (server error)
- `requests.exceptions.ConnectionError` — network failure
- `requests.exceptions.Timeout` — request timeout

**Behavior**: Downloads root object, checks target transport for existing children, batch-downloads missing children, writes all to target.

---

### SQLiteTransport.__init__()

```python
def __init__(
    self,
    base_path: str = None,
    app_name: str = None,
    scope: str = None,
    max_batch_size_mb: float = None,
) -> None
```

**Throws**:
- `sqlite3.OperationalError` — when path does not exist, no write permission, or database file is corrupted

**Defaults**: `base_path` from `speckle_path_provider`, `scope` = `"Objects"`.

---

### SQLiteTransport.save_object()

```python
def save_object(self, id: str, serialized_object: str) -> None
```

**Throws**:
- `sqlite3.OperationalError: database is locked` — concurrent write from another process
- `sqlite3.OperationalError: disk I/O error` — disk full or hardware failure

**Behavior**: Accumulates in batch buffer. Flushes via `INSERT OR IGNORE` when batch size exceeded.

---

### SQLiteTransport.get_all_objects()

```python
def get_all_objects(self) -> List[Dict]
```

**Throws**:
- `MemoryError` — when database is too large to fit in memory

**WARNING**: Loads the ENTIRE database into memory. NEVER use on production caches.

---

### SQLiteTransport.close()

```python
def close(self) -> None
```

**Behavior**: Closes the SQLite connection. ALWAYS call this when done with the transport to release file locks.

---

### MemoryTransport.__init__()

```python
def __init__(self, name: str = "Memory") -> None
```

**No exceptions**. Creates an empty in-memory dictionary.

---

### MemoryTransport.save_object_from_transport()

```python
def save_object_from_transport(self, id: str, source_transport: AbstractTransport) -> None
```

**Throws**: `SpeckleException` — NOT implemented on MemoryTransport.

---

### MemoryTransport.copy_object_and_children()

```python
def copy_object_and_children(self, id: str, target_transport: AbstractTransport) -> str
```

**Throws**: `SpeckleException` — NOT implemented on MemoryTransport.

---

## C# SDK (Speckle.Sdk)

### Operations.Send()

```csharp
public async Task<(string rootObjId, IReadOnlyDictionary<string, ObjectReference> convertedReferences)> Send(
    Base value,
    IReadOnlyCollection<ITransport> transports,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

**Throws**:
- `ArgumentNullException` — when `value` is null or `transports` is empty
- `OperationCanceledException` — when cancellation is requested
- `SpeckleException` — wraps all other transport/serialization errors
- `TransportException` — specific transport failures (network, auth, timeout)

**Behavior**: Calls `BeginWrite()` on all transports, serializes, then calls `EndWrite()` in finally block.

---

### Operations.Receive()

```csharp
public async Task<Base> Receive(
    string objectId,
    ITransport? remoteTransport = null,
    ITransport? localTransport = null,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

**Throws**:
- `TransportException` — when object not found in any transport
- `OperationCanceledException` — when cancellation is requested
- `SpeckleException` — deserialization or transport errors
- `JsonReaderException` — corrupted object data

---

### ServerTransport Constructor

```csharp
public ServerTransport(
    ISpeckleHttp http,
    ISdkActivityFactory activityFactory,
    Account account,
    string streamId,
    int timeoutSeconds = 60,
    string? blobStorageFolder = null
)
```

**Throws**:
- `ArgumentNullException` — when `account` or `streamId` is null
- `TransportException` — when account has no valid token

---

### ServerTransport.WriteComplete()

```csharp
public Task WriteComplete()
```

**Throws**:
- `TransportException` — when background sending thread encountered errors
- `OperationCanceledException` — when cancelled during wait

**Behavior**: Polls until all queued data has been uploaded by the background sending thread.

---

### SQLiteTransport Constructor

```csharp
public SQLiteTransport(
    string? basePath = null,
    string? applicationName = null,
    string? scope = null
)
```

**Throws**:
- `SqliteException` — when path is invalid, no permissions, or database corrupted

**Implements**: `ITransport`, `IDisposable`, `IBlobCapableTransport`.

---

### SQLiteTransport.Dispose()

```csharp
public void Dispose()
```

**Behavior**: Closes connection and releases file lock. ALWAYS dispose when done.

---

### ITransport.CancellationToken

```csharp
CancellationToken CancellationToken { get; set; }
```

**Behavior**: Set this BEFORE calling `BeginWrite()`. Operations.Send() sets this automatically when you pass `cancellationToken`.

---

### ITransport.OnProgressAction

```csharp
IProgress<ProgressArgs>? OnProgressAction { get; set; }
```

**Behavior**: Set this BEFORE calling `BeginWrite()`. Invoked from background threads — use `Progress<T>` to marshal to UI thread.
