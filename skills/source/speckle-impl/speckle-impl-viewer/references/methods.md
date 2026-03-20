# API Signatures Reference (@speckle/viewer)

## Viewer Class

```typescript
class Viewer {
  constructor(container: HTMLElement, params: ViewerParams);

  // Lifecycle
  init(): Promise<void>;
  dispose(): void;

  // Loading
  loadObject(loader: SpeckleLoader, autoFit?: boolean): Promise<void>;
  unloadObject(url: string): Promise<void>;
  unloadAll(): Promise<void>;
  cancelLoad(url: string, unload?: boolean): Promise<void>;

  // Extensions
  createExtension<T extends Extension>(type: new () => T): T;
  getExtension<T extends Extension>(type: new () => T): T;
  hasExtension<T extends Extension>(type: Constructor<T>): boolean;

  // Events
  on<T extends ViewerEvent>(
    eventType: T,
    handler: (arg: ViewerEventPayload[T]) => void
  ): void;

  // Queries
  query<T extends Query>(query: T): QueryArgsResultMap[T['operation']];
  getObjectProperties(resourceURL?: string): Promise<PropertyInfo[]>;
  getViews(): SpeckleView[];

  // Rendering
  getRenderer(): SpeckleRenderer;
  getWorldTree(): WorldTree;
  screenshot(): Promise<string>;
  resize(): void;
  requestRender(flags?: number): void;
  setLightConfiguration(config: LightConfiguration): void;

  // Accessors
  get Utils(): Utils;
  get World(): World;

  // Container
  getContainer(): HTMLElement;
}
```

---

## ViewerParams

```typescript
interface ViewerParams {
  showStats: boolean;
  environmentSrc: Asset;
  verbose: boolean;
  restrictInputToCanvas: boolean;
}

const DefaultViewerParams: ViewerParams;
```

---

## ViewerEvent

```typescript
enum ViewerEvent {
  ObjectClicked = 'object-clicked',
  ObjectDoubleClicked = 'object-doubleclicked',
  LoadComplete = 'load-complete',
  UnloadComplete = 'unload-complete',
  UnloadAllComplete = 'unload-all-complete',
  FilteringStateSet = 'filtering-state-set',
  LightConfigUpdated = 'light-config-updated',
}
```

---

## SpeckleLoader

```typescript
class SpeckleLoader extends Loader {
  constructor(worldTree: WorldTree, url: string, authToken: string);
  load(): Promise<boolean>;
  cancel(): void;
  dispose(): void;
}
```

---

## Loader (Base Class)

```typescript
abstract class Loader {
  constructor(resource: string, resourceData?: string | ArrayBuffer);
  load(): Promise<boolean>;
  cancel(): void;
  dispose(): void;
}

enum LoaderEvent {
  LoadProgress = 'load-progress',
  LoadCancelled = 'load-cancelled',
  LoadWarning = 'load-warning',
}
```

---

## UrlHelper

```typescript
class UrlHelper {
  static getResourceUrls(speckleUrl: string): Promise<string[]>;
}
```

---

## Extension (Base Class)

```typescript
abstract class Extension {
  protected viewer: IViewer;

  get enabled(): boolean;
  set enabled(value: boolean);

  get inject(): Array<Constructor<Extension>>;

  onEarlyUpdate(deltaTime?: number): void;
  onLateUpdate(deltaTime?: number): void;
  onRender(): void;
  onResize(): void;
}
```

---

## CameraController

```typescript
class CameraController extends Extension {
  // Accessors
  get aspect(): number;
  get controls(): SpeckleControls;
  get enabled(): boolean;
  set enabled(value: boolean);
  get fieldOfView(): number;
  set fieldOfView(value: number);
  get options(): CameraControllerOptions;
  set options(value: CameraControllerOptions);
  get renderingCamera(): PerspectiveCamera | OrthographicCamera;
  set renderingCamera(value: PerspectiveCamera | OrthographicCamera);

  // Methods
  setCameraView(objectIds: string[], transition: boolean, fit?: number): void;
  setCameraView(
    view: CanonicalView | SpeckleView | InlineView | PolarView,
    transition: boolean,
    fit?: number
  ): void;
  setCameraView(bounds: Box3, transition: boolean, fit?: number): void;
  setPerspectiveCameraOn(): void;
  setOrthoCameraOn(): void;
  toggleCameras(): void;
  enableRotations(): void;
  disableRotations(): void;
  setCameraPlanes(targetVolume: Box3, offsetScale?: number): void;

  // Events
  on<T extends CameraEvent>(
    eventType: T,
    listener: (arg: CameraEventPayload[T]) => void
  ): void;
  removeListener(e: CameraEvent, handler: (data: unknown) => void): void;
}

enum CameraEvent {
  Stationary,
  Dynamic,
  FrameUpdate,
  ProjectionChanged,
}
```

---

## SelectionExtension

```typescript
class SelectionExtension extends Extension {
  // Accessors
  get enabled(): boolean;
  set enabled(value: boolean);
  get options(): SelectionExtensionOptions;
  set options(value: SelectionExtensionOptions);

  // Methods
  selectObjects(ids: string[], multiSelect?: boolean): void;
  unselectObjects(ids?: string[]): void;
  getSelectedObjects(): Array<Record<string, unknown>>;
  getSelectedNodes(): Array<TreeNode>;
}

interface SelectionExtensionOptions {
  selectionMaterialData: RenderMaterial & DisplayStyle & MaterialOptions;
  hoverMaterialData?: RenderMaterial & DisplayStyle & MaterialOptions;
}
```

---

## FilteringExtension

```typescript
class FilteringExtension extends Extension {
  // Accessors
  get filteringState(): FilteringState;

  // Methods
  hideObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?: boolean,
    ghost?: boolean
  ): FilteringState;

  showObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?: boolean
  ): FilteringState;

  isolateObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?: boolean,
    ghost?: boolean
  ): FilteringState;

  unIsolateObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?: boolean,
    ghost?: boolean
  ): FilteringState;

  setColorFilter(prop: PropertyInfo, ghost?: boolean): FilteringState;
  removeColorFilter(): FilteringState;

  setUserObjectColors(
    groups: { objectIds: string[]; color: string }[]
  ): FilteringState;
  removeUserObjectColors(): FilteringState;

  resetFilters(): FilteringState;
}

interface FilteringState {
  selectedObjects: string[];
  hiddenObjects: string[];
  isolatedObjects: string[];
  colorGroups: Record<string, string[]>;
  userColorGroups: { objectIds: string[]; color: string }[];
  activePropFilterKey: string | null;
  passMin: number | null;
  passMax: number | null;
}

interface PropertyInfo {
  key: string;
  objectCount: number;
  type: string;
  path: string[];
  concatenatedPath: string;
  name: string;
}
```

---

## DiffExtension

```typescript
class DiffExtension extends Extension {
  diff(
    urlA: string,
    urlB: string,
    mode: VisualDiffMode,
    authToken?: string
  ): Promise<DiffResult>;

  undiff(): Promise<void>;

  updateVisualDiff(time?: number, mode?: VisualDiffMode): void;
}

enum VisualDiffMode {
  PLAIN,
  COLORED,
}

interface DiffResult {
  unchanged: Array<TreeNode>;
  added: Array<TreeNode>;
  removed: Array<TreeNode>;
  modified: Array<Array<TreeNode>>;
}
```

---

## MeasurementsTool

```typescript
class MeasurementsTool extends Extension {
  // Accessors
  get activeMeasurement(): Measurement | null;
  get enabled(): boolean;
  set enabled(value: boolean);
  get options(): MeasurementOptions;
  set options(value: MeasurementOptions);
  get selectedMeasurement(): Measurement | null;

  // Methods
  clearMeasurements(): void;
  addMeasurement(data: MeasurementData): void;
  removeMeasurement(): void;
  toMeasurementData(): MeasurementData[];
}

enum MeasurementType {
  PERPENDICULAR,
  POINTTOPOINT,
  AREA,
  POINT,
}

interface MeasurementOptions {
  visible: boolean;
  type: MeasurementType;
  vertexSnap: boolean;
  units: string;
  precision: number;
  chain: boolean;
}

interface MeasurementData {
  type: MeasurementType;
  startPoint: Vector3;
  endPoint: Vector3;
  startNormal: Vector3;
  endNormal: Vector3;
  value: number;
  innerPoints: Vector3[];
  units: string;
  precision: number;
  uuid: string;
}
```

---

## SectionTool

```typescript
class SectionTool extends Extension {
  // Accessors
  get enabled(): boolean;
  set enabled(value: boolean);
  get visible(): boolean;
  set visible(value: boolean);

  // Methods
  toggle(): void;
  setBox(targetBox: Box3, offset?: number): void;
  getBox(): Box3;

  // Events
  on(e: SectionToolEvent, handler: (data: unknown) => void): void;
  removeListener(e: SectionToolEvent, handler: (data: unknown) => void): void;
}

enum SectionToolEvent {
  DragStart = 'section-box-drag-start',
  DragEnd = 'section-box-drag-end',
  Updated = 'section-box-changed',
}
```
