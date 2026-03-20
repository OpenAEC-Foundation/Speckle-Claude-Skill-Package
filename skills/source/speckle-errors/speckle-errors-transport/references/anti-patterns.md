# Transport Error Anti-Patterns

## AP-001: Reusing ServerTransport Across Long Delays

**WRONG:**
```python
transport = ServerTransport(stream_id="abc123", client=client)
# ... hours of processing ...
operations.send(base=result, transports=[transport])  # Token may be expired
```

**WHY:** The authentication token stored at construction time can expire during long processing. The send will fail with a 401 error partway through upload.

**CORRECT:**
```python
# ... hours of processing ...
# Create fresh transport immediately before use
transport = ServerTransport(stream_id="abc123", client=client)
operations.send(base=result, transports=[transport])
```

---

## AP-002: Catching All Exceptions Silently

**WRONG:**
```python
try:
    operations.send(base=obj, transports=[transport])
except:
    pass  # Silently swallow ALL errors
```

**WHY:** This hides auth failures, network errors, disk issues, and configuration problems. The caller has no idea the send failed, leading to data loss.

**CORRECT:**
```python
try:
    operations.send(base=obj, transports=[transport])
except SpeckleException as e:
    logger.error(f"Send failed: {e}")
    raise
```

---

## AP-003: Using get_object() on Python ServerTransport

**WRONG:**
```python
server = ServerTransport(stream_id="abc123", client=client)
data = server.get_object("hash123")  # RAISES SpeckleException
```

**WHY:** `ServerTransport.get_object()` is NOT implemented in the Python SDK. It ALWAYS raises `SpeckleException`.

**CORRECT:**
```python
obj = operations.receive("hash123", remote_transport=server)
```

---

## AP-004: Sharing SQLite Scope Across Concurrent Processes

**WRONG:**
```python
# Process A
transport_a = SQLiteTransport()  # Uses default scope "Objects"
operations.send(base=obj_a, transports=[transport_a])

# Process B (simultaneously)
transport_b = SQLiteTransport()  # Same default scope "Objects"
operations.send(base=obj_b, transports=[transport_b])
# Result: "database is locked" errors
```

**WHY:** SQLite uses file-level locking. Two processes writing to the same database file causes lock contention.

**CORRECT:**
```python
# Process A
transport_a = SQLiteTransport(scope="ProcessA")

# Process B
transport_b = SQLiteTransport(scope="ProcessB")
```

---

## AP-005: Calling get_all_objects() on Production Caches

**WRONG:**
```python
transport = SQLiteTransport()
all_objects = transport.get_all_objects()  # Loads ENTIRE database into memory
```

**WHY:** Production caches can be multiple gigabytes. This causes `MemoryError` or complete system freeze.

**CORRECT:**
```python
transport = SQLiteTransport()
specific_obj = transport.get_object("specific_hash_id")
# Or use has_objects() for bulk existence checks
exists = transport.has_objects(["hash1", "hash2", "hash3"])
```

---

## AP-006: Sending Without Any Transport or Cache

**WRONG:**
```python
operations.send(base=obj, transports=None, use_default_cache=False)
# Raises: SpeckleException — nowhere to write data
```

**WHY:** With no transports and no cache, the serialized data has nowhere to go.

**CORRECT:**
```python
# Option 1: Provide explicit transport
operations.send(base=obj, transports=[server_transport])

# Option 2: Use default cache (writes to local SQLite only)
operations.send(base=obj, use_default_cache=True)
```

---

## AP-007: Disabling Default Cache Without Good Reason

**WRONG:**
```python
operations.send(base=obj, transports=[server_transport], use_default_cache=False)
# Later...
operations.receive(obj_id, remote_transport=server_transport)
# Forces FULL re-download — nothing in local cache
```

**WHY:** Without local caching, every receive operation fetches ALL objects from the server, wasting bandwidth and time.

**CORRECT:**
```python
# Let the default cache do its job
operations.send(base=obj, transports=[server_transport])  # use_default_cache=True is default
# Subsequent receive hits local cache first
operations.receive(obj_id, remote_transport=server_transport)  # Fast — reads from cache
```

**Exception:** Disable cache ONLY in serverless/container environments where disk I/O is unavailable or undesirable.

---

## AP-008: Not Closing SQLiteTransport After Use

**WRONG:**
```python
def process_data():
    transport = SQLiteTransport()
    obj = transport.get_object("hash123")
    return obj
    # Transport never closed — file lock held until garbage collection
```

**WHY:** The SQLite connection holds a file lock. If garbage collection is delayed, other processes cannot access the database.

**CORRECT:**
```python
def process_data():
    transport = SQLiteTransport()
    try:
        return transport.get_object("hash123")
    finally:
        transport.close()
```

---

## AP-009: Not Using CancellationToken in C# Interactive Apps

**WRONG:**
```csharp
// No cancellation support — user cannot stop a long upload
await Operations.Send(data, new[] { transport });
// If this takes 30 minutes, the only escape is killing the process
```

**WHY:** Without a `CancellationToken`, there is no graceful way to stop a long-running operation. Users must force-kill the application.

**CORRECT:**
```csharp
var cts = new CancellationTokenSource();
cts.CancelAfter(TimeSpan.FromMinutes(30)); // Safety timeout

try
{
    await Operations.Send(data, new[] { transport }, cancellationToken: cts.Token);
}
catch (OperationCanceledException)
{
    // Partial data is harmless — content-addressed objects are immutable
}
```

---

## AP-010: Implementing IProgress Manually Without Thread Marshalling

**WRONG:**
```csharp
class UnsafeProgress : IProgress<ProgressArgs>
{
    private readonly Label _label;
    public UnsafeProgress(Label label) => _label = label;

    public void Report(ProgressArgs value)
    {
        _label.Text = $"Sent: {value.Count}";  // THROWS — wrong thread
    }
}
```

**WHY:** Transport operations run on background threads. Updating UI elements from a background thread causes `InvalidOperationException`.

**CORRECT:**
```csharp
// Progress<T> captures SynchronizationContext and marshals automatically
var progress = new Progress<ProgressArgs>(args =>
{
    label.Text = $"Sent: {args.Count}";  // Safe — runs on UI thread
});
```

---

## AP-011: Retrying Immediately After Server 503

**WRONG:**
```python
while True:
    try:
        operations.send(base=obj, transports=[transport])
        break
    except Exception:
        continue  # Hammers the server with rapid retries
```

**WHY:** Immediate retries during a server outage create a thundering herd. The server cannot recover if flooded with retry requests.

**CORRECT:**
```python
for attempt in range(3):
    try:
        transport = ServerTransport(stream_id=sid, client=client)
        operations.send(base=obj, transports=[transport])
        break
    except Exception:
        if attempt == 2:
            raise
        time.sleep(2 ** attempt * 5)  # 5s, 10s, 20s
```

---

## AP-012: Mixing Stream ID and Server URL from Different Instances

**WRONG:**
```python
# Token and URL are for server-a.example.com
# Stream ID is from server-b.example.com
transport = ServerTransport(
    stream_id="stream_from_server_b",
    token="token_for_server_a",
    url="https://server-a.example.com",
)
# Authentication succeeds (server-level) but all operations fail with 404
```

**WHY:** Tokens authenticate against a server, not a stream. The transport connects successfully but cannot find the stream.

**CORRECT:**
```python
# ALWAYS ensure stream_id, token, and url refer to the same server
transport = ServerTransport(
    stream_id="stream_from_server_a",
    token="token_for_server_a",
    url="https://server-a.example.com",
)
```

---

## AP-013: Assuming MemoryTransport Persists Data

**WRONG:**
```python
mem = MemoryTransport()
operations.send(base=important_data, transports=[mem], use_default_cache=False)
# Process exits or mem goes out of scope — ALL DATA LOST
```

**WHY:** `MemoryTransport` is a plain dictionary. When the process exits or the object is garbage collected, all data is permanently lost.

**CORRECT:**
```python
# Use MemoryTransport only for testing or as a secondary transport
mem = MemoryTransport()
server = ServerTransport(stream_id=sid, client=client)
operations.send(base=important_data, transports=[server, mem])
```

---

## AP-014: Deleting SQLite Cache While Connectors Are Running

**WRONG:**
```bash
# While Revit connector is actively syncing:
rm "%APPDATA%\Speckle\Data.db"
# Result: SQLite errors in all running connectors
```

**WHY:** Deleting the database file while a process holds a connection causes immediate I/O errors in that process.

**CORRECT:**
1. Close ALL Speckle connectors and applications
2. Delete the cache file
3. Restart connectors — the cache will be recreated automatically

---

## AP-015: Not Handling Partial Multi-Transport Failure

**WRONG:**
```python
transports = [server_transport_a, server_transport_b]
operations.send(base=obj, transports=transports)
# Assumes both succeeded if no exception raised
```

**WHY:** If one transport fails mid-operation, the exception may propagate before the other transport completes. There is no built-in mechanism to verify all transports received all data.

**CORRECT:**
```python
# Send to each transport independently for reliable error handling
for transport in [server_transport_a, server_transport_b]:
    try:
        operations.send(base=obj, transports=[transport])
    except Exception as e:
        logger.error(f"Failed on {transport.name}: {e}")
        # Decide: retry this transport, skip, or abort
```
