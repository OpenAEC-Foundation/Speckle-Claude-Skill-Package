# Working Code Examples (@speckle/viewer)

## Example 1: Complete Setup-to-Render Workflow

This is the minimum viable viewer setup. It loads a public Speckle model and renders it with camera and selection controls.

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Speckle Viewer</title>
    <style>
      body { margin: 0; overflow: hidden; }
      #speckle { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <div id="speckle"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```typescript
// main.ts
import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  CameraController,
  SelectionExtension,
} from "@speckle/viewer";

async function main() {
  // Step 1: Get container element -- MUST have explicit dimensions
  const container = document.getElementById("speckle") as HTMLElement;

  // Step 2: Create viewer with default parameters
  const viewer = new Viewer(container, DefaultViewerParams);

  // Step 3: Initialize -- MUST await before ANY other operation
  await viewer.init();

  // Step 4: Create extensions AFTER init
  const camera = viewer.createExtension(CameraController);
  const selection = viewer.createExtension(SelectionExtension);

  // Step 5: Resolve model URL to resource URLs
  const modelUrl =
    "https://app.speckle.systems/projects/7591c56179/models/32213f5381";
  const urls = await UrlHelper.getResourceUrls(modelUrl);

  // Step 6: Load each resource
  for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, "");
    await viewer.loadObject(loader, true); // autoFit=true frames camera
  }

  // Step 7: Listen for events
  viewer.on(ViewerEvent.ObjectClicked, (event) => {
    if (event) {
      console.log("Clicked object:", event.hits[0]?.node);
    }
  });
}

main();
```

---

## Example 2: Loading a Private Model with Authentication

```typescript
import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  CameraController,
  SelectionExtension,
} from "@speckle/viewer";

async function loadPrivateModel() {
  const container = document.getElementById("speckle") as HTMLElement;
  const viewer = new Viewer(container, DefaultViewerParams);
  await viewer.init();

  viewer.createExtension(CameraController);
  viewer.createExtension(SelectionExtension);

  // ALWAYS use a valid token for private models
  const authToken = "YOUR_PERSONAL_ACCESS_TOKEN";

  const urls = await UrlHelper.getResourceUrls(
    "https://app.speckle.systems/projects/PROJECT_ID/models/MODEL_ID"
  );

  for (const url of urls) {
    // Pass auth token as third parameter -- NEVER use "" for private models
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, authToken);
    await viewer.loadObject(loader, true);
  }
}

loadPrivateModel();
```

---

## Example 3: Filtering Objects by Visibility and Color

```typescript
import {
  Viewer,
  DefaultViewerParams,
  SpeckleLoader,
  UrlHelper,
  CameraController,
  FilteringExtension,
  ViewerEvent,
} from "@speckle/viewer";

async function filteringExample() {
  const container = document.getElementById("speckle") as HTMLElement;
  const viewer = new Viewer(container, DefaultViewerParams);
  await viewer.init();

  viewer.createExtension(CameraController);
  const filtering = viewer.createExtension(FilteringExtension);

  // Load model (omitted for brevity -- see Example 1)

  // Wait for load to complete before filtering
  viewer.on(ViewerEvent.LoadComplete, async () => {
    // Hide specific objects
    filtering.hideObjects(["objectId1", "objectId2"], "my-filter", true);

    // Isolate objects -- shows ONLY these, hides everything else
    filtering.isolateObjects(["objectId3", "objectId4"], "isolation", true, true);

    // Apply custom colors to object groups
    filtering.setUserObjectColors([
      { objectIds: ["objA", "objB"], color: "#ff0000" },
      { objectIds: ["objC", "objD"], color: "#00ff00" },
    ]);

    // Apply property-based color filter
    const properties = await viewer.getObjectProperties();
    const categoryProp = properties.find((p) => p.name === "Category");
    if (categoryProp) {
      filtering.setColorFilter(categoryProp);
    }

    // Reset all filters
    filtering.resetFilters();
  });
}

filteringExample();
```

---

## Example 4: Programmatic Selection

```typescript
import {
  Viewer,
  DefaultViewerParams,
  CameraController,
  SelectionExtension,
  ViewerEvent,
} from "@speckle/viewer";

async function selectionExample(viewer: Viewer) {
  const camera = viewer.createExtension(CameraController);
  const selection = viewer.createExtension(SelectionExtension);

  // Programmatic selection -- select specific objects
  selection.selectObjects(["objectId1", "objectId2"]);

  // Add to selection (multiSelect=true keeps existing selection)
  selection.selectObjects(["objectId3"], true);

  // Get currently selected objects
  const selectedObjects = selection.getSelectedObjects();
  console.log("Selected:", selectedObjects);

  // Get selected tree nodes (includes hierarchy info)
  const selectedNodes = selection.getSelectedNodes();
  console.log("Nodes:", selectedNodes);

  // Clear selection
  selection.unselectObjects();

  // Listen for user clicks
  viewer.on(ViewerEvent.ObjectClicked, (event) => {
    if (event) {
      const node = event.hits[0]?.node;
      console.log("User clicked:", node);
    } else {
      console.log("Clicked empty space");
      selection.unselectObjects();
    }
  });

  // Focus camera on selected objects
  viewer.on(ViewerEvent.ObjectDoubleClicked, (event) => {
    if (event) {
      const objectId = event.hits[0]?.node?.model?.id;
      if (objectId) {
        camera.setCameraView([objectId], true, 1.2);
      }
    }
  });
}
```

---

## Example 5: Camera Control

```typescript
import {
  Viewer,
  CameraController,
  CameraEvent,
  Box3,
  Vector3,
} from "@speckle/viewer";

function cameraExample(viewer: Viewer) {
  const camera = viewer.createExtension(CameraController);

  // Switch between perspective and orthographic
  camera.setPerspectiveCameraOn();
  camera.setOrthoCameraOn();
  camera.toggleCameras();

  // Frame camera on specific objects with smooth transition
  camera.setCameraView(["objectId1", "objectId2"], true, 1.5);

  // Frame camera on a bounding box
  const bounds = new Box3(
    new Vector3(-10, -10, -10),
    new Vector3(10, 10, 10)
  );
  camera.setCameraView(bounds, true);

  // Use a canonical view (top, front, right, etc.)
  camera.setCameraView("top", true);

  // Adjust field of view
  camera.fieldOfView = 55;

  // Disable/enable rotation (useful for 2D views)
  camera.disableRotations();
  camera.enableRotations();

  // Listen for camera events
  camera.on(CameraEvent.Stationary, () => {
    console.log("Camera stopped moving");
  });

  camera.on(CameraEvent.ProjectionChanged, (projection) => {
    console.log("Projection changed to:", projection);
  });
}
```

---

## Example 6: Version Diffing

```typescript
import {
  Viewer,
  DefaultViewerParams,
  CameraController,
  DiffExtension,
  VisualDiffMode,
  UrlHelper,
} from "@speckle/viewer";

async function diffExample() {
  const container = document.getElementById("speckle") as HTMLElement;
  const viewer = new Viewer(container, DefaultViewerParams);
  await viewer.init();

  viewer.createExtension(CameraController);
  const diff = viewer.createExtension(DiffExtension);

  // Get resource URLs for two versions of the same model
  const urlsV1 = await UrlHelper.getResourceUrls(
    "https://app.speckle.systems/projects/PROJECT_ID/models/MODEL_ID@VERSION_1"
  );
  const urlsV2 = await UrlHelper.getResourceUrls(
    "https://app.speckle.systems/projects/PROJECT_ID/models/MODEL_ID@VERSION_2"
  );

  // Run the diff -- COLORED mode highlights changes with distinct colors
  const result = await diff.diff(
    urlsV1[0],
    urlsV2[0],
    VisualDiffMode.COLORED
  );

  console.log("Added elements:", result.added.length);
  console.log("Removed elements:", result.removed.length);
  console.log("Modified elements:", result.modified.length);
  console.log("Unchanged elements:", result.unchanged.length);

  // Switch diff visualization mode
  diff.updateVisualDiff(undefined, VisualDiffMode.PLAIN);

  // Clear the diff view
  await diff.undiff();
}

diffExample();
```

---

## Example 7: Measurements

```typescript
import {
  Viewer,
  CameraController,
  MeasurementsTool,
  MeasurementType,
} from "@speckle/viewer";

function measurementExample(viewer: Viewer) {
  viewer.createExtension(CameraController);
  const measurements = viewer.createExtension(MeasurementsTool);

  // Enable measurement mode with point-to-point type
  measurements.enabled = true;
  measurements.options = {
    ...measurements.options,
    type: MeasurementType.POINTTOPOINT,
    vertexSnap: true,
    units: "m",
    precision: 2,
  };

  // Switch to area measurement
  measurements.options = {
    ...measurements.options,
    type: MeasurementType.AREA,
  };

  // Export measurement data (serializable)
  const data = measurements.toMeasurementData();
  console.log("Measurements:", JSON.stringify(data));

  // Restore measurements from saved data
  for (const measurement of data) {
    measurements.addMeasurement(measurement);
  }

  // Clear all measurements
  measurements.clearMeasurements();
}
```

---

## Example 8: Section Box

```typescript
import {
  Viewer,
  CameraController,
  SectionTool,
  SectionToolEvent,
  Box3,
  Vector3,
} from "@speckle/viewer";

function sectionExample(viewer: Viewer) {
  viewer.createExtension(CameraController);
  const section = viewer.createExtension(SectionTool);

  // Enable section tool
  section.toggle();

  // Set a custom section box
  const box = new Box3(
    new Vector3(-5, -5, 0),
    new Vector3(5, 5, 3)
  );
  section.setBox(box, 0.1);

  // Get current section box
  const currentBox = section.getBox();
  console.log("Section box:", currentBox);

  // Toggle visibility of section box gizmo
  section.visible = false;
  section.visible = true;

  // Listen for section box changes
  section.on(SectionToolEvent.Updated, (planes) => {
    console.log("Section planes updated:", planes);
  });

  section.on(SectionToolEvent.DragStart, () => {
    console.log("User started dragging section box");
  });
}
```

---

## Example 9: Custom Extension

```typescript
import {
  Extension,
  CameraController,
  ViewerEvent,
  IViewer,
} from "@speckle/viewer";

class ClickLogger extends Extension {
  private clickCount = 0;

  // Declare dependency on CameraController
  get inject() {
    return [CameraController];
  }

  // Called when extension is created
  onEarlyUpdate(deltaTime?: number): void {
    // Runs every frame before viewer update
  }

  onLateUpdate(deltaTime?: number): void {
    // Runs every frame after viewer update
  }

  onRender(): void {
    // Runs after each render pass
  }

  onResize(): void {
    // Runs when viewport resizes
  }

  // Custom methods
  getClickCount(): number {
    return this.clickCount;
  }

  startTracking(): void {
    this.viewer.on(ViewerEvent.ObjectClicked, (event) => {
      if (event) {
        this.clickCount++;
        console.log(`Click #${this.clickCount}:`, event.hits[0]?.node);
      }
    });
  }
}

// Usage
async function customExtensionExample(viewer: Viewer) {
  await viewer.init();
  viewer.createExtension(CameraController); // Dependency MUST exist

  const logger = viewer.createExtension(ClickLogger);
  logger.startTracking();

  // Later...
  console.log("Total clicks:", logger.getClickCount());
}
```

---

## Example 10: Responsive Viewer with Cleanup

```typescript
import {
  Viewer,
  DefaultViewerParams,
  CameraController,
  SelectionExtension,
  SpeckleLoader,
  UrlHelper,
} from "@speckle/viewer";

class ViewerManager {
  private viewer: Viewer | null = null;

  async mount(container: HTMLElement, modelUrl: string, token = ""): Promise<void> {
    // Create and initialize
    this.viewer = new Viewer(container, DefaultViewerParams);
    await this.viewer.init();

    // Extensions
    this.viewer.createExtension(CameraController);
    this.viewer.createExtension(SelectionExtension);

    // Load model
    const urls = await UrlHelper.getResourceUrls(modelUrl);
    for (const url of urls) {
      const loader = new SpeckleLoader(this.viewer.getWorldTree(), url, token);
      await this.viewer.loadObject(loader, true);
    }

    // Handle window resize -- ALWAYS call resize() on container size change
    window.addEventListener("resize", this.handleResize);
  }

  private handleResize = (): void => {
    this.viewer?.resize();
  };

  async unmount(): Promise<void> {
    window.removeEventListener("resize", this.handleResize);

    if (this.viewer) {
      // Unload all models first
      await this.viewer.unloadAll();
      // ALWAYS dispose to prevent GPU memory leaks
      this.viewer.dispose();
      this.viewer = null;
    }
  }

  async switchModel(modelUrl: string, token = ""): Promise<void> {
    if (!this.viewer) return;

    // Unload current model
    await this.viewer.unloadAll();

    // Load new model
    const urls = await UrlHelper.getResourceUrls(modelUrl);
    for (const url of urls) {
      const loader = new SpeckleLoader(this.viewer.getWorldTree(), url, token);
      await this.viewer.loadObject(loader, true);
    }
  }
}

// Usage in a React-like component
const manager = new ViewerManager();

// On mount
await manager.mount(
  document.getElementById("speckle")!,
  "https://app.speckle.systems/projects/PROJECT_ID/models/MODEL_ID"
);

// On unmount -- ALWAYS clean up
await manager.unmount();
```
