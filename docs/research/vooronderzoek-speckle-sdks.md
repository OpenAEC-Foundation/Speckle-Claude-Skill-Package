# Vooronderzoek: Speckle SDKs (Python, C#, Viewer)

> Status: RAW — not yet processed into core files
> Date: 2026-03-20
> Sources: Official Speckle documentation, GitHub repositories, PyPI, NuGet

---

## 1. SpecklePy — Python SDK

### 1.1 Installation and Requirements

SpecklePy is the official Python SDK for Speckle. It requires **Python 3.10 or higher** (tested on 3.10, 3.11, 3.12, 3.13). The current version as of this writing is **3.2.4**.

```bash
pip install specklepy
pip install specklepy==3.0.10   # specific version
pip install --upgrade specklepy  # upgrade existing
```

Automatic dependencies installed with specklepy:
- `gql[requests,websockets]` — GraphQL API client
- `pydantic` — schema validation and data handling
- `appdirs` — cross-platform system directory paths
- `stringcase` — text formatting utilities
- `ujson` — high-performance JSON processing
- `deprecated` — deprecation notification system

Virtual environment setup is strongly recommended. The team recommends `uv` as the package manager, but `venv` and `conda` are also supported.

### 1.2 SpeckleClient Class

The `SpeckleClient` class is the primary entry point for interacting with Speckle Server's GraphQL API.

**Constructor:**
```python
SpeckleClient(
    host: str = "app.speckle.systems",
    use_ssl: bool = True,
    verify_certificate: bool = True,
) -> None
```

**Class attributes:**
- `DEFAULT_HOST = 'app.speckle.systems'`
- `USE_SSL = True`

**Instance attribute:**
- `account: Account` — the currently authenticated Account object

**Authentication methods:**
```python
def authenticate_with_token(token: str) -> None
def authenticate_with_account(account: Account) -> None
```

`authenticate_with_token` uses a personal access token created from the Speckle Server profile settings. It creates a synchronous GraphQL entrypoint internally.

`authenticate_with_account` uses an Account object, typically obtained from locally stored credentials added via the Speckle Manager desktop app.

**Raw GraphQL execution:**
```python
def execute_query(query: str) -> Dict
```
Executes arbitrary GraphQL queries when the SDK resource methods do not cover a specific need.

### 1.3 Authentication Patterns

**Token-based authentication (primary):**
```python
import os
from specklepy.api.client import SpeckleClient

client = SpeckleClient(host="app.speckle.systems")
token = os.environ.get("SPECKLE_TOKEN")
client.authenticate_with_token(token)
```

**Local account authentication:**
```python
from specklepy.api.credentials import get_local_accounts, get_default_account

accounts = get_local_accounts()
account = get_default_account()
client = SpeckleClient(host=account.serverInfo.url)
client.authenticate_with_account(account)
```

**Account object properties:**
- `account.serverInfo.url`, `account.serverInfo.name`, `account.serverInfo.company`
- `account.userInfo.id`, `account.userInfo.name`, `account.userInfo.email`
- `account.token` — the personal access token string
- `account.isDefault` — boolean flag

**Token scopes:**
- `streams:read` — read project data
- `streams:write` — create/modify projects
- `profile:read` / `Profile:read` — read user profile
- `Profile:email` — access user email

Best practice: store tokens in environment variables or secret managers. For multi-user applications, implement OAuth 2.0 rather than sharing tokens.

### 1.4 Resource Modules

The SpeckleClient exposes the following resource modules as properties:

| Resource Property | Resource Class | Purpose |
|---|---|---|
| `client.project` | `ProjectResource` | Create, get, update, delete, list projects |
| `client.model` | `ModelResource` | Create, get, update, delete, list models |
| `client.version` | `VersionResource` | Create, get, list, update, delete versions |
| `client.active_user` | `ActiveUserResource` | Operations on the authenticated user's profile and projects |
| `client.other_user` | `OtherUserResource` | Lookup and search for other user accounts |
| `client.server` | `ServerResource` | Server information and metadata retrieval |
| `client.subscription` | `SubscriptionResource` | Real-time subscription-based notifications for project updates |
| `client.workspace` | `WorkspaceResource` | Workspace details, members, projects, settings (workspace-enabled servers only) |
| `client.project_invite` | `ProjectInviteResource` | Project invitation management |
| `client.file_import` | `FileImportResource` | File import operations |

**Key method patterns per resource:**

**ProjectResource:**
```python
from specklepy.core.api.inputs.project_inputs import ProjectCreateInput
from specklepy.core.api.enums import ProjectVisibility

project = client.project.create(ProjectCreateInput(
    name="My Project",
    description="Description",
    visibility=ProjectVisibility.PRIVATE
))
project = client.project.get(project_id)
```

**ModelResource:**
```python
from specklepy.core.api.inputs.model_inputs import CreateModelInput

model = client.model.create(CreateModelInput(
    project_id=project.id,
    name="Architecture",
    description="Architecture model"
))
```

**VersionResource:**
```python
from specklepy.core.api.inputs.version_inputs import CreateVersionInput

version = client.version.create(CreateVersionInput(
    project_id=project.id,
    model_id=model.id,
    object_id=object_id,
    message="Initial version"
))
version = client.version.get(project_id, version_id)
root_object_id = version.referenced_object
```

### 1.5 Base Class and Object Model

Every Speckle object inherits from `Base`. The Base class provides identity, serialization, type checking, and dynamic properties.

**Core identity features:**
- `speckle_type` — a protected identifier string like `"Objects.Geometry.Point"`. CANNOT be changed after class definition; attempts to modify it are silently ignored.
- `get_id()` — generates a unique hash based on object content. WARNING: expensive for large objects because it serializes the entire instance.
- `applicationId` — links objects across sends to track native application references (e.g., Revit element IDs).

**Property system:**

Base supports both typed (class-defined with validation) and dynamic (runtime-added) properties:

```python
# Three assignment approaches:
obj.name = "value"             # Attribute style
obj["name"] = "value"          # Dictionary style
Point(x=1.0, y=2.0, z=3.0)    # Constructor initialization
```

**Property introspection:**
- `get_member_names()` — returns all properties (typed + dynamic)
- `get_typed_member_names()` — returns class-defined properties only
- `get_dynamic_member_names()` — returns runtime-added properties only

**Type checking:** Typed properties validate input. Setting `Point.x = "not a number"` raises an error: "it expects type 'float', but received type 'str'".

**Property name rules:** Empty strings, multiple `@` symbols, and characters like `.` or `/` are INVALID property names.

**Creating custom objects:**
```python
class Wall(Base, speckle_type="MyApp.Wall"):
    height: float
    material: Optional[str] = None
```

Use namespace prefixes to avoid naming conflicts across platforms.

### 1.6 Geometry Objects

Key geometry classes reside in `specklepy.objects.geometry`:

**Point:**
```python
from specklepy.objects.geometry import Point
p = Point(x=1.0, y=2.0, z=3.0)
```
Core coordinate object with `x`, `y`, `z` float properties.

**Line:**
```python
from specklepy.objects.geometry import Line
line = Line(start=Point(x=0, y=0, z=0), end=Point(x=10, y=10, z=10))
```
Defines line segments with `start` and `end` Point properties.

**Polyline:**
```python
from specklepy.objects.geometry import Polyline
# Constructed from a flat list of coordinate values
```

**Mesh:**
Large geometry structure. Supports detachment and chunking for efficient serialization. Mesh data includes vertices, faces, colors, and texture coordinates as large arrays.

**CRITICAL WARNING:** Sending geometry primitives (Point, Line, Mesh) directly will NOT make them visible in the 3D viewer. You MUST wrap them in a Base container:

```python
from specklepy.objects import Base
from specklepy.objects.geometry import Point, Line, Polyline

container = Base()
container.line = line
container.rectangle = polyline
container.points = [p1, p2, p3, p4]
```

### 1.7 Operations Module

The `operations` module handles sending and receiving data through transports.

**Send:**
```python
from specklepy.api import operations
from specklepy.transports.server import ServerTransport

transport = ServerTransport(stream_id=project.id, client=client)
object_id = operations.send(base=object, transports=[transport])
```

`object_id` is a unique hash of the serialized data. Note that `ServerTransport` still uses `stream_id` parameter naming (legacy terminology; projects were formerly called streams).

**Receive:**
```python
received_data = operations.receive(
    obj_id=root_object_id,
    remote_transport=transport
)
```

Returns the deserialized Base object with all nested children.

**Serialization:**
```python
json_str = operations.serialize(base_object)
base_object = operations.deserialize(json_str)
```

### 1.8 ServerTransport

The `ServerTransport` class connects operations to a Speckle Server instance.

**Constructor options:**
```python
ServerTransport(stream_id=project_id, client=client)
# OR
ServerTransport(stream_id=project_id, token=token, url=server_url)
# OR
ServerTransport(stream_id=project_id, account=account)
```

The `stream_id` parameter corresponds to the project ID in current Speckle terminology.

### 1.9 Data Traversal

Data traversal is the systematic process of navigating Speckle's object graphs. Objects form tree-like structures requiring strategic navigation.

**Graph complexity levels:**
- Simple: 1-2 levels deep (custom data with properties and arrays)
- Medium: 2-3 levels (collections with nested geometry objects)
- Complex: 3+ levels (BIM data with hierarchical references)

**Five traversal strategies:**

1. **Property-Filtered Traversal** (recommended for v3) — recursively check objects for a `properties` dictionary, filter by specific values. Best for BIM data where semantic info lives in `properties`.

2. **displayValue-Based Traversal** — collect only objects with a `displayValue` property. These represent viewer-selectable, atomic elements.

3. **elements[] Hierarchy Traversal** — navigate through `elements` array properties, following logical organizational structures.

4. **Full Recursive Traversal** — visit every object regardless of type. Most comprehensive but slowest.

5. **Type-Filtered Traversal** — check `speckle_type` to identify matching objects. Limited for v3 BIM data where most objects are generic `DataObject` instances.

**Key implementation rules:**
- ALWAYS verify property existence with `hasattr()` before access
- ALWAYS skip private members beginning with underscores
- Handle properties that may be single values or lists
- Use early termination when searching for specific objects
- Implement caching for repeated queries

### 1.10 Local Data Paths

Speckle stores local account information and object cache databases at OS-specific locations:
- **Windows:** `%APPDATA%\Speckle` or `<USER>\AppData\Roaming\Speckle`
- **Linux:** `$XDG_DATA_HOME` or `~/.local/share/Speckle` (default)
- **macOS:** `~/.config/Speckle`

### 1.11 Advanced Serialization Concepts

**Chunkable properties:** Large arrays are automatically split into chunks during serialization. For example, a 100,000-item vertices array might be split into 10 chunks of 10,000 items each.

**Detachable properties:** Nested objects prefixed with `@` are stored separately and referenced by their hash ID. Commonly used for `@displayValue` meshes on BIM objects. This enables lazy loading and deduplication.

---

## 2. Speckle.Sdk — C# / .NET SDK

### 2.1 Package Structure

The C# SDK is organized into three primary NuGet packages:

| Package | Purpose |
|---|---|
| `Speckle.Sdk` | Core: Send/Receive operations, Serialization, API wrappers |
| `Speckle.Objects` | Domain model classes for data conversions between tools |
| `Speckle.Automate.Sdk` | Specialized toolkit for Speckle Automate integration |

Supporting package:
- `Speckle.Sdk.Dependencies` — external dependency isolation via IL Repack

**Technical requirements:**
- Target: **.NET Standard 2.0**
- Development requires: .NET 8.0.4xx SDK
- Tested on Windows and macOS
- License: Apache-2.0
- Current repository: `specklesystems/speckle-sharp-sdk` (the newer SDK, replacing the older `speckle-sharp`)

### 2.2 Old vs New SDK

The Speckle C# ecosystem transitioned from `speckle-sharp` to `speckle-sharp-sdk`:

- **speckle-sharp (legacy):** The original C# SDK with monolithic architecture. NuGet packages were named `Speckle.Core`, `Speckle.Objects`, etc.
- **speckle-sharp-sdk (current):** Modernized SDK with dependency isolation, targeting .NET Standard 2.0. NuGet packages are `Speckle.Sdk`, `Speckle.Objects`, `Speckle.Automate.Sdk`.

The new SDK focuses on clean dependency boundaries to prevent version conflicts when embedded in host applications (Revit, Rhino, etc.).

### 2.3 Client and Account

**Account creation (without Speckle Manager):**
```csharp
var account = new Account();
account.token = "YOUR-PERSONAL-ACCESS-TOKEN";
account.serverInfo = new ServerInfo { url = "https://app.speckle.systems/" };
```

**Client initialization:**
```csharp
var client = new Client(account);
```

The Account object holds authentication credentials. In environments with Speckle Manager installed, accounts can be retrieved from locally stored credentials.

### 2.4 Operations

**Send data:**
```csharp
// Full control — Operations.Send with ServerTransport
var transport = new ServerTransport(account, streamId);
var objectId = await Operations.Send(baseObject, transport);

// Simplified — Helpers.Send
await Helpers.Send(streamUrl, baseObject, account);
```

**Receive data:**
```csharp
// Full control
var receivedObject = await Operations.Receive(objectId, transport);

// Simplified
var received = await Helpers.Receive(streamUrl, account);
```

**Serialization:**
```csharp
string json = Operations.Serialize(baseObject);
Base deserialized = Operations.Deserialize(json);
```

### 2.5 Base Class in C#

The `Base` class in C# behaves as "a dictionary with added Speckle smarts," allowing organic composition of data through dynamic property assignment.

**Key attributes for properties:**

- `[DetachProperty]` — marks a property for detached serialization. The object is stored separately and referenced by hash ID. ALWAYS use for large nested objects like display meshes.
- `[Chunkable(chunkSize)]` — splits large lists into chunks during serialization. Use for large arrays (vertices, faces, colors).
- `[SchemaInfo(name, description)]` — provides metadata about the property for schema generation and documentation.

**Dynamic properties:** Properties can be added at runtime just like in Python. The Base class supports dictionary-style access alongside typed properties.

**Flatten extension:** The SDK provides a `Flatten()` extension method (in `Speckle.Sdk.Models.Extensions`) to recursively flatten nested object hierarchies into a flat enumerable.

### 2.6 IL Repack Dependency Isolation

The `Speckle.Sdk.Dependencies` project uses **IL Repack** technology to merge and internalize external dependencies. This is CRITICAL for connector development because:

1. Host applications (Revit, Rhino, etc.) load their own dependencies at specific versions.
2. Without isolation, Speckle's dependencies could conflict with the host application's dependencies.
3. IL Repack merges all external DLLs into a single assembly with internalized types, preventing namespace collisions.

This means connector developers do NOT need to worry about dependency version conflicts when building Speckle integrations for specific host applications.

### 2.7 Speckle.Objects Domain Model

The `Speckle.Objects` package contains domain-specific classes for AEC data:

- **Geometry:** Point, Line, Polyline, Curve, Mesh, Brep, Surface, Vector, Plane, Box, Circle, Arc, Ellipse
- **Built Environment:** Wall, Floor, Beam, Column, Room, Level, GridLine
- **Structural:** Node, Element1D, Element2D, Element3D, Property1D, Property2D, Material
- **Other:** View, Parameter, DataTable, DisplayStyle

Each class extends `Base` and defines typed properties with appropriate serialization attributes.

---

## 3. @speckle/viewer — JavaScript/TypeScript Viewer

### 3.1 Installation

```bash
npm install --save @speckle/viewer
```

The package is written in TypeScript and provides full type definitions.

### 3.2 Viewer Class

**Constructor:**
```typescript
new Viewer(container: HTMLElement, params: ViewerParams)
```

**ViewerParams:**
- `showStats: boolean` — displays a performance stats panel
- `environmentSrc: Asset` — URL of the image used for indirect image-based lighting (IBL)
- `verbose: boolean` — enables viewer debug logs
- `restrictInputToCanvas: boolean` — limits input handling to the canvas element only

A convenience object `DefaultViewerParams` provides sensible defaults.

**Core methods:**

```typescript
init(): Promise<void>
```
Initializes the viewer asynchronously and loads required assets. MUST be called before any other operation.

```typescript
loadObject(loader: SpeckleLoader, autoFit?: boolean): Promise<void>
```
Loads objects via a specified loader. Set `autoFit` to `true` to automatically frame the camera around loaded content.

```typescript
dispose(): void
```
Disposes the viewer instance and releases all GPU resources. ALWAYS call this when removing the viewer from the DOM.

```typescript
createExtension<T extends Extension>(type: new () => T): T
```
Creates and registers an extension of the specified type. Returns the extension instance.

```typescript
getExtension<T extends Extension>(type: new () => T): T
```
Retrieves a previously registered extension. Returns undefined if not found.

```typescript
getRenderer(): SpeckleRenderer
```
Gets the SpeckleRenderer instance for low-level rendering access.

```typescript
getWorldTree(): WorldTree
```
Gets the WorldTree instance that stores the scene graph hierarchy.

### 3.3 SpeckleLoader and UrlHelper

**Loading workflow:**
```typescript
import { SpeckleLoader, UrlHelper } from "@speckle/viewer";

const urls = await UrlHelper.getResourceUrls("https://app.speckle.systems/projects/...");
for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
    await viewer.loadObject(loader, true);
}
```

`UrlHelper.getResourceUrls()` takes a Speckle project/model URL and returns the resource URLs needed for loading. The `SpeckleLoader` constructor takes the WorldTree, a resource URL, and an authentication token (empty string for public models).

### 3.4 Events

The viewer emits events through the `ViewerEvent` enum:

| Event | Description |
|---|---|
| `ViewerEvent.ObjectClicked` | Fired when an object is clicked |
| `ViewerEvent.ObjectDoubleClicked` | Fired when an object is double-clicked |
| `ViewerEvent.LoadComplete` | Fired when object loading finishes |
| `ViewerEvent.UnloadComplete` | Fired when object unloading finishes |
| `ViewerEvent.UnloadAllComplete` | Fired when all objects are unloaded |
| `ViewerEvent.FilteringStateSet` | Fired when filtering state changes |
| `ViewerEvent.LightConfigUpdated` | Fired when light configuration changes |

### 3.5 Extensions

All extensions inherit from the base `Extension` class which provides:
- `enabled` property for toggling
- `inject` accessor for declaring extension dependencies
- Lifecycle hooks: `onEarlyUpdate()`, `onLateUpdate()`, `onRender()`, `onResize()`

Extensions are created via the viewer's `createExtension()` method:

```typescript
const camera = viewer.createExtension(CameraController);
const selection = viewer.createExtension(SelectionExtension);
```

**Key extensions:**

- **CameraController** — camera navigation (orbit, pan, zoom, fly). Handles user input and provides programmatic camera control.
- **SelectionExtension** — object picking and selection. Responds to click events and manages the selection state.
- **FilteringExtension** — object visibility filtering by properties, categories, or custom predicates.
- **DiffExtension** — visual comparison between two versions of a model, highlighting added, removed, and modified elements.
- **MeasurementsTool** — distance and area measurement tools for interactive model analysis.
- **SectionTool** — section plane/box tools for cutting through the model to reveal interior structures.

### 3.6 Complete Setup Example

```typescript
import {
    Viewer,
    DefaultViewerParams,
    SpeckleLoader,
    UrlHelper,
    CameraController,
    SelectionExtension
} from "@speckle/viewer";

async function setup() {
    const container = document.getElementById("speckle");
    const params = DefaultViewerParams;
    params.showStats = true;
    params.verbose = true;

    const viewer = new Viewer(container, params);
    await viewer.init();

    viewer.createExtension(CameraController);
    viewer.createExtension(SelectionExtension);

    const urls = await UrlHelper.getResourceUrls(
        "https://app.speckle.systems/projects/PROJECT_ID/models/MODEL_ID"
    );
    for (const url of urls) {
        const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
        await viewer.loadObject(loader, true);
    }
}

setup();
```

### 3.7 Custom Rendering Pipeline

The viewer uses a custom WebGL rendering pipeline built on Three.js internals. The `SpeckleRenderer` instance (accessed via `viewer.getRenderer()`) provides low-level access to:
- Scene management
- Material overrides
- Custom render passes
- Shadow configuration
- Post-processing effects

This is an advanced API intended for developers who need custom visualization beyond what the built-in extensions provide.

---

## 4. Cross-SDK Comparison

| Feature | SpecklePy (Python) | Speckle.Sdk (C#) | @speckle/viewer (TS) |
|---|---|---|---|
| Installation | `pip install specklepy` | NuGet: `Speckle.Sdk` | `npm install @speckle/viewer` |
| Min runtime | Python 3.10+ | .NET Standard 2.0 | Modern browser with WebGL |
| Auth | Token or Account | Token or Account | Token in SpeckleLoader |
| Send/Receive | `operations.send()` / `operations.receive()` | `Operations.Send()` / `Operations.Receive()` | N/A (viewer only) |
| Base class | `Base` with `@dataclass` pattern | `Base` with attributes | N/A |
| Object model | `specklepy.objects.geometry` | `Speckle.Objects` | Loaded from server |
| Serialization | `operations.serialize()` | `Operations.Serialize()` | Built into loader |
| Transport | `ServerTransport` | `ServerTransport` | `SpeckleLoader` |

---

## 5. Anti-Patterns and Common Mistakes

### Python SDK

1. **Sending geometry without a Base container.** Sending `Point`, `Line`, or `Mesh` objects directly to the server will succeed, but they will NOT be visible in the 3D viewer. ALWAYS wrap geometry in a `Base` container with named properties.

2. **Hardcoding tokens in source code.** NEVER embed personal access tokens in code. ALWAYS use environment variables or secret managers.

3. **Calling `get_id()` in loops.** The `get_id()` method serializes the entire object to compute a hash. Calling it repeatedly on large objects causes severe performance degradation.

4. **Ignoring transport cleanup.** ServerTransport objects hold network connections. Not properly managing them can lead to resource leaks.

5. **Using deprecated stream/branch/commit terminology.** The API has migrated to project/model/version terminology. While legacy names still work, new code should use the current naming.

6. **Not handling `hasattr()` checks during traversal.** Accessing properties that do not exist on a Base object raises AttributeError. ALWAYS check with `hasattr()` first.

7. **Assuming flat data structures.** Speckle data is hierarchical. NEVER assume objects are in a flat list; ALWAYS implement recursive traversal.

### C# SDK

1. **Ignoring dependency isolation in connectors.** When building connectors for host applications (Revit, Rhino), ALWAYS use the `Speckle.Sdk.Dependencies` package to prevent version conflicts.

2. **Forgetting `[DetachProperty]` on large nested objects.** Without detachment, large child objects are serialized inline, causing bloated payloads and poor performance.

3. **Using the old `speckle-sharp` packages.** The legacy packages are deprecated. ALWAYS use the newer `Speckle.Sdk` packages from `speckle-sharp-sdk`.

4. **Not awaiting async operations.** All Send/Receive operations are async. Blocking on them with `.Result` or `.Wait()` can cause deadlocks in UI applications.

### Viewer

1. **Not calling `viewer.init()` before loading.** The init method MUST be called before any other operation. Loading without init causes silent failures.

2. **Not calling `viewer.dispose()` on cleanup.** Failing to dispose causes GPU memory leaks. ALWAYS dispose when removing the viewer from the DOM.

3. **Creating extensions before init.** Extensions depend on viewer internals that are set up during init. ALWAYS create extensions after `await viewer.init()`.

4. **Using empty auth token for private models.** The SpeckleLoader's third parameter is the auth token. Passing an empty string for private models will fail silently with no objects loaded.

---

## 6. Open Questions for Skills

1. What are the exact method signatures for all resource methods (ProjectResource.list, ModelResource.delete, etc.)? The auto-generated docs at specklepy.speckle.systems may have more detail.
2. What are the specific Mesh constructor parameters (vertices format, faces format, colors format)?
3. What is the exact Polyline constructor — flat coordinate list or list of Points?
4. What are the C# Helpers.Send() and Helpers.Receive() exact signatures?
5. How does subscription work in practice — what events can be subscribed to?
6. What is the complete list of Speckle.Objects classes in the C# domain model?
7. What viewer events carry payload data, and what is the payload structure?
8. How does the DiffExtension compare two versions programmatically?
9. What is the FilteringExtension API for programmatic filtering (not just UI)?
10. What are the exact SpeckleLoader constructor parameters for authenticated access?

---

## 7. Sources Consulted

| Source | URL | Accessed |
|---|---|---|
| SpecklePy Introduction | https://docs.speckle.systems/developers/sdks/python/introduction.md | 2026-03-20 |
| SpecklePy Installation | https://docs.speckle.systems/developers/sdks/python/getting-started/installation.md | 2026-03-20 |
| SpecklePy Quickstart | https://docs.speckle.systems/developers/sdks/python/getting-started/quickstart.md | 2026-03-20 |
| SpecklePy Authentication | https://docs.speckle.systems/developers/sdks/python/getting-started/authentication.md | 2026-03-20 |
| SpecklePy Client API Reference | https://docs.speckle.systems/developers/sdks/python/api-reference/client.md | 2026-03-20 |
| SpecklePy Objects Concepts | https://docs.speckle.systems/developers/sdks/python/concepts/objects.md | 2026-03-20 |
| SpecklePy Data Traversal | https://docs.speckle.systems/developers/sdks/python/concepts/data-traversal.md | 2026-03-20 |
| SpecklePy Auto-Generated Docs | https://specklepy.speckle.systems/specklepy/api/client/ | 2026-03-20 |
| SpecklePy GitHub Repository | https://github.com/specklesystems/specklepy | 2026-03-20 |
| Speckle.Sdk (.NET) Introduction | https://docs.speckle.systems/developers/sdks/dotnet/introduction.md | 2026-03-20 |
| Speckle Sharp SDK GitHub | https://github.com/specklesystems/speckle-sharp-sdk | 2026-03-20 |
| Speckle Guide — Python | https://speckle.guide/dev/python.html | 2026-03-20 |
| Speckle Guide — .NET | https://speckle.guide/dev/dotnet.html | 2026-03-20 |
| Viewer Installation | https://docs.speckle.systems/developers/viewer/installation.md | 2026-03-20 |
| Viewer Basic Setup | https://docs.speckle.systems/developers/viewer/basic-setup.md | 2026-03-20 |
| Viewer API Reference | https://docs.speckle.systems/developers/viewer/viewer-api.md | 2026-03-20 |
| Viewer Extensions | https://docs.speckle.systems/developers/viewer/extensions | 2026-03-20 |
| Speckle Docs LLMs Index | https://docs.speckle.systems/llms.txt | 2026-03-20 |
