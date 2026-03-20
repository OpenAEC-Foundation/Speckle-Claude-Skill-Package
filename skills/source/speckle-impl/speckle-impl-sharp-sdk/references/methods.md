# API Signatures Reference (Speckle.Sdk — C#/.NET)

## Operations

The `Operations` class is the primary entry point for data transfer. All methods are async.

### Send

```csharp
public async Task<(string rootObjId, IReadOnlyDictionary<string, ObjectReference> convertedReferences)> Send(
    Base value,
    IReadOnlyCollection<ITransport> transports,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

- `value` — root Base object to serialize and send. MUST NOT be null.
- `transports` — destination transports. MUST NOT be empty.
- `onProgressAction` — optional progress callback for UI feedback.
- `cancellationToken` — optional cancellation support.
- **Returns:** Tuple of (root object hash string, dictionary of converted references).
- **Throws:** `SpeckleException`, `OperationCanceledException`, `ArgumentException`.

### Receive

```csharp
public async Task<Base> Receive(
    string objectId,
    ITransport? remoteTransport = null,
    ITransport? localTransport = null,
    IProgress<ProgressArgs>? onProgressAction = null,
    CancellationToken cancellationToken = default
)
```

- `objectId` — hash of the root object to retrieve.
- `remoteTransport` — source transport (typically ServerTransport). Used on local cache miss.
- `localTransport` — cache transport. Defaults to SQLiteTransport if null.
- **Returns:** Deserialized `Base` object with all children.
- **Throws:** `SpeckleException`, `OperationCanceledException`, `TransportException`.

### Serialize

```csharp
public string Serialize(
    Base value,
    CancellationToken cancellationToken = default
)
```

- `value` — Base object to serialize.
- **Returns:** JSON string representation.

### DeserializeAsync

```csharp
public async Task<Base> DeserializeAsync(
    string value,
    CancellationToken cancellationToken = default
)
```

- `value` — JSON string to deserialize.
- **Returns:** Deserialized `Base` object.
- **Throws:** `ArgumentNullException`, `JsonReaderException`, `SpeckleException`, `TransportException`.

---

## Helpers

Simplified high-level API. Resolves stream URLs automatically.

### Helpers.Send

```csharp
public static async Task<string> Send(
    string streamUrl,
    Base value,
    Account account
)
```

- `streamUrl` — full Speckle stream URL (e.g., `https://app.speckle.systems/streams/{id}`).
- `value` — root Base object.
- `account` — authenticated Account.
- **Returns:** Root object hash string.

### Helpers.Receive

```csharp
public static async Task<Base> Receive(
    string streamUrl,
    Account account
)
```

- `streamUrl` — full Speckle stream URL with optional branch/commit reference.
- `account` — authenticated Account.
- **Returns:** Deserialized `Base` object.

---

## Client

Wraps the Speckle Server GraphQL API.

### Constructor

```csharp
public Client(Account account)
```

- `account` — Account with valid token and serverInfo.

### Key Methods

```csharp
// Projects (formerly Streams)
Task<Stream> StreamGet(string id, int branchesLimit = 10, int commitsLimit = 10)
Task<List<Stream>> StreamsGet(int limit = 10)
Task<string> StreamCreate(StreamCreateInput input)
Task<bool> StreamUpdate(StreamUpdateInput input)
Task<bool> StreamDelete(string id)

// Models (formerly Branches)
Task<Branch> BranchGet(string streamId, string branchName, int commitsLimit = 10)
Task<List<Branch>> StreamGetBranches(string streamId, int limit = 100, int commitsLimit = 10)
Task<string> BranchCreate(BranchCreateInput input)

// Versions (formerly Commits)
Task<Commit> CommitGet(string streamId, string commitId)
Task<List<Commit>> StreamGetCommits(string streamId, int limit = 10)
Task<string> CommitCreate(CommitCreateInput input)
Task<bool> CommitUpdate(CommitUpdateInput input)
Task<bool> CommitDelete(CommitDeleteInput input)

// Users
Task<User> ActiveUserGet()
Task<User> OtherUserGet(string id)
Task<List<User>> UserSearch(string query, int limit = 10)

// Server
Task<ServerInfo> ServerGet()
```

**NOTE:** The Client API uses legacy terminology (Stream, Branch, Commit) in method names. These map to the current terms: Project, Model, Version.

---

## Account

```csharp
public class Account
{
    public string token { get; set; }
    public ServerInfo serverInfo { get; set; }
    public UserInfo userInfo { get; set; }
    public bool isDefault { get; set; }
}
```

### AccountManager

```csharp
public static class AccountManager
{
    static Account GetDefaultAccount()
    static IEnumerable<Account> GetAccounts()
    static IEnumerable<Account> GetAccounts(string serverUrl)
}
```

---

## ServerTransport

```csharp
public class ServerTransport : IServerTransport, IBlobCapableTransport
{
    // Constructor (full DI version)
    public ServerTransport(
        ISpeckleHttp http,
        ISdkActivityFactory activityFactory,
        Account account,
        string streamId,
        int timeoutSeconds = 60,
        string? blobStorageFolder = null
    )

    // Simplified constructor
    public ServerTransport(Account account, string streamId)
}
```

### ITransport Interface

```csharp
public interface ITransport
{
    string TransportName { get; }
    Dictionary<string, object> TransportContext { get; }
    TimeSpan Elapsed { get; }
    CancellationToken CancellationToken { get; set; }
    IProgress<ProgressArgs>? OnProgressAction { get; set; }

    void BeginWrite();
    void EndWrite();
    Task WriteComplete();

    void SaveObject(string id, string serializedObject);
    Task<string?> GetObject(string id);
    Task<string> CopyObjectAndChildren(string id, ITransport targetTransport);
    Task<Dictionary<string, bool>> HasObjects(IReadOnlyList<string> objectIds);
}
```

### IBlobCapableTransport

```csharp
public interface IBlobCapableTransport : ITransport
{
    string BlobStorageFolder { get; }
    void SaveBlob(Blob obj);
}
```

---

## SQLiteTransport

```csharp
public class SQLiteTransport : ITransport, IDisposable, IBlobCapableTransport
{
    public SQLiteTransport(
        string? basePath = null,
        string? applicationName = null,
        string? scope = null
    )

    // Key methods beyond ITransport
    void SaveObjectSync(string id, string serializedObject)
    void DeleteObject(string id)
    void UpdateObject(string id, string serializedObject)
    IEnumerable<(string id, string data)> GetAllObjects()
}
```

**Path construction:** `{basePath}/{applicationName}/{scope}.db`

Defaults: basePath = `SpecklePathProvider.UserApplicationDataPath()`, applicationName = `"Speckle"`, scope = `"Data"`.

---

## MemoryTransport

```csharp
public class MemoryTransport : ITransport
{
    public ConcurrentDictionary<string, string> Objects { get; }

    public MemoryTransport()
}
```

All data is lost when the transport is garbage collected. Use for testing and temporary operations only.

---

## Base Class

```csharp
public class Base
{
    // Identity
    string id { get; }                    // Content-based hash
    string speckle_type { get; }          // Type identifier
    string applicationId { get; set; }    // Native app element reference
    long totalChildrenCount { get; set; } // Nested object count

    // Dynamic property access
    object this[string key] { get; set; }

    // Introspection
    IEnumerable<string> GetMembers()
    IEnumerable<string> GetDynamicMembers()
}
```

### Property Attributes

```csharp
[DetachProperty]                // Store separately, reference by hash
[Chunkable(chunkSize: 10000)]  // Split large lists into chunks
[SchemaInfo("Name", "Desc")]   // Schema metadata
```

### Flatten Extension

```csharp
// In Speckle.Sdk.Models.Extensions
public static IEnumerable<Base> Flatten(this Base root)
```

Recursively enumerates all nested Base objects in the hierarchy.

---

## ProgressArgs

```csharp
public class ProgressArgs
{
    public ProgressEvent ProgressEvent { get; }
    public long Count { get; }
}
```

Used with `IProgress<ProgressArgs>` for reporting send/receive progress.
