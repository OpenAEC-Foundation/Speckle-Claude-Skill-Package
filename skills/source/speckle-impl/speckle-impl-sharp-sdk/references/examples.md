# Working Code Examples (Speckle.Sdk — C#/.NET)

## Example 1: Send a Simple Object to Speckle Server

```csharp
using Speckle.Sdk;
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Models;
using Speckle.Sdk.Transports;

// 1. Set up authentication
var account = new Account
{
    token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
    serverInfo = new ServerInfo { url = "https://app.speckle.systems/" }
};

// 2. Create a Base object with data
var data = new Base();
data["name"] = "My Building";
data["height"] = 45.5;
data["floors"] = 12;
data["location"] = new Base
{
    ["latitude"] = 52.3676,
    ["longitude"] = 4.9041
};

// 3. Create transport and send
var transport = new ServerTransport(account, "YOUR_PROJECT_ID");
var cts = new CancellationTokenSource();

var (rootId, refs) = await Operations.Send(
    data,
    new ITransport[] { transport },
    cancellationToken: cts.Token
);

Console.WriteLine($"Sent object with ID: {rootId}");
```

---

## Example 2: Receive an Object from Speckle Server

```csharp
using Speckle.Sdk;
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Transports;

var account = new Account
{
    token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
    serverInfo = new ServerInfo { url = "https://app.speckle.systems/" }
};

var transport = new ServerTransport(account, "YOUR_PROJECT_ID");

// Receive with progress reporting
var progress = new Progress<ProgressArgs>(args =>
{
    Console.WriteLine($"{args.ProgressEvent}: {args.Count}");
});

var received = await Operations.Receive(
    "OBJECT_HASH_ID",
    remoteTransport: transport,
    onProgressAction: progress
);

// Access properties
Console.WriteLine($"Name: {received["name"]}");
Console.WriteLine($"Height: {received["height"]}");
```

---

## Example 3: Create Geometry with Speckle.Objects

```csharp
using Speckle.Objects.Geometry;
using Speckle.Sdk.Models;
using Speckle.Sdk.Transports;

// Create geometry objects
var point1 = new Point(0, 0, 0);
var point2 = new Point(10, 0, 0);
var point3 = new Point(10, 10, 0);
var point4 = new Point(0, 10, 0);

var line = new Line
{
    start = point1,
    end = point2
};

// CRITICAL: Wrap geometry in a Base container for viewer visibility
var container = new Base();
container["line"] = line;
container["cornerPoints"] = new List<Point> { point1, point2, point3, point4 };

// Send to server
var transport = new ServerTransport(account, projectId);
var (rootId, _) = await Operations.Send(
    container,
    new ITransport[] { transport }
);
```

---

## Example 4: Create a Custom Speckle Object

```csharp
using Speckle.Sdk.Models;

// Define a custom object type
public class StructuralBeam : Base
{
    public override string speckle_type => "MyApp.StructuralBeam";

    public double length { get; set; }
    public double width { get; set; }
    public double height { get; set; }
    public string material { get; set; }
    public double loadCapacity { get; set; }

    // Large nested objects MUST use [DetachProperty]
    [DetachProperty]
    public Mesh displayValue { get; set; }

    // Large arrays MUST use [Chunkable]
    [Chunkable(10000)]
    public List<double> stressValues { get; set; }
}

// Usage
var beam = new StructuralBeam
{
    length = 6.0,
    width = 0.3,
    height = 0.5,
    material = "C30/37",
    loadCapacity = 250.0
};

// Dynamic properties work alongside typed properties
beam["projectPhase"] = "Construction";
beam["engineerApproval"] = true;
```

---

## Example 5: Send with Multiple Transports

```csharp
using Speckle.Sdk.Transports;

// Send to server AND local SQLite simultaneously
var serverTransport = new ServerTransport(account, projectId);
var localTransport = new SQLiteTransport(
    basePath: @"C:\MyProject\.speckle",
    scope: "ProjectData"
);

var (rootId, _) = await Operations.Send(
    data,
    new ITransport[] { serverTransport, localTransport }
);

// Data is now in both locations
// Server: accessible via Speckle web UI and other clients
// Local: available offline for fast re-reads
```

---

## Example 6: Serialize and Deserialize Without Transport

```csharp
using Speckle.Sdk.Api;
using Speckle.Sdk.Models;

// Create an object
var wall = new Base();
wall["height"] = 3.0;
wall["thickness"] = 0.2;
wall["material"] = "Brick";

// Serialize to JSON string (no transport needed)
string json = Operations.Serialize(wall);

// Store, transmit, or log the JSON
File.WriteAllText("wall-data.json", json);

// Later: deserialize back to Base
string loadedJson = File.ReadAllText("wall-data.json");
Base restored = await Operations.DeserializeAsync(loadedJson);

Console.WriteLine($"Height: {restored["height"]}"); // 3.0
```

---

## Example 7: Flatten and Traverse Object Hierarchy

```csharp
using Speckle.Sdk.Models;
using Speckle.Sdk.Models.Extensions;

// After receiving a complex BIM model
var model = await Operations.Receive(objectId, remoteTransport: transport);

// Flatten the entire hierarchy
var allObjects = model.Flatten();

// Filter by speckle_type
var walls = allObjects
    .Where(obj => obj.speckle_type.Contains("Wall"))
    .ToList();

Console.WriteLine($"Found {walls.Count} walls in the model");

// Access properties on each wall
foreach (var wall in walls)
{
    var height = wall["height"];
    var baseLine = wall["baseLine"];
    Console.WriteLine($"Wall height: {height}");
}
```

---

## Example 8: Progress Reporting in a UI Application

```csharp
using Speckle.Sdk.Api;
using Speckle.Sdk.Transports;

public class SpeckleService
{
    private readonly Account _account;

    public SpeckleService(Account account)
    {
        _account = account;
    }

    public async Task<Base> ReceiveWithProgress(
        string projectId,
        string objectId,
        IProgress<string> uiProgress,
        CancellationToken cancellationToken)
    {
        var transport = new ServerTransport(_account, projectId);

        // Bridge Speckle progress to UI progress
        var speckleProgress = new Progress<ProgressArgs>(args =>
        {
            uiProgress.Report($"{args.ProgressEvent}: {args.Count} objects");
        });

        return await Operations.Receive(
            objectId,
            remoteTransport: transport,
            onProgressAction: speckleProgress,
            cancellationToken: cancellationToken
        );
    }
}
```

---

## Example 9: Using Helpers for Quick Operations

```csharp
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Models;

// Get the default account from Speckle Manager
var account = AccountManager.GetDefaultAccount();

// Quick send — no transport setup needed
var data = new Base();
data["message"] = "Hello from C#";
data["timestamp"] = DateTime.UtcNow.ToString("O");

string streamUrl = "https://app.speckle.systems/streams/YOUR_STREAM_ID";
await Helpers.Send(streamUrl, data, account);

// Quick receive — resolves URL automatically
var received = await Helpers.Receive(streamUrl, account);
Console.WriteLine(received["message"]);
```

---

## Example 10: Client API — GraphQL Operations

```csharp
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;

var account = new Account
{
    token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
    serverInfo = new ServerInfo { url = "https://app.speckle.systems/" }
};

var client = new Client(account);

// List projects (streams)
var streams = await client.StreamsGet(limit: 20);
foreach (var stream in streams)
{
    Console.WriteLine($"Project: {stream.name} (ID: {stream.id})");
}

// Get a specific project with branches
var project = await client.StreamGet("PROJECT_ID", branchesLimit: 50);
foreach (var branch in project.branches.items)
{
    Console.WriteLine($"  Model: {branch.name}, Commits: {branch.commits.totalCount}");
}

// Create a new commit (version)
var commitId = await client.CommitCreate(new CommitCreateInput
{
    streamId = "PROJECT_ID",
    branchName = "main",
    objectId = rootObjectId,
    message = "Updated structural model"
});
```

---

## Example 11: Dependency Injection Setup

```csharp
using Microsoft.Extensions.DependencyInjection;
using Speckle.Sdk.Api;
using Speckle.Sdk.Credentials;
using Speckle.Sdk.Transports;

public static class SpeckleServiceRegistration
{
    public static IServiceCollection AddSpeckle(
        this IServiceCollection services,
        string serverUrl)
    {
        // Account as singleton — one auth per app lifetime
        services.AddSingleton<Account>(provider =>
        {
            return new Account
            {
                token = Environment.GetEnvironmentVariable("SPECKLE_TOKEN"),
                serverInfo = new ServerInfo { url = serverUrl }
            };
        });

        // Client as singleton — wraps GraphQL connection
        services.AddSingleton<Client>(provider =>
        {
            var account = provider.GetRequiredService<Account>();
            return new Client(account);
        });

        // Transports as transient — each operation needs its own instance
        services.AddTransient<Func<string, ServerTransport>>(provider =>
        {
            var account = provider.GetRequiredService<Account>();
            return streamId => new ServerTransport(account, streamId);
        });

        return services;
    }
}

// Usage in application
var services = new ServiceCollection();
services.AddSpeckle("https://app.speckle.systems/");
var serviceProvider = services.BuildServiceProvider();

var client = serviceProvider.GetRequiredService<Client>();
var transportFactory = serviceProvider.GetRequiredService<Func<string, ServerTransport>>();
var transport = transportFactory("PROJECT_ID");
```
