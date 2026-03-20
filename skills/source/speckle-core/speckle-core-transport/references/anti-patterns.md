# Transport Anti-Patterns

> What NOT to do with Speckle transports, and WHY.

---

## A-001: Disabling Default Cache During Send

**Wrong:**
```python
send(base=obj, transports=[server_transport], use_default_cache=False)
```

**Why it fails:** Without local caching, every subsequent `receive()` for these objects must fetch ALL data from the server. This wastes bandwidth and time, especially for large models.

**Correct:**
```python
# ALWAYS use the default cache unless in an ephemeral environment
send(base=obj, transports=[server_transport])  # use_default_cache=True is default
```

---

## A-002: Sending Without Any Transport

**Wrong:**
```python
send(base=obj, transports=None, use_default_cache=False)
```

**Why it fails:** Raises `SpeckleException` immediately. There is no destination for the serialized data.

**Correct:**
```python
# Provide at least one transport OR leave use_default_cache=True
send(base=obj, transports=[server_transport])
# Or: send to local cache only
send(base=obj)  # Writes to default SQLite cache
```

---

## A-003: Calling get_object() on Python ServerTransport

**Wrong:**
```python
server_transport = ServerTransport(stream_id="...", client=client)
json_str = server_transport.get_object("abc123")  # RAISES SpeckleException
```

**Why it fails:** `ServerTransport.get_object()` is NOT implemented in the Python SDK. The server transport is designed for bulk operations via `copy_object_and_children()`.

**Correct:**
```python
# Use operations.receive() which handles the copy-to-cache flow
from specklepy.api.operations import receive
obj = receive(obj_id="abc123", remote_transport=server_transport)
```

---

## A-004: Forgetting end_write() on Manual Transport Usage

**Wrong:**
```python
transport = SQLiteTransport()
transport.begin_write()
transport.save_object("hash1", '{"data": "value"}')
# Forgot end_write() -- last batch may not be flushed!
result = transport.get_object("hash1")  # May return None
```

**Why it fails:** Transports use batch writes for performance. Without `end_write()`, the final batch remains in the internal buffer and is never written to the database.

**Correct:**
```python
transport = SQLiteTransport()
transport.begin_write()
transport.save_object("hash1", '{"data": "value"}')
transport.end_write()  # ALWAYS flush
result = transport.get_object("hash1")  # Returns the object
```

**Best approach:** Use `operations.send()` which manages `begin_write()` and `end_write()` automatically.

---

## A-005: Relying on MemoryTransport for Persistence

**Wrong:**
```python
mem = MemoryTransport()
send(base=critical_data, transports=[mem], use_default_cache=False)
# Process exits -- all data is gone
```

**Why it fails:** `MemoryTransport` stores objects in a Python dictionary. When the process exits or the transport is garbage collected, all data is permanently lost.

**Correct:**
```python
# Use MemoryTransport ONLY for testing or temporary operations
# For persistent storage, use SQLiteTransport or ServerTransport
sqlite = SQLiteTransport()
send(base=critical_data, transports=[sqlite])
```

---

## A-006: Creating ServerTransport Without Authentication

**Wrong:**
```python
# No client, no account, no token+url
transport = ServerTransport(stream_id="abc123")  # RAISES SpeckleException
```

**Why it fails:** All Speckle Server API calls require authentication. The constructor validates that at least one authentication path is provided.

**Correct:**
```python
# Provide one of the three auth paths
transport = ServerTransport(stream_id="abc123", client=authenticated_client)
# Or: ServerTransport(stream_id="abc123", account=account)
# Or: ServerTransport(stream_id="abc123", token="...", url="https://...")
```

---

## A-007: Calling get_all_objects() on Large Databases

**Wrong:**
```python
transport = SQLiteTransport()  # Default cache, possibly GB in size
all_objects = transport.get_all_objects()  # Loads ENTIRE database into memory
```

**Why it fails:** On heavy Speckle users, the cache database can be multiple gigabytes. Loading it entirely into memory causes memory exhaustion and process crashes.

**Correct:**
```python
# Retrieve specific objects by hash
obj = transport.get_object("specific_hash")

# Or check existence of specific objects
exists = transport.has_objects(["hash1", "hash2", "hash3"])
```

---

## A-008: Omitting CancellationToken in C# Interactive Apps

**Wrong:**
```csharp
// No cancellation token -- user cannot stop a 10-minute download
var obj = await operations.Receive("abc123", remoteTransport: serverTransport);
```

**Why it fails:** Without a `CancellationToken`, there is no way to gracefully stop a long-running transfer. The user may have to kill the entire process.

**Correct:**
```csharp
using var cts = new CancellationTokenSource();
cancelButton.Click += (_, _) => cts.Cancel();

try
{
    var obj = await operations.Receive(
        "abc123",
        remoteTransport: serverTransport,
        cancellationToken: cts.Token
    );
}
catch (OperationCanceledException)
{
    // Handle graceful cancellation
}
```

---

## A-009: Mismatched Stream ID and Server

**Wrong:**
```python
# Token for server-a.example.com, but stream exists on server-b.example.com
transport = ServerTransport(
    stream_id="stream_from_server_b",
    token="token_for_server_a",
    url="https://server-a.example.com",
)
# Authentication succeeds (token is valid for server-a)
# But all operations fail with 404 (stream does not exist on server-a)
```

**Why it fails:** Authentication is server-level, not stream-level. The transport connects successfully but cannot find the stream.

**Correct:**
```python
# Ensure stream_id matches the server specified by url/account/client
transport = ServerTransport(
    stream_id="stream_from_server_a",
    token="token_for_server_a",
    url="https://server-a.example.com",
)
```

---

## A-010: Deleting SQLite Cache Without Understanding Impact

**Wrong:**
```bash
# "Let me free up disk space"
del %APPDATA%\Speckle\Data.db
```

**Why it hurts:** The database is recreated automatically, but ALL previously cached objects are lost. The next `receive()` for any previously-fetched data requires a full re-download from the server. For large models, this means minutes or hours of re-downloading.

**Correct approach:** Delete the cache only when disk space is critical. Understand that re-downloading large models is significantly slower than reading from local cache.

---

## A-011: Wrapping ServerTransport Operations in Try/Except Without Specifics

**Wrong:**
```python
try:
    result = receive(obj_id=hash, remote_transport=transport)
except Exception:
    pass  # Silently swallow ALL errors
```

**Why it fails:** This hides authentication failures, network errors, missing objects, and corrupted data. Debugging becomes impossible.

**Correct:**
```python
from specklepy.logging.exceptions import SpeckleException

try:
    result = receive(obj_id=hash, remote_transport=transport)
except SpeckleException as e:
    logger.error(f"Speckle operation failed: {e}")
    raise
```

---

## A-012: Using MemoryTransport copy_object_and_children() in Python

**Wrong:**
```python
mem = MemoryTransport()
target = SQLiteTransport()
mem.copy_object_and_children("hash", target)  # NOT IMPLEMENTED -- raises error
```

**Why it fails:** Python's `MemoryTransport` does NOT implement `copy_object_and_children()` or `save_object_from_transport()`. These methods raise errors.

**Correct:**
```python
# Use operations.receive() for cross-transport operations
obj = receive(obj_id="hash", local_transport=mem)
send(base=obj, transports=[target])
```

---

## Summary Table

| ID | Anti-Pattern | Severity | SDK |
|----|-------------|----------|-----|
| A-001 | Disabling default cache | High | Python |
| A-002 | Sending without transports | Critical | Python |
| A-003 | get_object() on ServerTransport | Critical | Python |
| A-004 | Missing end_write() | High | Both |
| A-005 | MemoryTransport for persistence | Critical | Both |
| A-006 | No authentication on ServerTransport | Critical | Both |
| A-007 | get_all_objects() on large DBs | High | Both |
| A-008 | Missing CancellationToken | Medium | C# |
| A-009 | Mismatched stream ID and server | High | Both |
| A-010 | Deleting cache without understanding | Medium | Both |
| A-011 | Silent exception swallowing | High | Both |
| A-012 | MemoryTransport copy operations | Critical | Python |
