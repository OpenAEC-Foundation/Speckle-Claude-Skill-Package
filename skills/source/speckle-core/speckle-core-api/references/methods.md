# speckle-core-api — Methods Reference

> Complete GraphQL schema reference: queries, mutations, and subscriptions for Speckle Server 2.x/3.x.
> ALWAYS use current (non-deprecated) operations in new code.

---

## Queries

### activeUser — Authenticated User Profile

```graphql
query ActiveUser {
  activeUser {
    id
    email
    name
    bio
    company
    avatar
    verified
    role
  }
}
```

**Required scope**: `profile:read`
**Returns**: `null` if not authenticated.

### activeUser.projects — User Projects (Paginated)

```graphql
query UserProjects($limit: Int!, $cursor: String, $filter: UserProjectsFilter) {
  activeUser {
    projects(limit: $limit, cursor: $cursor, filter: $filter) {
      totalCount
      cursor
      items {
        id
        name
        description
        visibility
        allowPublicComments
        role
        createdAt
        updatedAt
        sourceApps
        workspaceId
      }
    }
  }
}
```

**Filter fields**: `search`, `onlyWithRoles`, `workspaceId`, `personalOnly`, `includeImplicitAccess`.

### activeUser.workspaces — User Workspaces (Paginated)

```graphql
query ActiveUserWorkspaces($limit: Int!, $cursor: String, $filter: UserWorkspacesFilter) {
  activeUser {
    workspaces(limit: $limit, cursor: $cursor, filter: $filter) {
      cursor
      totalCount
      items {
        id
        name
        role
        slug
        logo
        createdAt
        updatedAt
        readOnly
        description
      }
    }
  }
}
```

### project(id) — Get a Specific Project

```graphql
query Project($projectId: String!) {
  project(id: $projectId) {
    id
    name
    description
    visibility
    allowPublicComments
    role
    createdAt
    updatedAt
    sourceApps
    workspaceId
  }
}
```

### project.models — Models in a Project (Paginated)

```graphql
query ProjectWithModels(
  $projectId: String!
  $modelsLimit: Int!
  $modelsCursor: String
  $modelsFilter: ProjectModelsFilter
) {
  project(id: $projectId) {
    models(limit: $modelsLimit, cursor: $modelsCursor, filter: $modelsFilter) {
      items {
        id
        name
        displayName
        description
        previewUrl
        createdAt
        updatedAt
        author { id name avatar }
      }
      cursor
      totalCount
    }
  }
}
```

**Filter fields**: `search`, `sourceApps`, `contributors`, `onlyWithVersions`, `ids`, `excludeIds`.

### model.versions — Versions of a Model (Paginated)

```graphql
query ModelWithVersions(
  $modelId: String!
  $projectId: String!
  $versionsLimit: Int!
  $versionsCursor: String
  $versionsFilter: ModelVersionsFilter
) {
  project(id: $projectId) {
    model(id: $modelId) {
      id
      name
      versions(limit: $versionsLimit, cursor: $versionsCursor, filter: $versionsFilter) {
        items {
          id
          referencedObject
          message
          sourceApplication
          createdAt
          previewUrl
          authorUser { id name avatar }
        }
        totalCount
        cursor
      }
    }
  }
}
```

The `referencedObject` field is the object ID for REST API download.

### project.version — Get a Specific Version

```graphql
query VersionGet($projectId: String!, $versionId: String!) {
  project(id: $projectId) {
    version(id: $versionId) {
      id
      referencedObject
      message
      sourceApplication
      createdAt
      previewUrl
      authorUser { id name avatar }
    }
  }
}
```

### project.object — Query Object Data

```graphql
query ProjectObject($projectId: String!, $objectId: String!) {
  project(id: $projectId) {
    object(id: $objectId) {
      id
      speckleType
      createdAt
      totalChildrenCount
      data
      children(limit: 100, depth: 50, select: ["speckleType", "name"]) {
        totalCount
        cursor
        objects { id speckleType data }
      }
    }
  }
}
```

**WARNING**: Using `query` or `orderBy` parameters on `children` triggers expensive SQL queries. ALWAYS use plain `children(limit: N)` for standard traversal.

### project.permissions — Check Permissions

```graphql
query ProjectPermissions($projectId: String!) {
  project(id: $projectId) {
    permissions {
      canCreateModel { authorized code message }
      canDelete { authorized code message }
      canLoad { authorized code message }
      canPublish { authorized code message }
    }
  }
}
```

### serverInfo — Server Metadata (No Auth Required)

```graphql
query ServerInfo {
  serverInfo {
    name
    company
    description
    adminContact
    canonicalUrl
    version
    automateUrl
    configuration {
      objectSizeLimitBytes
      objectMultipartUploadSizeLimitBytes
    }
    scopes { name description }
    authStrategies { id name icon }
    workspaces { workspacesEnabled }
  }
}
```

---

## Mutations

### Project Mutations

**Create Project**:
```graphql
mutation ProjectCreate($input: ProjectCreateInput) {
  projectMutations {
    create(input: $input) { id name description visibility }
  }
}
# Variables: { "input": { "name": "...", "description": "...", "visibility": "PRIVATE" } }
# Visibility enum: PRIVATE, UNLISTED, PUBLIC, WORKSPACE
```

**Create Workspace Project**:
```graphql
mutation WorkspaceProjectCreate($input: WorkspaceProjectCreateInput!) {
  workspaceMutations {
    projects {
      create(input: $input) { id name workspaceId }
    }
  }
}
```

**Update Project**:
```graphql
mutation ProjectUpdate($input: ProjectUpdateInput!) {
  projectMutations {
    update(update: $input) { id name description visibility allowPublicComments }
  }
}
# Variables: { "input": { "id": "<projectId>", "name": "...", "visibility": "PUBLIC" } }
```

**Delete Project**:
```graphql
mutation ProjectDelete($projectId: String!) {
  projectMutations {
    delete(id: $projectId)
  }
}
# Returns: Boolean!
```

**Batch Delete Projects**:
```graphql
mutation ProjectBatchDelete($ids: [String!]!) {
  projectMutations {
    batchDelete(ids: $ids)
  }
}
```

**Update Project Role**:
```graphql
mutation ProjectUpdateRole($input: ProjectUpdateRoleInput!) {
  projectMutations {
    updateRole(input: $input) {
      id
      team { id role user { id name } }
    }
  }
}
# Variables: { "input": { "projectId": "...", "userId": "...", "role": "stream:contributor" } }
```

**Leave Project**:
```graphql
mutation ProjectLeave($id: String!) {
  projectMutations {
    leave(id: $id)
  }
}
```

### Model Mutations

**Create Model**:
```graphql
mutation ModelCreate($input: CreateModelInput!) {
  modelMutations {
    create(input: $input) { id name displayName description }
  }
}
# Variables: { "input": { "name": "Architecture", "description": "...", "projectId": "<projectId>" } }
```

**Update Model**:
```graphql
mutation ModelUpdate($input: UpdateModelInput!) {
  modelMutations {
    update(input: $input) { id name displayName description }
  }
}
```

**Delete Model**:
```graphql
mutation ModelDelete($input: DeleteModelInput!) {
  modelMutations {
    delete(input: $input)
  }
}
# Returns: Boolean!
# Variables: { "input": { "id": "<modelId>", "projectId": "<projectId>" } }
```

### Version Mutations

**Create Version**:
```graphql
mutation VersionCreate($input: CreateVersionInput!) {
  versionMutations {
    create(input: $input) { id referencedObject message sourceApplication createdAt }
  }
}
```

`CreateVersionInput` requires: `objectId` (uploaded object hash), `modelId`, `projectId`. Optional: `message`, `sourceApplication`, `parents`.

**Update Version**:
```graphql
mutation VersionUpdate($input: UpdateVersionInput!) {
  versionMutations {
    update(input: $input) { id message }
  }
}
```

**Move Versions to Different Model**:
```graphql
mutation VersionMoveToModel($input: MoveVersionsInput!) {
  versionMutations {
    moveToModel(input: $input) { id }
  }
}
```

**Delete Versions**:
```graphql
mutation VersionDelete($input: DeleteVersionsInput!) {
  versionMutations {
    delete(input: $input)
  }
}
# Returns: Boolean!
```

**Mark Version as Received**:
```graphql
mutation MarkReceived($input: MarkReceivedVersionInput!) {
  versionMutations {
    markReceived(input: $input)
  }
}
```

### Webhook Mutations

**Create Webhook** (requires `streams:write`, Stream Owner role):
```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
# Returns: String! (webhook ID)
# Variables: { "webhook": { "streamId": "<projectId>", "url": "https://...", "triggers": ["commit_create", "branch_update"], "enabled": true } }
```

**CRITICAL**: The `triggers` array MUST use internal legacy names (e.g., `commit_create`), NOT display names (e.g., `version_create`).

**Update Webhook**:
```graphql
mutation WebhookUpdate($webhook: WebhookUpdateInput!) {
  webhookUpdate(webhook: $webhook)
}
```

**Delete Webhook**:
```graphql
mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
# Variables: { "webhook": { "id": "<webhookId>", "streamId": "<projectId>" } }
```

### API Token Mutations

**Create Token** (requires `tokens:write`):
```graphql
mutation TokenCreate($token: ApiTokenCreateInput!) {
  apiTokenCreate(token: $token)
}
# Returns: String! (the token value — shown ONLY once)
# Variables: { "token": { "name": "...", "scopes": ["streams:read", "profile:read"], "lifespan": 3600000000000 } }
```

Optional `limitResources`: `[{ "id": "<projectId>", "type": "project" }]` restricts the token to specific projects/workspaces.

**Revoke Token** (requires `tokens:write`):
```graphql
mutation TokenRevoke($token: String!) {
  apiTokenRevoke(token: $token)
}
```

### User Mutations

**Update Active User**:
```graphql
mutation ActiveUserUpdate($input: UserUpdateInput!) {
  activeUserMutations {
    update(user: $input) { id name bio company }
  }
}
```

---

## Subscriptions

All subscriptions use WebSocket transport and require Bearer token authentication.

### userProjectsUpdated

Fires when the user's project list changes (project added/removed).

```graphql
subscription UserProjectsUpdated {
  userProjectsUpdated {
    id
    type    # ADDED | REMOVED
    project { id name description visibility role }
  }
}
```

### projectUpdated

Fires when a specific project is updated or deleted.

```graphql
subscription ProjectUpdated($id: String!) {
  projectUpdated(id: $id) {
    id
    type    # UPDATED | DELETED
    project { id name description visibility }
  }
}
```

### projectModelsUpdated

Fires when models in a project change. Optionally filter by model IDs.

```graphql
subscription ProjectModelsUpdated($id: String!, $modelIds: [String!]) {
  projectModelsUpdated(id: $id, modelIds: $modelIds) {
    id
    type    # CREATED | UPDATED | DELETED
    model { id name displayName description updatedAt }
  }
}
```

### projectVersionsUpdated

Fires when versions in a project change.

```graphql
subscription ProjectVersionsUpdated($id: String!) {
  projectVersionsUpdated(id: $id) {
    id
    modelId
    type    # CREATED | UPDATED | DELETED
    version { id referencedObject message sourceApplication createdAt }
  }
}
```

### projectVersionsPreviewGenerated

Fires when a version preview image is generated.

```graphql
subscription ProjectVersionsPreviewGenerated($id: String!) {
  projectVersionsPreviewGenerated(id: $id) {
    projectId
    modelId
    versionId
    objectId
  }
}
```

---

## Legacy → Current Mapping (Complete)

### Queries

| Legacy (DEPRECATED) | Current | Notes |
|---------------------|---------|-------|
| `stream(id)` | `project(id)` | |
| `streams(...)` | `activeUser { projects(...) }` | |
| `stream.branches(...)` | `project.models(...)` | |
| `stream.branch(name)` | `project.modelByName(name)` | |
| `stream.commits(...)` | `model.versions(...)` | |
| `stream.commit(id)` | `project.version(id)` | |
| `stream.object(id)` | `project.object(id)` | |

### Mutations

| Legacy (DEPRECATED) | Current |
|---------------------|---------|
| `streamCreate` | `projectMutations.create` |
| `streamUpdate` | `projectMutations.update` |
| `streamDelete` | `projectMutations.delete` |
| `streamsDelete` | `projectMutations.batchDelete` |
| `streamUpdatePermission` | `projectMutations.updateRole` |
| `streamRevokePermission` | `projectMutations.updateRole` (null role) |
| `streamLeave` | `projectMutations.leave` |
| `branchCreate` | `modelMutations.create` |
| `branchUpdate` | `modelMutations.update` |
| `branchDelete` | `modelMutations.delete` |
| `commitCreate` | `versionMutations.create` |
| `commitUpdate` | `versionMutations.update` |
| `commitDelete` | `versionMutations.delete` |
| `commitsMove` | `versionMutations.moveToModel` |
| `commitReceive` | `versionMutations.markReceived` |

### Subscriptions

| Legacy (DEPRECATED) | Current |
|---------------------|---------|
| `userStreamAdded` / `userStreamRemoved` | `userProjectsUpdated` |
| `streamUpdated` / `streamDeleted` | `projectUpdated` |
| `branchCreated` / `branchUpdated` / `branchDeleted` | `projectModelsUpdated` |
| `commitCreated` / `commitUpdated` / `commitDeleted` | `projectVersionsUpdated` |

---

## Collection Types

| Collection | Items Field | Parent Context |
|------------|-------------|----------------|
| `UserProjectCollection` | `items: [Project!]!` | `activeUser.projects` |
| `ModelCollection` | `items: [Model!]!` | `project.models` |
| `VersionCollection` | `items: [Version!]!` | `model.versions` |
| `ObjectCollection` | `objects: [Object!]!` | `object.children` |
| `WebhookCollection` | `items: [Webhook!]!` | `project.webhooks` |
| `WebhookEventCollection` | `items: [WebhookEvent]` | `webhook.history` |

**Note**: `ObjectCollection` uses `objects` instead of `items` -- this is an inconsistency in the schema.
