---
name: speckle-impl-sharp-sdk
description: >
  Use when writing C#/.NET code with Speckle.Sdk to send, receive, or query Speckle data.
  Prevents old vs new SDK confusion, missing IL Repack dependency isolation, and incorrect DI registration.
  Covers Speckle.Sdk NuGet installation, old vs new SDK migration, Client/Account setup, Operations (Send/Receive/Serialize/Deserialize), Helpers (simplified API), IL Repack, Speckle.Objects domain model, and dependency injection patterns.
  Keywords: speckle sdk, csharp, dotnet, Speckle.Sdk, nuget, Operations.Send, Operations.Receive, Helpers, IL Repack, Speckle.Objects, C# integration, .NET Speckle, build connector.
license: MIT
compatibility: "Designed for Claude Code. Requires .NET Standard 2.0+, Speckle.Sdk (latest), Speckle Server 2.x/3.x."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-sharp-sdk

## Quick Reference

### NuGet Packages

| Package | Purpose | Required |
|---------|---------|----------|
| `Speckle.Sdk` | Core: Send/Receive, Serialization, API client, Transports | YES |
| `Speckle.Objects` | Domain model classes (geometry, BIM, structural) | YES for AEC data |
| `Speckle.Sdk.Dependencies` | IL Repack dependency isolation for plugin environments | YES for connectors |
| `Speckle.Automate.Sdk` | Speckle Automate function development | Only for Automate |

### Target Framework

| Requirement | Value |
|-------------|-------|
| Target | .NET Standard 2.0 |
| Development SDK | .NET 8.0.4xx |
| Tested platforms | Windows, macOS |
| License | Apache-2.0 |
| Repository | `specklesystems/speckle-sharp-sdk` |

### Critical Warnings

**NEVER** use the legacy `speckle-sharp` packages (`Speckle.Core`, old `Speckle.Objects`). They are DEPRECATED. ALWAYS use the new `Speckle.Sdk` packages from the `speckle-sharp-sdk` repository.

**NEVER** call `.Result` or `.Wait()` on async Send/Receive operations in UI applications. This causes deadlocks. ALWAYS use `await`.

**NEVER** build a connector for a host application (Revit, Rhino, etc.) without using `Speckle.Sdk.Dependencies` for dependency isolation. Version conflicts WILL crash the host application.

**NEVER** omit `[DetachProperty]` on large nested objects (meshes, display values). Without detachment, the entire child object is serialized inline, causing bloated payloads and severe performance degradation.

**NEVER** forget to pass a `CancellationToken` to `Operations.Send()` and `Operations.Receive()` in interactive applications. Without it, there is no way to gracefully cancel long-running operations.

**NEVER** hardcode personal access tokens in source code. ALWAYS use environment variables, secret managers, or the Speckle Manager account system.

---

## Old vs New SDK: Migration Guide

### DEPRECATED: speckle-sharp (Legacy)

The original C# SDK lived in the `speckle-sharp` repository with monolithic architecture:

| Legacy Package | Status | Replacement |
|----------------|--------|-------------|
| `Speckle.Core` | DEPRECATED | `Speckle.Sdk` |
| `Speckle.Objects` (old) | DEPRECATED | `Speckle.Objects` (new, from speckle-sharp-sdk) |
| `Speckle.DesktopUI` | DEPRECATED | Not replaced (connector-specific UI) |

### CURRENT: speckle-sharp-sdk

The new SDK focuses on clean dependency boundaries, .NET Standard 2.0 targeting, and IL Repack isolation for safe embedding in host applications.

**Migration checklist:**
1. Remove all `Speckle.Core` NuGet references
2. Install `Speckle.Sdk` and `Speckle.Objects` from NuGet
3. Update namespace imports: `Speckle.Core.*` → `Speckle.Sdk.*`
4. For connectors: add `Speckle.Sdk.Dependencies` for IL Repack isolation
5. Verify all `Operations.*` calls compile against the new signatures

---

## Installation

```xml
<!-- .csproj -->
<ItemGroup>
  <PackageReference Include="Speckle.Sdk" Version="*" />
  <PackageReference Include="Speckle.Objects" Version="*" />
  <!-- For connector development only: -->
  <PackageReference Include="Speckle.Sdk.Dependencies" Version="*" />
</ItemGroup>
```

```bash
# CLI
dotnet add package Speckle.Sdk
dotnet add package Speckle.Objects
```

---

## Client and Account Setup

### Account Creation (Manual: No Speckle Manager)

```csharp
var account = new Account();
account.token = "YOUR-PERSONAL-ACCESS-TOKEN";
account.serverInfo = new ServerInfo { url = "https://app.speckle.systems/" };
```

### Account from Environment Variable

```csharp
var account = new Account
{
    token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
    serverInfo = new ServerInfo
    {
        url = Environment.GetEnvironmentVariable("SPECKLE_SERVER_URL")
            ?? "https://app.speckle.systems/"
    }
};
```

### Client Initialization

```csharp
var client = new Client(account);
```

The `Client` class wraps the Speckle Server GraphQL API. It provides methods for managing projects (streams), models (branches), versions (commits), and user operations.

### Account from Speckle Manager

When Speckle Manager is installed, accounts are stored locally and can be retrieved:

```csharp
// Get the default account configured in Speckle Manager
var account = AccountManager.GetDefaultAccount();

// Get all locally stored accounts
var accounts = AccountManager.GetAccounts();

// Get accounts for a specific server
var accounts = AccountManager.GetAccounts("https://app.speckle.systems");
```

---

## Operations API

All operations in `Speckle.Sdk` are async. ALWAYS use `await`.

### Send

```csharp
var transport = new ServerTransport(account, streamId);
var (rootObjId, convertedRefs) = await Operations.Send(
    baseObject,
    new ITransport[] { transport },
    onProgressAction: progress,
    cancellationToken: cts.Token
);
```

**Parameters:**
- `value` (`Base`) — the root object to send
- `transports` (`IReadOnlyCollection<ITransport>`) — destination transports (MUST NOT be empty)
- `onProgressAction` (`IProgress<ProgressArgs>?`) — optional progress callback
- `cancellationToken` (`CancellationToken`) — optional cancellation support

**Returns:** Tuple of `(string rootObjId, IReadOnlyDictionary<string, ObjectReference> convertedReferences)`

**Flow:**
1. Validates inputs (non-null value, non-empty transports)
2. Calls `BeginWrite()` on all transports
3. Serializes the object tree via `SpeckleObjectSerializer`
4. Writes serialized objects to ALL transports simultaneously
5. Calls `EndWrite()` on all transports (in finally block)
6. Returns root object hash and converted references

### Receive

```csharp
var transport = new ServerTransport(account, streamId);
var receivedObject = await Operations.Receive(
    objectId,
    remoteTransport: transport,
    localTransport: null,  // uses default SQLiteTransport
    onProgressAction: progress,
    cancellationToken: cts.Token
);
```

**Parameters:**
- `objectId` (`string`) — hash of the root object
- `remoteTransport` (`ITransport?`) — source transport (typically ServerTransport)
- `localTransport` (`ITransport?`) — cache transport (defaults to SQLiteTransport)
- `onProgressAction` (`IProgress<ProgressArgs>?`) — optional progress callback
- `cancellationToken` (`CancellationToken`) — optional cancellation support

**Returns:** `Base` — the deserialized root object with all children

**Flow:**
1. If `localTransport` is null, creates default SQLiteTransport
2. Checks local transport first (cache-first strategy)
3. On cache miss, calls `CopyObjectAndChildren()` on remote to populate local cache
4. Deserializes from local transport
5. Returns reconstructed `Base` object

### Serialize / Deserialize

```csharp
// Serialize to JSON
string json = Operations.Serialize(baseObject);

// Deserialize from JSON (async)
Base deserialized = await Operations.DeserializeAsync(json, cancellationToken);
```

---

## Helpers: Simplified API

The `Helpers` class provides a streamlined API for common operations:

```csharp
// Send — takes a stream URL directly
await Helpers.Send(streamUrl, baseObject, account);

// Receive — takes a stream URL directly
var received = await Helpers.Receive(streamUrl, account);
```

Helpers automatically resolve the stream URL into server address, stream ID, and branch/commit references. Use Helpers for quick prototyping and scripts. Use the full `Operations` API for production code requiring progress reporting, cancellation, and multi-transport patterns.

---

## ServerTransport

```csharp
var transport = new ServerTransport(
    http,              // ISpeckleHttp — HTTP client abstraction
    activityFactory,   // ISdkActivityFactory — telemetry
    account,           // Account — authentication
    streamId,          // string — project/stream ID
    timeoutSeconds: 60,
    blobStorageFolder: null
);
```

**Key behaviors:**
- Uses a background `SendingThreadMain()` thread for upload processing
- Implements server-side deduplication via `HasObjects()` before uploading
- Separates blob uploads from object uploads
- `BeginWrite()` starts the background sending thread
- `WriteComplete()` polls until all queued data has been uploaded
- `EndWrite()` terminates the sending thread

**The `stream_id` parameter corresponds to the project ID** in current Speckle terminology. Projects were formerly called streams.

---

## Base Class

The `Base` class is the foundation of all Speckle objects. It behaves as "a dictionary with added Speckle smarts."

### Property Attributes

| Attribute | Purpose | When to Use |
|-----------|---------|-------------|
| `[DetachProperty]` | Stores object separately, referenced by hash | ALWAYS for large nested objects (meshes, display values) |
| `[Chunkable(size)]` | Splits large lists into chunks during serialization | ALWAYS for large arrays (vertices, faces, colors) |
| `[SchemaInfo(name, desc)]` | Metadata for schema generation | Documentation and tooling |

### Dynamic Properties

```csharp
var obj = new Base();
obj["customProperty"] = "value";       // Dictionary-style
obj["nestedObject"] = new Base();      // Nested objects
obj["numbers"] = new List<double>();   // Collections
```

### Flatten Extension

```csharp
using Speckle.Sdk.Models.Extensions;

// Recursively flatten nested object hierarchies
IEnumerable<Base> allObjects = rootObject.Flatten();
```

---

## Speckle.Objects Domain Model

The `Speckle.Objects` package provides typed classes for AEC data:

### Geometry

| Class | Namespace | Key Properties |
|-------|-----------|----------------|
| `Point` | `Speckle.Objects.Geometry` | `x`, `y`, `z` |
| `Vector` | `Speckle.Objects.Geometry` | `x`, `y`, `z` |
| `Line` | `Speckle.Objects.Geometry` | `start`, `end` |
| `Polyline` | `Speckle.Objects.Geometry` | `value` (flat coordinate list) |
| `Curve` | `Speckle.Objects.Geometry` | Various curve types |
| `Mesh` | `Speckle.Objects.Geometry` | `vertices`, `faces`, `colors`, `textureCoordinates` |
| `Brep` | `Speckle.Objects.Geometry` | Surface representation |
| `Plane` | `Speckle.Objects.Geometry` | `origin`, `normal`, `xdir`, `ydir` |
| `Box` | `Speckle.Objects.Geometry` | `basePlane`, `xSize`, `ySize`, `zSize` |
| `Circle` | `Speckle.Objects.Geometry` | `plane`, `radius` |
| `Arc` | `Speckle.Objects.Geometry` | `plane`, `radius`, `startAngle`, `endAngle` |

### Built Environment

| Class | Namespace | Key Properties |
|-------|-----------|----------------|
| `Wall` | `Speckle.Objects.BuiltElements` | `height`, `baseLine`, `displayValue` |
| `Floor` | `Speckle.Objects.BuiltElements` | `outline`, `displayValue` |
| `Beam` | `Speckle.Objects.BuiltElements` | `baseLine`, `displayValue` |
| `Column` | `Speckle.Objects.BuiltElements` | `baseLine`, `displayValue` |
| `Room` | `Speckle.Objects.BuiltElements` | `name`, `number`, `displayValue` |
| `Level` | `Speckle.Objects.BuiltElements` | `name`, `elevation` |
| `GridLine` | `Speckle.Objects.BuiltElements` | `baseCurve`, `label` |

### Structural

| Class | Namespace |
|-------|-----------|
| `Node` | `Speckle.Objects.Structural.Geometry` |
| `Element1D` | `Speckle.Objects.Structural.Geometry` |
| `Element2D` | `Speckle.Objects.Structural.Geometry` |
| `Element3D` | `Speckle.Objects.Structural.Geometry` |
| `Property1D` | `Speckle.Objects.Structural.Properties` |
| `Property2D` | `Speckle.Objects.Structural.Properties` |
| `Material` | `Speckle.Objects.Structural.Materials` |

Every class extends `Base` and defines typed properties with serialization attributes.

---

## IL Repack: Dependency Isolation

### The Problem

Host applications (Revit, Rhino, Grasshopper, Blender) load their own dependencies at specific versions. Without isolation, Speckle's dependencies (Newtonsoft.Json, System.Text.Json, etc.) conflict with the host's versions, causing runtime crashes.

### The Solution

`Speckle.Sdk.Dependencies` uses **IL Repack** to merge and internalize all external dependencies into a single assembly with internalized types. This prevents namespace collisions entirely.

### When to Use IL Repack

| Scenario | Use IL Repack? |
|----------|---------------|
| Standalone .NET application | NO — no host dependency conflicts |
| Revit add-in / connector | YES — Revit loads its own Newtonsoft.Json |
| Rhino plugin / Grasshopper component | YES — Rhino has its own dependency set |
| Blender add-on (via .NET interop) | YES — isolation prevents conflicts |
| Unit test project | NO — test runners handle dependencies |
| Speckle Automate function | NO — runs in isolated container |
| Console tool / CLI | NO — no host application |

### How It Works

1. `Speckle.Sdk.Dependencies` is added as a NuGet reference
2. At build time, IL Repack merges external DLLs into the Speckle assembly
3. All merged types become `internal`, preventing namespace collisions
4. The connector DLL ships as a self-contained unit

---

## Dependency Injection Patterns

### Registering Speckle Services

```csharp
// In your DI container setup (e.g., Microsoft.Extensions.DependencyInjection)
services.AddSingleton<Account>(provider =>
{
    var account = new Account
    {
        token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
        serverInfo = new ServerInfo
        {
            url = "https://app.speckle.systems/"
        }
    };
    return account;
});

services.AddTransient<Client>(provider =>
{
    var account = provider.GetRequiredService<Account>();
    return new Client(account);
});
```

### Transport as Transient

ALWAYS register transports as transient — each operation needs its own transport instance:

```csharp
services.AddTransient<ServerTransport>(provider =>
{
    var account = provider.GetRequiredService<Account>();
    return new ServerTransport(account, streamId);
});
```

---

## Progress Reporting

```csharp
var progress = new Progress<ProgressArgs>(args =>
{
    Console.WriteLine($"{args.ProgressEvent}: {args.Count}");
});

await Operations.Send(data, transports, onProgressAction: progress);
await Operations.Receive(objectId, transport, onProgressAction: progress);
```

ALWAYS provide progress reporting in interactive applications to give users feedback on long-running operations.

---

## Reference Links

- [references/methods.md](references/methods.md) — API signatures for Operations, Client, Base, ServerTransport, Helpers
- [references/examples.md](references/examples.md) — Working code examples for common Speckle C# workflows
- [references/anti-patterns.md](references/anti-patterns.md) — What NOT to do, with WHY explanations

### Official Sources

- https://docs.speckle.systems/developers/sdks/dotnet/introduction.md
- https://github.com/specklesystems/speckle-sharp-sdk
- https://speckle.guide/dev/dotnet.html
- https://www.nuget.org/packages/Speckle.Sdk
