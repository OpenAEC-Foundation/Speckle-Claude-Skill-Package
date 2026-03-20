---
name: speckle-errors-transport
description: >
  Use when debugging Speckle send/receive failures, transport timeout errors, SQLite lock issues, or authentication expiry during transfers.
  Prevents unhandled transport exceptions, SQLite database locks from concurrent access, and silent auth token expiry during long uploads.
  Covers transport failures (network errors, timeout, auth expiry), SQLite lock errors, memory limits, multi-transport errors, batch upload failures, progress reporting errors, and retry strategies.
  Keywords: speckle error, transport error, sqlite lock, timeout, auth expiry, upload failed, receive failed, network error, retry.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy or Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-errors-transport

## Diagnostic Decision Tree

```
Transport operation failed
|
+-- Network/HTTP error?
|   +-- 401 / 403 → AUTH EXPIRY (Section 1)
|   +-- 404 → WRONG STREAM ID (Section 2)
|   +-- 408 / timeout → TIMEOUT (Section 3)
|   +-- 502 / 503 / 504 → SERVER UNAVAILABLE (Section 4)
|   +-- ConnectionError / SSLError → NETWORK (Section 5)
|
+-- SQLite error?
|   +-- "database is locked" → SQLITE LOCK (Section 6)
|   +-- "disk I/O error" → DISK FULL (Section 7)
|   +-- "unable to open database" → PATH / PERMISSION (Section 8)
|
+-- Memory error?
|   +-- MemoryError / OutOfMemoryException → MEMORY LIMIT (Section 9)
|
+-- SpeckleException?
|   +-- "No transport" → NO TRANSPORT CONFIG (Section 10)
|   +-- "get_object not implemented" → WRONG METHOD (Section 11)
|
+-- Multi-transport failure? → PARTIAL FAILURE (Section 12)
+-- OperationCanceledException → CANCELLATION (Section 13)
+-- Progress callback throws → PROGRESS ERROR (Section 14)
```

---

## Section 1: Authentication Expiry During Transfer

**Symptom:** HTTP 401/403 partway through a send/receive. Operation starts but fails after minutes.

**Cause:** Speckle tokens expire. `ServerTransport` stores the token at construction and reuses it for ALL requests. Long transfers can outlive the token.

**Fix:** ALWAYS create a fresh `ServerTransport` immediately before each operation. NEVER reuse across delays of more than 30 minutes.

```python
# Create transport JUST before use
transport = ServerTransport(stream_id="abc123", client=client)
root_id = operations.send(base=my_object, transports=[transport])
```

```csharp
// Set generous timeout for large models
var transport = new ServerTransport(account, "streamId", timeoutSeconds: 300);
```

---

## Section 2: Wrong Stream ID (404)

**Symptom:** HTTP 404 on upload/download. Auth succeeds but operations fail.

**Cause:** The `stream_id` does not exist on the target server. Common when mixing IDs from different servers or after stream deletion.

**Fix:** ALWAYS verify stream existence before creating transport.

```python
stream = client.stream.get(stream_id="abc123")  # Raises if not found
transport = ServerTransport(stream_id="abc123", client=client)
```

**Rule:** NEVER mix stream IDs from one server with credentials for another.

---

## Section 3: Timeout Errors

**Symptom:** `TimeoutError`, `requests.exceptions.Timeout`, or `TaskCanceledException`. Common with models >100MB.

**Cause:** HTTP request exceeded configured timeout. C# default is 60 seconds per request.

**Fix:**
- C#: Set `timeoutSeconds: 300` (or higher) at transport construction
- Python: Configure at session level or use client-based auth

**Rule:** ALWAYS set `timeoutSeconds` to at least 300 for models larger than 50MB. NEVER use the default 60-second timeout for production workloads.

---

## Section 4: Server Unavailable (502/503/504)

**Symptom:** Intermittent HTTP 502/503/504 during batch uploads.

**Cause:** Speckle Server or reverse proxy is overloaded, restarting, or down.

**Fix:** Implement retry with exponential backoff. ALWAYS create a fresh `ServerTransport` per retry. NEVER retry immediately — wait at least 5 seconds.

```python
for attempt in range(3):
    try:
        transport = ServerTransport(stream_id=sid, client=client)
        return operations.send(base=obj, transports=[transport])
    except Exception:
        if attempt == 2: raise
        time.sleep(2 ** attempt * 5)  # 5s, 10s, 20s
```

---

## Section 5: Network Connection Errors

**Symptom:** `ConnectionError`, `SSLError`, `ConnectionRefusedError`, `HttpRequestException`.

**Cause:** No connectivity, DNS failure, SSL cert issues (self-hosted), firewall blocking port 443, or missing proxy config.

**Fix:** Verify connectivity before long operations. Configure proxy via `HTTPS_PROXY` environment variable. NEVER ignore SSL errors in production.

---

## Section 6: SQLite Database Lock

**Symptom:** `sqlite3.OperationalError: database is locked` or `SqliteException: SQLite Error 5`.

**Cause:** SQLite uses file-level locking. Multiple processes writing to the same `Data.db` simultaneously causes lock errors. The default cache is shared across ALL connectors.

**Fix:** Use separate `scope` names for concurrent operations:

```python
transport_a = SQLiteTransport(scope="ProjectA")  # Creates ProjectA.db
transport_b = SQLiteTransport(scope="ProjectB")  # Creates ProjectB.db
```

**Rules:**
- **NEVER** share the same scope across concurrent processes
- **NEVER** open Speckle SQLite with an external tool while connectors are running
- **ALWAYS** call `close()` (Python) or `Dispose()` (C#) when done

---

## Section 7: Disk Full / I/O Errors

**Symptom:** `sqlite3.OperationalError: disk I/O error` or `SQLite Error 13: database or disk is full`.

**Cause:** The SQLite cache grows monotonically — Speckle NEVER purges cached objects. Heavy users accumulate 10GB+ caches.

**Fix:** Delete the cache file when no connectors are running (safe — recreated automatically). Use `use_default_cache=False` in serverless environments.

**Rules:**
- **NEVER** delete the cache while Speckle connectors are running
- **ALWAYS** monitor disk space on production machines

---

## Section 8: SQLite Path / Permission Errors

**Symptom:** `unable to open database file` at transport construction.

**Cause:** Base path does not exist, no write permissions, or invalid characters. On Linux, `$XDG_DATA_HOME` may point to non-existent directory.

**Fix:** Specify a writable path explicitly:

```python
import os
os.makedirs("/tmp/speckle-cache", exist_ok=True)
transport = SQLiteTransport(base_path="/tmp/speckle-cache", scope="MyProject")
```

**Rule:** NEVER assume `%APPDATA%` or `~/.config` is writable in CI/CD — specify a custom `base_path`.

---

## Section 9: Memory Exhaustion

**Symptom:** `MemoryError` or `OutOfMemoryException` during serialization or `get_all_objects()`.

**Cause:**
1. Calling `get_all_objects()` on a large cache (loads everything into memory)
2. Serializing very deep/wide trees without detachment
3. Using `MemoryTransport` for large datasets

**Rules:**
- **NEVER** call `get_all_objects()` on databases larger than 100MB
- **NEVER** use `MemoryTransport` for datasets exceeding available RAM
- **ALWAYS** use `@detach_property` for large child collections
- **ALWAYS** set `use_default_cache=True` during send to enable streaming serialization

---

## Section 10: No Transport Configured

**Symptom:** `SpeckleException: Provide at least one transport...`

**Cause:** `send()` called with `transports=None` AND `use_default_cache=False`.

**Fix:** ALWAYS provide at least one transport, OR leave `use_default_cache=True` (the default).

---

## Section 11: Wrong Transport Method Call

**Symptom:** `SpeckleException` from `server_transport.get_object(id)` in Python.

**Cause:** Python `ServerTransport.get_object()` is NOT implemented — ALWAYS raises. Use `operations.receive()` or `copy_object_and_children()` instead.

```python
# WRONG: server_transport.get_object(obj_id)  # RAISES
# CORRECT:
obj = operations.receive(obj_id, remote_transport=server_transport)
```

**Rule:** NEVER call `get_object()` directly on a Python `ServerTransport`. ALWAYS read from a local transport after copying.

---

## Section 12: Multi-Transport Partial Failure

**Symptom:** Send completes but data is missing from one transport.

**Cause:** A failure in one transport does NOT abort the others. In Python, an exception propagates and may leave other transports incomplete.

**Fix:** Send to each transport independently for critical workflows:

```python
for transport in transports:
    try:
        operations.send(base=obj, transports=[transport])
    except Exception as e:
        logger.error(f"Failed on {transport.name}: {e}")
```

**Rule:** NEVER assume all transports succeeded without verification.

---

## Section 13: Cancellation Errors

**Symptom:** `OperationCanceledException` (C#) mid-transfer.

**Cause:** User or code cancelled via `CancellationToken`. Partial data may remain in transports.

**Fix:** ALWAYS pass a `CancellationToken` in C# interactive apps. NEVER attempt rollback — partial content-addressed data is harmless.

```csharp
var cts = new CancellationTokenSource();
cts.CancelAfter(TimeSpan.FromMinutes(30));
await Operations.Send(data, new[] { transport }, cancellationToken: cts.Token);
```

---

## Section 14: Progress Reporting Errors

**Symptom:** Exception from progress callback, not from the transport. Cross-thread UI errors in C#.

**Cause:** `IProgress<ProgressArgs>` callback invoked from a background thread. Updating UI without marshalling throws.

**Fix:** ALWAYS use `new Progress<ProgressArgs>(callback)` which captures `SynchronizationContext`. NEVER implement `IProgress<T>` manually without thread marshalling.

---

## Retry Strategy Summary

| Error Type | Retry? | Max | Backoff |
|-----------|--------|-----|---------|
| Auth expiry (401/403) | Yes | 1 | Re-auth, new transport |
| Wrong stream (404) | No | — | Fix stream ID |
| Timeout (408) | Yes | 3 | Exponential |
| Server down (5xx) | Yes | 3 | Exponential (5s base) |
| Network error | Yes | 3 | Exponential (2s base) |
| SQLite lock | Yes | 5 | Linear (0.5s increments) |
| Disk full | No | — | Free space |
| Path/permission | No | — | Fix config |
| Memory exhaustion | No | — | Reduce payload |
| No transport | No | — | Fix config |
| Wrong method | No | — | Use correct API |
| Multi-transport | Yes | 2 | Retry failed only |
| Cancellation | No | — | User-initiated |
| Progress callback | No | — | Fix callback |

---

## Default Cache Paths

| OS | Path |
|----|------|
| Windows | `%APPDATA%\Speckle\Data.db` |
| macOS | `~/.config/Speckle/Data.db` |
| Linux | `$XDG_DATA_HOME/Speckle/Data.db` or `~/.local/share/Speckle/Data.db` |

---

## Critical Rules Summary

1. **NEVER** reuse `ServerTransport` across operations separated by >30 minutes
2. **NEVER** call `get_object()` on Python `ServerTransport`
3. **NEVER** call `get_all_objects()` on large databases
4. **NEVER** share SQLite scope across concurrent processes
5. **NEVER** delete cache while connectors are running
6. **ALWAYS** create fresh `ServerTransport` per operation
7. **ALWAYS** use separate `scope` names for concurrent SQLite access
8. **ALWAYS** pass `CancellationToken` in C# interactive applications
9. **ALWAYS** implement retry with exponential backoff for server errors
10. **ALWAYS** close/dispose transports when done

---

## Reference Links

- [references/methods.md](references/methods.md) — Transport API signatures and exception types
- [references/examples.md](references/examples.md) — Working error handling code examples
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do with transports

### Official Sources

- https://speckle.guide/dev/transports.html
- https://speckle.guide/dev/python.html
- https://speckle.guide/dev/dotnet.html
- https://github.com/specklesystems/specklepy
- https://github.com/specklesystems/speckle-sharp-sdk
