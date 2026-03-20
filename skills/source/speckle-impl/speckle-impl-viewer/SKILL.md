---
name: speckle-impl-viewer
description: >
  Use when embedding the Speckle viewer in a web application, loading 3D models, or implementing viewer interactions.
  Prevents missing extension initialization, incorrect loader setup, and broken event handling.
  Covers @speckle/viewer setup, Viewer class lifecycle, SpeckleLoader, UrlHelper, extensions (CameraController, FilteringExtension, SelectionExtension, DiffExtension, MeasurementsTool, SectionTool), events, and custom extension development.
  Keywords: speckle viewer, 3d viewer, webgl, load model, filter, select, diff, measure, section, camera, extension, embed.
license: MIT
compatibility: "Designed for Claude Code. Requires @speckle/viewer (latest), Speckle Server 2.x/3.x."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-impl-viewer

## Quick Reference

### Installation

```bash
npm install --save @speckle/viewer
```

The package is written in TypeScript and provides full type definitions.

### Architecture Overview

| Component | Role |
|-----------|------|
| `Viewer` | Core class -- manages WebGL context, scene graph, extensions, rendering loop |
| `SpeckleLoader` | Fetches and deserializes Speckle objects into the viewer scene |
| `UrlHelper` | Resolves Speckle project/model URLs into loader-compatible resource URLs |
| `Extension` | Base class for all viewer plugins (camera, selection, filtering, etc.) |
| `WorldTree` | Internal scene graph hierarchy storing all loaded objects |
| `SpeckleRenderer` | Low-level WebGL rendering engine built on Three.js internals |

### Viewer Lifecycle

```
1. Create container element  -->  HTML div with explicit dimensions
2. new Viewer(container, params)  -->  Construct viewer instance
3. await viewer.init()  -->  Initialize WebGL context and assets
4. viewer.createExtension(...)  -->  Register required extensions
5. await viewer.loadObject(loader)  -->  Load 3D model data
6. viewer.on(event, handler)  -->  Subscribe to viewer events
7. viewer.dispose()  -->  Release all GPU resources on cleanup
```

### Critical Warnings

**NEVER** call `loadObject()`, `createExtension()`, or any other viewer method before `await viewer.init()` completes. The viewer internals are NOT ready until init resolves. Calling methods before init causes silent failures or runtime errors.

**NEVER** omit `viewer.dispose()` when removing the viewer from the DOM. Failing to dispose causes GPU memory leaks that accumulate across page navigations in SPAs.

**NEVER** pass an empty string as the auth token in `SpeckleLoader` when loading private models. An empty token causes the loader to silently load zero objects with no error. ALWAYS provide a valid personal access token for private resources.

**NEVER** create extensions before calling `await viewer.init()`. Extensions depend on viewer internals that are initialized during `init()`.

**ALWAYS** set explicit dimensions (width + height) on the container element. A zero-size container causes the WebGL context to fail silently.

**ALWAYS** call `viewer.resize()` when the container element changes size dynamically (e.g., window resize, panel toggle). The viewer does NOT detect container size changes automatically.

---

## Viewer Class

### Constructor

```typescript
new Viewer(container: HTMLElement, params: ViewerParams)
```

### ViewerParams

```typescript
interface ViewerParams {
  showStats: boolean;              // Display performance stats panel
  environmentSrc: Asset;           // HDRI environment map URL for IBL lighting
  verbose: boolean;                // Enable debug logging
  restrictInputToCanvas: boolean;  // Limit input handling to canvas element only
}
```

Use `DefaultViewerParams` for sensible defaults (stats off, verbose off, default HDRI, canvas restriction off).

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `init` | `(): Promise<void>` | Initialize viewer. MUST be called first. |
| `loadObject` | `(loader: SpeckleLoader, autoFit?: boolean): Promise<void>` | Load objects via loader. `autoFit=true` frames camera. |
| `dispose` | `(): void` | Release all GPU resources. ALWAYS call on cleanup. |
| `createExtension` | `<T extends Extension>(type: new () => T): T` | Create and register an extension. Returns instance. |
| `getExtension` | `<T extends Extension>(type: new () => T): T` | Retrieve a registered extension. |
| `hasExtension` | `<T extends Extension>(type: Constructor<T>): boolean` | Check if extension is registered. |
| `on` | `<T extends ViewerEvent>(eventType: T, handler: (arg: ViewerEventPayload[T]) => void): void` | Subscribe to viewer events. |
| `getRenderer` | `(): SpeckleRenderer` | Access low-level rendering engine. |
| `getWorldTree` | `(): WorldTree` | Access scene graph hierarchy. |
| `getObjectProperties` | `(resourceURL?: string): Promise<PropertyInfo[]>` | Get filterable properties from loaded objects. |
| `getViews` | `(): SpeckleView[]` | Get saved views from loaded model. |
| `screenshot` | `(): Promise<string>` | Capture current view as base64 data URL. |
| `resize` | `(): void` | Recalculate viewport dimensions. |
| `requestRender` | `(flags?: number): void` | Request a render frame. |
| `setLightConfiguration` | `(config: LightConfiguration): void` | Update lighting setup. |
| `unloadObject` | `(url: string): Promise<void>` | Unload a specific resource. |
| `unloadAll` | `(): Promise<void>` | Unload all loaded resources. |
| `cancelLoad` | `(url: string, unload?: boolean): Promise<void>` | Cancel an in-progress load. |
| `query` | `<T extends Query>(query: T): QueryArgsResultMap[T['operation']]` | Execute a spatial query. |

### Accessors

| Accessor | Type | Description |
|----------|------|-------------|
| `Utils` | `Utils` | Utility functions (coordinate conversion, etc.) |
| `World` | `World` | World-space information |

---

## SpeckleLoader and UrlHelper

### Loading Workflow

```typescript
import { SpeckleLoader, UrlHelper } from "@speckle/viewer";

// Step 1: Resolve project/model URL to resource URLs
const urls = await UrlHelper.getResourceUrls(
  "https://app.speckle.systems/projects/PROJECT_ID/models/MODEL_ID"
);

// Step 2: Load each resource
for (const url of urls) {
  const loader = new SpeckleLoader(viewer.getWorldTree(), url, authToken);
  await viewer.loadObject(loader, true);
}
```

### SpeckleLoader Constructor

```typescript
new SpeckleLoader(worldTree: WorldTree, url: string, authToken: string)
```

| Parameter | Description |
|-----------|-------------|
| `worldTree` | The viewer's WorldTree instance (from `viewer.getWorldTree()`) |
| `url` | Resource URL returned by `UrlHelper.getResourceUrls()` |
| `authToken` | Personal access token. Use `""` for public models ONLY. |

### UrlHelper

```typescript
UrlHelper.getResourceUrls(speckleUrl: string): Promise<string[]>
```

Accepts a Speckle project/model URL and returns an array of resource URLs suitable for `SpeckleLoader`. ALWAYS use this method -- NEVER construct resource URLs manually.

### Loader Events

```typescript
enum LoaderEvent {
  LoadProgress = 'load-progress',    // { progress: number; id: string }
  LoadCancelled = 'load-cancelled',  // string
  LoadWarning = 'load-warning'       // { message: string }
}
```

---

## ViewerEvent

| Event | Payload | Description |
|-------|---------|-------------|
| `ViewerEvent.ObjectClicked` | Click intersection data | Object clicked in viewport |
| `ViewerEvent.ObjectDoubleClicked` | Click intersection data | Object double-clicked |
| `ViewerEvent.LoadComplete` | Resource URL | Model loading finished |
| `ViewerEvent.UnloadComplete` | Resource URL | Model unloading finished |
| `ViewerEvent.UnloadAllComplete` | void | All models unloaded |
| `ViewerEvent.FilteringStateSet` | `FilteringState` | Filtering state changed |
| `ViewerEvent.LightConfigUpdated` | `LightConfiguration` | Light config changed |

---

## Extensions

All extensions inherit from `Extension`. Create them via `viewer.createExtension()` AFTER init.

### Extension Base Class

```typescript
abstract class Extension {
  protected viewer: IViewer;
  get enabled(): boolean;
  set enabled(value: boolean);
  get inject(): Array<Constructor<Extension>>;  // Declare dependencies
  onEarlyUpdate(deltaTime?: number): void;
  onLateUpdate(deltaTime?: number): void;
  onRender(): void;
  onResize(): void;
}
```

### CameraController

Controls camera navigation: orbit, pan, zoom, fly modes.

| Method | Signature |
|--------|-----------|
| `setCameraView` | `(objectIds: string[], transition: boolean, fit?: number): void` |
| `setCameraView` | `(view: CanonicalView \| SpeckleView \| InlineView \| PolarView, transition: boolean, fit?: number): void` |
| `setCameraView` | `(bounds: Box3, transition: boolean, fit?: number): void` |
| `setPerspectiveCameraOn` | `(): void` |
| `setOrthoCameraOn` | `(): void` |
| `toggleCameras` | `(): void` |
| `enableRotations` | `(): void` |
| `disableRotations` | `(): void` |
| `setCameraPlanes` | `(targetVolume: Box3, offsetScale?: number): void` |

Camera events: `Stationary`, `Dynamic`, `FrameUpdate`, `ProjectionChanged`.

### SelectionExtension

Handles object picking and selection highlighting.

| Method | Signature |
|--------|-----------|
| `selectObjects` | `(ids: string[], multiSelect?: boolean): void` |
| `unselectObjects` | `(ids?: string[]): void` |
| `getSelectedObjects` | `(): Array<Record<string, unknown>>` |
| `getSelectedNodes` | `(): Array<TreeNode>` |

Automatically listens to `ObjectClicked`, `ObjectDoubleClicked`, and `PointerMove` events.

### FilteringExtension

Controls object visibility, isolation, and color filtering.

| Method | Signature |
|--------|-----------|
| `hideObjects` | `(objectIds: string[], stateKey?: string, includeDescendants?: boolean, ghost?: boolean): FilteringState` |
| `showObjects` | `(objectIds: string[], stateKey?: string, includeDescendants?: boolean): FilteringState` |
| `isolateObjects` | `(objectIds: string[], stateKey?: string, includeDescendants?: boolean, ghost?: boolean): FilteringState` |
| `unIsolateObjects` | `(objectIds: string[], stateKey?: string, includeDescendants?: boolean, ghost?: boolean): FilteringState` |
| `setColorFilter` | `(prop: PropertyInfo, ghost?: boolean): FilteringState` |
| `removeColorFilter` | `(): FilteringState` |
| `setUserObjectColors` | `(groups: { objectIds: string[]; color: string }[]): FilteringState` |
| `removeUserObjectColors` | `(): FilteringState` |
| `resetFilters` | `(): FilteringState` |

### DiffExtension

Visual comparison between two model versions.

| Method | Signature |
|--------|-----------|
| `diff` | `(urlA: string, urlB: string, mode: VisualDiffMode, authToken?: string): Promise<DiffResult>` |
| `undiff` | `(): Promise<void>` |
| `updateVisualDiff` | `(time?: number, mode?: VisualDiffMode): void` |

`VisualDiffMode`: `PLAIN` or `COLORED`. `DiffResult` contains `unchanged`, `added`, `removed`, `modified` arrays of `TreeNode`.

### MeasurementsTool

Interactive distance and area measurements.

| Method | Signature |
|--------|-----------|
| `clearMeasurements` | `(): void` |
| `addMeasurement` | `(data: MeasurementData): void` |
| `removeMeasurement` | `(): void` |
| `toMeasurementData` | `(): MeasurementData[]` |

`MeasurementType`: `PERPENDICULAR`, `POINTTOPOINT`, `AREA`, `POINT`.

### SectionTool

Section plane/box for cutting through models.

| Method | Signature |
|--------|-----------|
| `toggle` | `(): void` |
| `setBox` | `(targetBox: Box3, offset?: number): void` |
| `getBox` | `(): Box3` |

Events: `SectionToolEvent.DragStart`, `SectionToolEvent.DragEnd`, `SectionToolEvent.Updated` (payload: `Plane[]`).

---

## Custom Extensions

```typescript
import { Extension, IViewer } from "@speckle/viewer";

class MyExtension extends Extension {
  // Declare dependencies on other extensions
  get inject() {
    return [CameraController]; // Auto-injected by viewer
  }

  // Lifecycle hooks
  onEarlyUpdate(deltaTime?: number): void {
    // Called before viewer update each frame
  }

  onLateUpdate(deltaTime?: number): void {
    // Called after viewer update each frame
  }

  onRender(): void {
    // Called after each render pass
  }

  onResize(): void {
    // Called when viewport resizes
  }
}

// Register with viewer
const myExt = viewer.createExtension(MyExtension);
```

**ALWAYS** declare dependencies via the `inject` getter. The viewer resolves and injects them automatically. NEVER manually instantiate extensions with `new`.

---

## Rendering Pipeline

The viewer uses a custom WebGL rendering pipeline built on Three.js internals. Access via `viewer.getRenderer()`:

- Scene management and material overrides
- Custom render passes
- Shadow configuration
- Post-processing effects

This is an advanced API. ALWAYS use extensions for standard interactions. Only use `SpeckleRenderer` when built-in extensions do not cover your use case.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Complete API signatures for Viewer, extensions, types
- [references/examples.md](references/examples.md) -- Working code examples from setup to rendering
- [references/anti-patterns.md](references/anti-patterns.md) -- What NOT to do, with explanations

### Official Sources

- https://docs.speckle.systems/developers/viewer/viewer-api.md
- https://docs.speckle.systems/developers/viewer/basic-setup.md
- https://docs.speckle.systems/developers/viewer/extensions/
- https://docs.speckle.systems/developers/viewer/loader-api.md
