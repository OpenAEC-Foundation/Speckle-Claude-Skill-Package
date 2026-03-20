# Anti-Patterns (@speckle/viewer)

## 1. Using Viewer Before Init

```typescript
// WRONG: Calling methods before init() resolves
const viewer = new Viewer(container, DefaultViewerParams);
viewer.createExtension(CameraController); // Fails silently!
const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
await viewer.loadObject(loader); // Crashes or loads nothing

// CORRECT: ALWAYS await init() first
const viewer = new Viewer(container, DefaultViewerParams);
await viewer.init();
viewer.createExtension(CameraController);
const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
await viewer.loadObject(loader, true);
```

**WHY**: `init()` creates the WebGL context, loads environment assets, and sets up internal state. Nothing works without it. There is no error message -- operations simply fail silently.

---

## 2. Forgetting to Dispose

```typescript
// WRONG: Removing viewer from DOM without cleanup
function removeViewer() {
  document.getElementById("speckle")!.innerHTML = "";
  // GPU memory leaked! WebGL context still alive!
}

// CORRECT: ALWAYS call dispose() before removing
async function removeViewer(viewer: Viewer) {
  await viewer.unloadAll();
  viewer.dispose();
  document.getElementById("speckle")!.innerHTML = "";
}
```

**WHY**: The viewer allocates GPU resources (textures, buffers, shaders) that are NOT garbage collected. Without `dispose()`, each viewer mount/unmount cycle leaks memory. In SPAs with navigation, this accumulates until the browser tab crashes.

---

## 3. Empty Auth Token for Private Models

```typescript
// WRONG: Empty string for private model -- loads zero objects, no error
const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
await viewer.loadObject(loader, true); // Completes successfully but shows nothing

// CORRECT: Provide valid token for private models
const token = process.env.SPECKLE_TOKEN!;
const loader = new SpeckleLoader(viewer.getWorldTree(), url, token);
await viewer.loadObject(loader, true);
```

**WHY**: The loader does not throw on authentication failure. It silently returns empty data. This is the most common cause of "blank viewer" bugs.

---

## 4. Zero-Size Container

```typescript
// WRONG: Container with no dimensions
<div id="speckle"></div>  // 0x0 pixels by default

// CORRECT: Container MUST have explicit dimensions
<div id="speckle" style="position: absolute; inset: 0;"></div>
// OR
<div id="speckle" style="width: 100%; height: 100vh;"></div>
```

**WHY**: The WebGL canvas derives its size from the container. A zero-size container creates a zero-size canvas, which fails silently. No error is thrown -- the viewer just renders nothing.

---

## 5. Not Handling Resize

```typescript
// WRONG: Container changes size but viewer is not notified
window.addEventListener("resize", () => {
  // Viewer canvas stays the old size, rendering is distorted
});

// CORRECT: ALWAYS call viewer.resize() when container size changes
window.addEventListener("resize", () => {
  viewer.resize();
});

// Also handle dynamic layout changes (panel toggles, sidebar collapse)
function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
  viewer.resize(); // MUST recalculate viewport
}
```

**WHY**: The viewer does NOT observe container size changes automatically. Without explicit `resize()` calls, the canvas stretches or compresses incorrectly.

---

## 6. Creating Extensions Before Init

```typescript
// WRONG: Extensions depend on viewer internals set up during init()
const viewer = new Viewer(container, DefaultViewerParams);
const camera = viewer.createExtension(CameraController); // Fails!
await viewer.init();

// CORRECT: Create extensions AFTER init
const viewer = new Viewer(container, DefaultViewerParams);
await viewer.init();
const camera = viewer.createExtension(CameraController);
```

**WHY**: Extensions rely on the WorldTree, SpeckleRenderer, and other components that only exist after `init()`. Creating them too early causes undefined references.

---

## 7. Manually Constructing Resource URLs

```typescript
// WRONG: Guessing the resource URL format
const url = `https://app.speckle.systems/objects/${projectId}/${objectId}`;
const loader = new SpeckleLoader(viewer.getWorldTree(), url, token);

// CORRECT: ALWAYS use UrlHelper to resolve URLs
const urls = await UrlHelper.getResourceUrls(
  `https://app.speckle.systems/projects/${projectId}/models/${modelId}`
);
for (const url of urls) {
  const loader = new SpeckleLoader(viewer.getWorldTree(), url, token);
  await viewer.loadObject(loader, true);
}
```

**WHY**: The internal resource URL format is not documented and may change between server versions. `UrlHelper.getResourceUrls()` handles URL resolution correctly for all server versions.

---

## 8. Instantiating Extensions with `new`

```typescript
// WRONG: Manual instantiation bypasses dependency injection
const camera = new CameraController();
const selection = new SelectionExtension();

// CORRECT: ALWAYS use createExtension() -- it handles DI
const camera = viewer.createExtension(CameraController);
const selection = viewer.createExtension(SelectionExtension);
```

**WHY**: `createExtension()` resolves the `inject` dependency graph and passes the viewer reference. Manual instantiation skips both, leaving the extension non-functional.

---

## 9. Filtering Before Load Completes

```typescript
// WRONG: Filtering immediately after loadObject call
await viewer.loadObject(loader, true);
filtering.isolateObjects(["id1", "id2"]); // May not find objects yet

// CORRECT: Wait for LoadComplete event
viewer.on(ViewerEvent.LoadComplete, () => {
  filtering.isolateObjects(["id1", "id2"]);
});
await viewer.loadObject(loader, true);
```

**WHY**: `loadObject()` resolves when data transfer completes, but the WorldTree may still be processing nodes. The `LoadComplete` event fires when objects are fully indexed and available for filtering and selection.

---

## 10. Not Unloading Before Reloading

```typescript
// WRONG: Loading a new model without unloading the old one
async function switchModel(newUrl: string) {
  const urls = await UrlHelper.getResourceUrls(newUrl);
  for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
    await viewer.loadObject(loader, true);
  }
  // Old model is still visible alongside the new one!
}

// CORRECT: Unload first, then load
async function switchModel(newUrl: string) {
  await viewer.unloadAll();
  const urls = await UrlHelper.getResourceUrls(newUrl);
  for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
    await viewer.loadObject(loader, true);
  }
}
```

**WHY**: The viewer supports loading multiple models simultaneously. Without `unloadAll()`, the old model stays in the scene. This is intentional for federation but causes confusion when switching between models.

---

## 11. Blocking the Main Thread with Synchronous Queries

```typescript
// WRONG: Running expensive queries in a tight loop
for (let i = 0; i < 10000; i++) {
  const props = await viewer.getObjectProperties(); // Heavy operation
  // Process each...
}

// CORRECT: Query once, process results
const props = await viewer.getObjectProperties();
for (const prop of props) {
  // Process each property
}
```

**WHY**: `getObjectProperties()` traverses the entire WorldTree. Calling it repeatedly causes frame drops and unresponsive UI. ALWAYS cache query results.

---

## 12. Ignoring the DiffExtension Cleanup

```typescript
// WRONG: Starting a new diff without clearing the old one
await diff.diff(urlA, urlB, VisualDiffMode.COLORED);
// Later, starting another diff without undiff:
await diff.diff(urlC, urlD, VisualDiffMode.COLORED); // Undefined behavior

// CORRECT: ALWAYS undiff before starting a new comparison
await diff.diff(urlA, urlB, VisualDiffMode.COLORED);
// Later:
await diff.undiff();
await diff.diff(urlC, urlD, VisualDiffMode.COLORED);
```

**WHY**: The DiffExtension modifies scene state (materials, visibility) for the comparison. Starting a new diff without cleaning up the previous one leaves stale visual artifacts.
