# Transport Error Handling — Working Examples

## Example 1: Robust Send with Full Error Handling (Python)

```python
import time
import sqlite3
from specklepy.api.client import SpeckleClient
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.logging.exceptions import SpeckleException


def robust_send(base, stream_id, token, server_url, max_retries=3):
    """Send a Speckle object with comprehensive error handling and retry logic.

    Returns the root object hash on success.
    Raises SpeckleException on permanent failure.
    """
    client = SpeckleClient(host=server_url)
    client.authenticate_with_token(token)

    # Verify stream exists before attempting send
    try:
        client.stream.get(stream_id=stream_id)
    except SpeckleException:
        raise SpeckleException(
            f"Stream {stream_id} not found on {server_url}. "
            "Verify the stream ID and server URL match."
        )

    last_error = None
    for attempt in range(max_retries):
        try:
            # ALWAYS create a fresh transport per attempt
            transport = ServerTransport(stream_id=stream_id, client=client)
            root_id = operations.send(base=base, transports=[transport])
            return root_id

        except SpeckleException as e:
            if "401" in str(e) or "Unauthorized" in str(e):
                # Re-authenticate and retry once
                client = SpeckleClient(host=server_url)
                client.authenticate_with_token(token)
                last_error = e
                continue

            if "No transport" in str(e):
                raise  # Configuration error — no retry

            last_error = e

        except sqlite3.OperationalError as e:
            if "locked" in str(e):
                time.sleep(0.5 * (attempt + 1))
                last_error = e
                continue
            raise  # Disk error or path error — no retry

        except ConnectionError as e:
            last_error = e
            wait = 2 ** attempt * 5
            time.sleep(wait)
            continue

        except Exception as e:
            last_error = e
            wait = 2 ** attempt * 2
            time.sleep(wait)
            continue

    raise SpeckleException(
        f"Send failed after {max_retries} attempts. Last error: {last_error}"
    )
```

---

## Example 2: Robust Receive with Cache-First Strategy (Python)

```python
from specklepy.api.client import SpeckleClient
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.transports.sqlite import SQLiteTransport
from specklepy.logging.exceptions import SpeckleException


def robust_receive(obj_id, stream_id, token, server_url):
    """Receive a Speckle object with explicit cache handling.

    Returns the deserialized Base object.
    """
    # Try local cache first — no network needed
    local = SQLiteTransport()
    cached = local.get_object(obj_id)
    if cached is not None:
        return operations.receive(obj_id, local_transport=local)

    # Cache miss — fetch from server
    client = SpeckleClient(host=server_url)
    client.authenticate_with_token(token)

    remote = ServerTransport(stream_id=stream_id, client=client)

    try:
        return operations.receive(
            obj_id,
            remote_transport=remote,
            local_transport=local,
        )
    except SpeckleException as e:
        if "404" in str(e) or "Not Found" in str(e):
            raise SpeckleException(
                f"Object {obj_id} not found in stream {stream_id}. "
                "The object may have been deleted or the ID is incorrect."
            )
        raise
    finally:
        local.close()
```

---

## Example 3: Concurrent Operations with Separate SQLite Scopes (Python)

```python
import threading
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.transports.sqlite import SQLiteTransport


def send_to_stream(base, stream_id, client, scope_name):
    """Send using a dedicated cache scope to avoid SQLite locks."""
    local = SQLiteTransport(scope=scope_name)
    remote = ServerTransport(stream_id=stream_id, client=client)

    try:
        return operations.send(
            base=base,
            transports=[remote],
            use_default_cache=False,  # We manage cache explicitly
        )
    finally:
        local.close()


# Run concurrent sends without SQLite lock contention
threads = []
for i, (obj, sid) in enumerate(zip(objects, stream_ids)):
    t = threading.Thread(
        target=send_to_stream,
        args=(obj, sid, client, f"Worker_{i}"),
    )
    threads.append(t)
    t.start()

for t in threads:
    t.join()
```

---

## Example 4: C# Send with Cancellation and Progress (C#)

```csharp
using Speckle.Sdk;
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Transports;

public async Task<string> SendWithMonitoring(
    Base data,
    string streamId,
    Account account,
    CancellationToken externalToken)
{
    // Combine external cancellation with a timeout
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromMinutes(30));
    using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
        externalToken, timeoutCts.Token);

    var progress = new Progress<ProgressArgs>(args =>
    {
        // Safe for UI — Progress<T> marshals to creation thread
        Console.WriteLine($"[{args.ProgressEvent}] Count: {args.Count}");
    });

    var transport = new ServerTransport(account, streamId, timeoutSeconds: 300);

    try
    {
        var (rootId, refs) = await Operations.Send(
            data,
            new ITransport[] { transport },
            onProgressAction: progress,
            cancellationToken: linkedCts.Token
        );

        Console.WriteLine($"Sent successfully: {rootId}");
        return rootId;
    }
    catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
    {
        throw new TimeoutException(
            "Send operation timed out after 30 minutes. " +
            "Consider splitting the model into smaller parts.");
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("Send cancelled by user.");
        throw;
    }
    catch (TransportException ex) when (ex.Message.Contains("401"))
    {
        throw new SpeckleException(
            "Authentication expired during send. " +
            "Re-authenticate and create a new ServerTransport.", ex);
    }
    catch (SpeckleException ex)
    {
        Console.WriteLine($"Speckle error: {ex.Message}");
        throw;
    }
}
```

---

## Example 5: C# Receive with Retry and Fallback (C#)

```csharp
public async Task<Base> ReceiveWithRetry(
    string objectId,
    string streamId,
    Account account,
    int maxRetries = 3)
{
    var localTransport = new SQLiteTransport(scope: "AppCache");

    // Try local cache first
    var cached = await localTransport.GetObject(objectId);
    if (cached != null)
    {
        var deserializer = new SpeckleObjectDeserializer { ReadTransport = localTransport };
        return await deserializer.DeserializeAsync(cached);
    }

    // Remote fetch with retry
    Exception? lastError = null;
    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        try
        {
            var remoteTransport = new ServerTransport(
                account, streamId, timeoutSeconds: 300);

            return await Operations.Receive(
                objectId,
                remoteTransport: remoteTransport,
                localTransport: localTransport
            );
        }
        catch (TransportException ex) when (ex.Message.Contains("404"))
        {
            throw; // Object not found — no retry
        }
        catch (TransportException ex) when (
            ex.Message.Contains("502") ||
            ex.Message.Contains("503") ||
            ex.Message.Contains("504"))
        {
            lastError = ex;
            await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt) * 5));
        }
        catch (Exception ex)
        {
            lastError = ex;
            await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt) * 2));
        }
    }

    throw new SpeckleException(
        $"Receive failed after {maxRetries} attempts: {lastError?.Message}", lastError);
}
```

---

## Example 6: Serverless Environment — No Local Cache (Python)

```python
from specklepy.api.client import SpeckleClient
from specklepy.api import operations
from specklepy.transports.server import ServerTransport
from specklepy.transports.memory import MemoryTransport


def serverless_receive(obj_id, stream_id, token, server_url):
    """Receive in a serverless/container environment without disk access.

    Uses MemoryTransport instead of SQLiteTransport to avoid disk I/O.
    """
    client = SpeckleClient(host=server_url)
    client.authenticate_with_token(token)

    remote = ServerTransport(stream_id=stream_id, client=client)
    local = MemoryTransport()

    # Receive with memory-only local cache
    return operations.receive(
        obj_id,
        remote_transport=remote,
        local_transport=local,
    )


def serverless_send(base, stream_id, token, server_url):
    """Send in a serverless/container environment without disk access."""
    client = SpeckleClient(host=server_url)
    client.authenticate_with_token(token)

    remote = ServerTransport(stream_id=stream_id, client=client)

    # Disable default SQLite cache — send directly to server
    return operations.send(
        base=base,
        transports=[remote],
        use_default_cache=False,
    )
```

---

## Example 7: Diagnosing Transport Errors Programmatically (Python)

```python
import sqlite3
import requests
from specklepy.logging.exceptions import SpeckleException


def diagnose_transport_error(error):
    """Classify a transport error and return actionable guidance.

    Returns a tuple of (category, message, is_retryable).
    """
    error_str = str(error)

    if isinstance(error, sqlite3.OperationalError):
        if "locked" in error_str:
            return (
                "SQLITE_LOCK",
                "Another process is using the Speckle cache. "
                "Close other Speckle connectors or use a separate scope.",
                True,
            )
        if "disk I/O" in error_str or "disk is full" in error_str:
            return (
                "DISK_FULL",
                "Disk is full. Free space or delete the Speckle cache "
                "(safe to delete — will be recreated).",
                False,
            )
        if "unable to open" in error_str:
            return (
                "PATH_ERROR",
                "Cannot open the SQLite database. Check path exists "
                "and process has write permissions.",
                False,
            )

    if isinstance(error, requests.exceptions.ConnectionError):
        return (
            "NETWORK",
            "Cannot reach the Speckle server. Check network, DNS, "
            "firewall, and proxy settings.",
            True,
        )

    if isinstance(error, requests.exceptions.Timeout):
        return (
            "TIMEOUT",
            "Request timed out. Increase timeout or check server load.",
            True,
        )

    if isinstance(error, SpeckleException):
        if "401" in error_str or "Unauthorized" in error_str:
            return (
                "AUTH_EXPIRED",
                "Authentication token expired. Re-authenticate and "
                "create a new ServerTransport.",
                True,
            )
        if "404" in error_str:
            return (
                "NOT_FOUND",
                "Stream or object not found. Verify stream ID matches "
                "the target server.",
                False,
            )
        if "No transport" in error_str:
            return (
                "NO_TRANSPORT",
                "No transport configured. Provide at least one transport "
                "or set use_default_cache=True.",
                False,
            )

    if isinstance(error, MemoryError):
        return (
            "MEMORY",
            "Out of memory. Avoid get_all_objects() on large caches. "
            "Use detachment for large object trees.",
            False,
        )

    return (
        "UNKNOWN",
        f"Unclassified transport error: {error_str}",
        False,
    )
```
