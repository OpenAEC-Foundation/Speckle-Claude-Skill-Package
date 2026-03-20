# Transport Examples

> Working code examples for send/receive operations with Speckle transports in Python and C#.

---

## Python: Basic Send to Server

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account
from specklepy.transports.server import ServerTransport
from specklepy.api.operations import send
from specklepy.objects.base import Base

# 1. Authenticate
client = SpeckleClient(host="https://app.speckle.systems")
account = get_default_account()
client.authenticate_with_account(account)

# 2. Create transport (auth path 1: SpeckleClient)
transport = ServerTransport(
    stream_id="your_stream_id",
    client=client,
)

# 3. Create data
obj = Base()
obj.name = "My Wall"
obj.height = 3.0
obj.width = 5.0

# 4. Send (use_default_cache=True is the default -- local SQLite cache is used)
root_hash = send(base=obj, transports=[transport])
print(f"Sent object with hash: {root_hash}")
```

---

## Python: Basic Receive from Server

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account
from specklepy.transports.server import ServerTransport
from specklepy.api.operations import receive

# 1. Authenticate
client = SpeckleClient(host="https://app.speckle.systems")
account = get_default_account()
client.authenticate_with_account(account)

# 2. Create transport
transport = ServerTransport(
    stream_id="your_stream_id",
    client=client,
)

# 3. Receive (cache-first: checks local SQLite before fetching from server)
obj = receive(
    obj_id="abc123def456...",
    remote_transport=transport,
)
print(f"Received: {obj.name}")
```

---

## Python: Send with Token + URL Authentication

```python
from specklepy.transports.server import ServerTransport
from specklepy.api.operations import send

# Auth path 3: raw token + URL
transport = ServerTransport(
    stream_id="your_stream_id",
    token="your_personal_access_token",
    url="https://app.speckle.systems",
)

root_hash = send(base=my_object, transports=[transport])
```

---

## Python: Send with Account Object Authentication

```python
from specklepy.api.credentials import get_default_account
from specklepy.transports.server import ServerTransport
from specklepy.api.operations import send

# Auth path 2: Account object
account = get_default_account()
transport = ServerTransport(
    stream_id="your_stream_id",
    account=account,
)

root_hash = send(base=my_object, transports=[transport])
```

---

## Python: Send Without Default Cache (Ephemeral Environment)

```python
from specklepy.transports.server import ServerTransport
from specklepy.api.operations import send

transport = ServerTransport(stream_id="...", client=client)

# Disable local SQLite cache -- use ONLY in serverless/ephemeral environments
root_hash = send(
    base=my_object,
    transports=[transport],
    use_default_cache=False,
)
```

---

## Python: Local-Only Storage with SQLiteTransport

```python
from specklepy.transports.sqlite import SQLiteTransport
from specklepy.api.operations import send, receive

# Store in project-local database
local = SQLiteTransport(base_path="/path/to/project/.speckle")

# Send to local storage only
root_hash = send(base=my_object, transports=[local], use_default_cache=False)

# Receive from local storage
obj = receive(obj_id=root_hash, local_transport=local)
```

---

## Python: MemoryTransport for Testing

```python
from specklepy.transports.memory import MemoryTransport
from specklepy.api.operations import send, receive

# In-memory transport -- no disk, no network
mem = MemoryTransport()

# Send
root_hash = send(base=my_object, transports=[mem], use_default_cache=False)

# Receive from memory (pass as local_transport)
obj = receive(obj_id=root_hash, local_transport=mem)

# Verify
assert obj.name == my_object.name
```

---

## Python: Multi-Transport Send

```python
from specklepy.transports.server import ServerTransport
from specklepy.transports.sqlite import SQLiteTransport
from specklepy.api.operations import send

server = ServerTransport(stream_id="...", client=client)
project_db = SQLiteTransport(base_path="/project/.speckle")

# Send to BOTH server and project-local database simultaneously
root_hash = send(
    base=my_object,
    transports=[server, project_db],
    use_default_cache=True,  # Also writes to default SQLite cache
)
# Objects now exist in: default cache + server + project DB
```

---

## Python: Raw Serialize / Deserialize

```python
from specklepy.api.operations import serialize, deserialize
from specklepy.transports.memory import MemoryTransport

# Serialize without transports (entire tree inlined, no detaching)
json_str = serialize(base=my_object, write_transports=None)

# Serialize with transport (normal detaching and chunking)
mem = MemoryTransport()
json_str = serialize(base=my_object, write_transports=[mem])

# Deserialize with transport for resolving detached children
obj = deserialize(obj_string=json_str, read_transport=mem)
```

---

## C#: Basic Send to Server

```csharp
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Transports;

// 1. Get account and create transport
var account = AccountManager.GetDefaultAccount();
var transport = new ServerTransport(http, activityFactory, account, "your_stream_id");

// 2. Create data
var obj = new Base();
obj["name"] = "My Wall";
obj["height"] = 3.0;
obj["width"] = 5.0;

// 3. Send with progress and cancellation
using var cts = new CancellationTokenSource();
var progress = new Progress<ProgressArgs>(args =>
{
    Console.WriteLine($"{args.ProgressEvent}: {args.Count}");
});

var (rootId, refs) = await operations.Send(
    obj,
    new ITransport[] { transport },
    onProgressAction: progress,
    cancellationToken: cts.Token
);

Console.WriteLine($"Sent with hash: {rootId}");
```

---

## C#: Basic Receive from Server

```csharp
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Transports;

var account = AccountManager.GetDefaultAccount();
var transport = new ServerTransport(http, activityFactory, account, "your_stream_id");

using var cts = new CancellationTokenSource();
var progress = new Progress<ProgressArgs>(args =>
{
    Console.WriteLine($"{args.ProgressEvent}: {args.Count}");
});

// Cache-first receive: checks local SQLite before server
var obj = await operations.Receive(
    "abc123def456...",
    remoteTransport: transport,
    onProgressAction: progress,
    cancellationToken: cts.Token
);

Console.WriteLine($"Received: {obj["name"]}");
```

---

## C#: Multi-Transport Send

```csharp
var serverTransport = new ServerTransport(http, activityFactory, account, streamId);
var sqliteTransport = new SQLiteTransport(basePath: @"C:\MyProject\.speckle");

// Send to both server and project-local database
var (rootId, refs) = await operations.Send(
    myData,
    new ITransport[] { serverTransport, sqliteTransport },
    cancellationToken: cts.Token
);
```

---

## C#: SQLiteTransport with Custom Path

```csharp
// Project-local database
var transport = new SQLiteTransport(
    basePath: @"C:\Projects\MyBuilding\.speckle",
    applicationName: "MyApp",
    scope: "ModelData"
);
// Creates: C:\Projects\MyBuilding\.speckle\MyApp\ModelData.db
```

---

## C#: MemoryTransport for Testing

```csharp
var mem = new MemoryTransport();

// Send to memory
var (rootId, refs) = await operations.Send(
    testObject,
    new ITransport[] { mem }
);

// Receive from memory
var result = await operations.Receive(
    rootId,
    localTransport: mem
);

Assert.AreEqual(testObject["name"], result["name"]);
```

---

## C#: Cancellation Pattern

```csharp
// ALWAYS use CancellationToken in interactive applications
using var cts = new CancellationTokenSource();

// Allow user to cancel via UI button
cancelButton.Click += (_, _) => cts.Cancel();

try
{
    var obj = await operations.Receive(
        objectId,
        remoteTransport: serverTransport,
        cancellationToken: cts.Token
    );
}
catch (OperationCanceledException)
{
    Console.WriteLine("Operation cancelled by user.");
}
```

---

## C#: Progress Reporting Pattern

```csharp
var progress = new Progress<ProgressArgs>(args =>
{
    // Update UI on the correct thread
    Dispatcher.Invoke(() =>
    {
        statusLabel.Text = $"{args.ProgressEvent}: {args.Count} objects";
    });
});

var (rootId, refs) = await operations.Send(
    data,
    new ITransport[] { serverTransport },
    onProgressAction: progress,
    cancellationToken: cts.Token
);
```

---

## C#: Raw Serialize / Deserialize

```csharp
// Serialize to JSON string
string json = operations.Serialize(myObject);

// Deserialize back to Base
Base obj = await operations.DeserializeAsync(json, cts.Token);
```

---

## Python: Manual Transport Lifecycle

```python
from specklepy.transports.sqlite import SQLiteTransport

transport = SQLiteTransport()

# Manual lifecycle -- required when using transports directly (not via send/receive)
transport.begin_write()

transport.save_object("hash1", '{"speckle_type": "Base", "name": "obj1"}')
transport.save_object("hash2", '{"speckle_type": "Base", "name": "obj2"}')

# ALWAYS call end_write() to flush the final batch
transport.end_write()

# Read back
obj_json = transport.get_object("hash1")

# Clean up
transport.close()
```
