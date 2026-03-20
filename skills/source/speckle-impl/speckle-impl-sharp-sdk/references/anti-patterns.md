# Anti-Patterns (Speckle.Sdk — C#/.NET)

## 1. Using Legacy speckle-sharp Packages

```csharp
// WRONG: Legacy packages are DEPRECATED
<PackageReference Include="Speckle.Core" Version="2.x" />

// CORRECT: Use the new Speckle.Sdk packages
<PackageReference Include="Speckle.Sdk" Version="*" />
<PackageReference Include="Speckle.Objects" Version="*" />
```

**WHY**: The `speckle-sharp` repository and its NuGet packages (`Speckle.Core`) are DEPRECATED. The new `speckle-sharp-sdk` repository provides `Speckle.Sdk` with proper dependency isolation, .NET Standard 2.0 targeting, and active maintenance. Legacy packages will NOT receive security updates or bug fixes.

---

## 2. Blocking on Async Operations

```csharp
// WRONG: Blocking with .Result causes deadlocks in UI applications
var result = Operations.Send(data, transports).Result;
var received = Operations.Receive(objectId, transport).Wait();

// CORRECT: ALWAYS use await
var (rootId, refs) = await Operations.Send(data, transports);
var received = await Operations.Receive(objectId, transport);
```

**WHY**: Calling `.Result` or `.Wait()` on async operations blocks the calling thread. In UI applications (WPF, WinForms, or host application threads like Revit), this causes a deadlock because the synchronization context cannot process the async continuation while the thread is blocked. ALWAYS use `async/await` throughout the call chain.

---

## 3. Missing DetachProperty on Large Nested Objects

```csharp
// WRONG: Large mesh serialized inline — bloated payload
public class MyWall : Base
{
    public Mesh displayValue { get; set; }  // No detachment!
}

// CORRECT: Detach large nested objects
public class MyWall : Base
{
    [DetachProperty]
    public Mesh displayValue { get; set; }  // Stored separately, referenced by hash
}
```

**WHY**: Without `[DetachProperty]`, the entire mesh (potentially millions of vertices) is serialized inline within the parent object's JSON. This creates massive payloads, prevents deduplication, and makes partial loading impossible. Detached objects are stored separately and referenced by hash ID, enabling lazy loading and efficient transfer.

---

## 4. Missing Chunkable on Large Arrays

```csharp
// WRONG: Huge array serialized as single block
public class MyMesh : Base
{
    public List<double> vertices { get; set; }   // 100,000+ items in one chunk
    public List<int> faces { get; set; }
}

// CORRECT: Chunk large arrays for efficient serialization
public class MyMesh : Base
{
    [Chunkable(10000)]
    public List<double> vertices { get; set; }   // Split into manageable chunks

    [Chunkable(10000)]
    public List<int> faces { get; set; }
}
```

**WHY**: Without chunking, large arrays are serialized as a single JSON block. This prevents incremental transfer, makes deduplication impossible (the entire array must change for any element change), and consumes excessive memory during serialization. Chunking splits arrays into fixed-size segments that can be transferred and cached independently.

---

## 5. Building Connectors Without IL Repack Isolation

```csharp
// WRONG: Direct dependency — will conflict with host application
<PackageReference Include="Speckle.Sdk" Version="*" />
<!-- Revit already loads Newtonsoft.Json 9.x, Speckle needs 13.x → CRASH -->

// CORRECT: Use Speckle.Sdk.Dependencies for isolation
<PackageReference Include="Speckle.Sdk" Version="*" />
<PackageReference Include="Speckle.Sdk.Dependencies" Version="*" />
```

**WHY**: Host applications (Revit, Rhino, Grasshopper, AutoCAD) load their own dependencies at specific versions. Without IL Repack isolation via `Speckle.Sdk.Dependencies`, Speckle's dependencies (Newtonsoft.Json, System.Text.Json, GraphQL libraries) conflict with the host's versions, causing `FileLoadException`, `MissingMethodException`, or silent data corruption at runtime. IL Repack merges and internalizes all external dependencies to prevent namespace collisions.

---

## 6. Hardcoding Authentication Tokens

```csharp
// WRONG: Token exposed in source code
var account = new Account
{
    token = "abc123def456ghi789",  // Committed to git!
    serverInfo = new ServerInfo { url = "https://app.speckle.systems/" }
};

// CORRECT: Use environment variables or Speckle Manager
var account = new Account
{
    token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
    serverInfo = new ServerInfo { url = "https://app.speckle.systems/" }
};

// BEST: Use Speckle Manager for interactive applications
var account = AccountManager.GetDefaultAccount();
```

**WHY**: Personal access tokens committed to source control are a security breach. Anyone with repository access gains full Speckle account access. Tokens in compiled binaries can be extracted with decompilation tools. ALWAYS use environment variables, secret managers, or the Speckle Manager credential store.

---

## 7. Omitting CancellationToken in Interactive Applications

```csharp
// WRONG: No way to cancel a long-running operation
await Operations.Send(data, transports);
await Operations.Receive(objectId, transport);

// CORRECT: ALWAYS provide CancellationToken
var cts = new CancellationTokenSource();
// Wire cts.Cancel() to a UI cancel button

await Operations.Send(data, transports, cancellationToken: cts.Token);
await Operations.Receive(objectId, transport, cancellationToken: cts.Token);
```

**WHY**: Large models can take minutes to send or receive. Without a CancellationToken, there is no graceful way to stop the operation. The user may be forced to kill the process, potentially corrupting the local cache or leaving partial data on the server.

---

## 8. Sending Geometry Directly Without a Container

```csharp
// WRONG: Bare geometry will NOT be visible in the Speckle viewer
var mesh = new Mesh();
mesh.vertices = new List<double> { 0, 0, 0, 1, 0, 0, 1, 1, 0 };
mesh.faces = new List<int> { 3, 0, 1, 2 };

await Operations.Send(mesh, transports);  // Invisible in viewer!

// CORRECT: Wrap geometry in a Base container
var container = new Base();
container["@displayValue"] = mesh;  // @ prefix enables detachment
container["name"] = "My Surface";

await Operations.Send(container, transports);
```

**WHY**: The Speckle viewer renders objects that have a `displayValue` property containing geometry. Sending bare geometry objects directly creates data that is stored correctly but cannot be visualized. ALWAYS wrap geometry in a container with `displayValue` (or `@displayValue` for automatic detachment).

---

## 9. Reusing Transport Instances Across Operations

```csharp
// WRONG: Reusing a transport that has completed its lifecycle
var transport = new ServerTransport(account, streamId);
await Operations.Send(data1, new[] { transport });
await Operations.Send(data2, new[] { transport });  // Undefined behavior!

// CORRECT: Create a new transport for each operation
var transport1 = new ServerTransport(account, streamId);
await Operations.Send(data1, new[] { transport1 });

var transport2 = new ServerTransport(account, streamId);
await Operations.Send(data2, new[] { transport2 });
```

**WHY**: `Operations.Send()` calls `BeginWrite()` and `EndWrite()` on the transport as part of its lifecycle. After `EndWrite()`, the transport's background sending thread is terminated. Reusing the transport may result in objects not being uploaded, silent data loss, or exceptions.

---

## 10. Using get_all_objects on Large SQLite Caches

```csharp
// WRONG: Loads entire database into memory
var sqliteTransport = new SQLiteTransport();
var allObjects = sqliteTransport.GetAllObjects();  // Out of memory!

// CORRECT: Retrieve specific objects by ID
var singleObject = await sqliteTransport.GetObject("specific-hash-id");

// Or check existence in bulk
var existenceMap = await sqliteTransport.HasObjects(
    new List<string> { "id1", "id2", "id3" }
);
```

**WHY**: The default Speckle SQLite cache (`%APPDATA%\Speckle\Data.db`) grows monotonically and can reach multiple gigabytes. `GetAllObjects()` loads every object into memory, causing `OutOfMemoryException`. ALWAYS use `GetObject()` for specific objects or `HasObjects()` for bulk existence checks.

---

## 11. Mixing Stream ID and Server Credentials

```csharp
// WRONG: Stream ID from server A, credentials for server B
var account = new Account
{
    token = "token-for-server-B",
    serverInfo = new ServerInfo { url = "https://server-b.example.com/" }
};
var transport = new ServerTransport(account, "stream-id-from-server-a");
// Authentication succeeds (server-level) but operations fail with 404

// CORRECT: Ensure stream ID and server match
var account = new Account
{
    token = "token-for-server-a",
    serverInfo = new ServerInfo { url = "https://server-a.example.com/" }
};
var transport = new ServerTransport(account, "stream-id-from-server-a");
```

**WHY**: Authentication is verified at the server level, not the stream level. The transport connects successfully, but all object operations return 404 errors because the stream does not exist on the authenticated server. This produces confusing errors that look like permission issues.

---

## 12. Ignoring Dispose on SQLiteTransport

```csharp
// WRONG: Connection leak — SQLite file remains locked
var transport = new SQLiteTransport();
await Operations.Receive(objectId, localTransport: transport);
// transport is never disposed — file lock persists

// CORRECT: Use using statement for automatic disposal
using var transport = new SQLiteTransport();
await Operations.Receive(objectId, localTransport: transport);
// Connection closed automatically

// Or explicit dispose
var transport = new SQLiteTransport();
try
{
    await Operations.Receive(objectId, localTransport: transport);
}
finally
{
    transport.Dispose();
}
```

**WHY**: `SQLiteTransport` implements `IDisposable` and holds an open connection to a SQLite database file. Not disposing it leaves the file locked, which can prevent other processes (including other Speckle operations) from accessing the cache. ALWAYS use `using` statements or explicit `Dispose()` calls.
