# methods.md — speckle-impl-versioning

## VersionResource (SpecklePy)

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `create` | `create(input: CreateVersionInput) -> Version` | `Version` | Create a new version linking an object to a model |
| `get` | `get(project_id: str, version_id: str) -> Version` | `Version` | Retrieve a specific version by ID |
| `list` | `list(project_id: str, model_id: str, limit: int, cursor: str = None) -> ResourceCollection` | `ResourceCollection` | List versions for a model with pagination |
| `update` | `update(input: UpdateVersionInput) -> Version` | `Version` | Update a version's message |
| `delete` | `delete(input: DeleteVersionsInput) -> bool` | `bool` | Delete one or more versions |

### CreateVersionInput Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | `str` | YES | Target project ID |
| `model_id` | `str` | YES | Target model ID |
| `object_id` | `str` | YES | Hash of the uploaded root object |
| `message` | `str` | NO | Human-readable version description |
| `source_application` | `str` | NO | Name of the originating application |
| `parents` | `List[str]` | NO | IDs of parent versions (lineage tracking) |

### UpdateVersionInput Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version_id` | `str` | YES | Version to update |
| `project_id` | `str` | YES | Owning project ID |
| `message` | `str` | YES | New message text |

### DeleteVersionsInput Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version_ids` | `List[str]` | YES | Version IDs to delete |
| `project_id` | `str` | YES | Owning project ID |

### Version Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Stable unique identifier |
| `referenced_object` | `str` | Content hash of the root object |
| `message` | `str` | Version description |
| `source_application` | `str` | Originating application name |
| `created_at` | `datetime` | Creation timestamp |
| `author_user` | `User` | Author information |
| `preview_url` | `str` | URL to version preview image |

---

## ModelResource (SpecklePy)

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `create` | `create(input: CreateModelInput) -> Model` | `Model` | Create a new model in a project |
| `get` | `get(project_id: str, model_id: str) -> Model` | `Model` | Retrieve a specific model |
| `get_models` | `get_models(project_id: str, limit: int, cursor: str = None) -> ResourceCollection` | `ResourceCollection` | List models with pagination |
| `update` | `update(input: UpdateModelInput) -> Model` | `Model` | Update model name or description |
| `delete` | `delete(input: DeleteModelInput) -> bool` | `bool` | Delete a model and its versions |

### CreateModelInput Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | `str` | YES | Target project ID |
| `name` | `str` | YES | Model name (supports `/` for hierarchy) |
| `description` | `str` | NO | Model description |

### UpdateModelInput Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | `str` | YES | Owning project ID |
| `model_id` | `str` | YES | Model to update |
| `name` | `str` | NO | New model name |
| `description` | `str` | NO | New model description |

### DeleteModelInput Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | `str` | YES | Owning project ID |
| `id` | `str` | YES | Model ID to delete |

---

## GraphQL Mutations

### versionMutations.create

```graphql
mutation VersionCreate($input: CreateVersionInput!) {
  versionMutations {
    create(input: $input) {
      id
      referencedObject
      message
      sourceApplication
      createdAt
    }
  }
}
```

Input: `{ objectId, modelId, projectId, message?, sourceApplication?, parents? }`

### versionMutations.update

```graphql
mutation VersionUpdate($input: UpdateVersionInput!) {
  versionMutations {
    update(input: $input) { id message }
  }
}
```

Input: `{ versionId, projectId, message }`

### versionMutations.delete

```graphql
mutation VersionDelete($input: DeleteVersionsInput!) {
  versionMutations {
    delete(input: $input)
  }
}
```

Input: `{ versionIds: [String!]!, projectId }` — Returns `Boolean!`

### versionMutations.moveToModel

```graphql
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) { id }
  }
}
```

Input: `{ versionIds, targetModelId, projectId }`

### versionMutations.markReceived

```graphql
mutation MarkReceived($input: MarkReceivedVersionInput!) {
  versionMutations {
    markReceived(input: $input)
  }
}
```

Input: `{ versionId, projectId, sourceApplication, message }`

### modelMutations.create

```graphql
mutation ModelCreate($input: CreateModelInput!) {
  modelMutations {
    create(input: $input) { id name displayName description }
  }
}
```

Input: `{ name, description?, projectId }`

### modelMutations.update

```graphql
mutation ModelUpdate($input: UpdateModelInput!) {
  modelMutations {
    update(input: $input) { id name displayName description }
  }
}
```

Input: `{ id, name?, description?, projectId }`

### modelMutations.delete

```graphql
mutation ModelDelete($input: DeleteModelInput!) {
  modelMutations {
    delete(input: $input)
  }
}
```

Input: `{ id, projectId }` — Returns `Boolean!`

---

## Viewer DiffExtension

| Method / Property | Description |
|-------------------|-------------|
| `DiffExtension` | Extension class for visual version comparison |
| Color coding | GREEN = added, RED = removed, YELLOW = modified, GREY = unchanged |

**ALWAYS** create DiffExtension after `viewer.init()`. **ALWAYS** load both versions before activating diff mode.

---

## Operations Module (Send/Receive)

| Function | Signature | Description |
|----------|-----------|-------------|
| `operations.send` | `send(base: Base, transports: List[Transport]) -> str` | Upload object, returns content hash |
| `operations.receive` | `receive(obj_id: str, remote_transport: Transport) -> Base` | Download object by hash |
| `ServerTransport` | `ServerTransport(stream_id: str, client: SpeckleClient)` | Transport targeting a Speckle project |

The `stream_id` parameter in ServerTransport corresponds to the project ID. This is legacy naming that persists in the SDK.
