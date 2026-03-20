# speckle-syntax-graphql -- Methods Reference

> Complete catalog of GraphQL queries, mutations, and subscriptions for the Speckle Server API.

---

## Queries

| Query | Arguments | Return Type | Auth Required | Description |
|-------|-----------|-------------|---------------|-------------|
| `activeUser` | -- | `User` | Yes (`profile:read`) | Get authenticated user profile |
| `activeUser.projects` | `limit: Int!`, `cursor: String`, `filter: UserProjectsFilter` | `UserProjectCollection` | Yes | Paginated list of user's projects |
| `activeUser.workspaces` | `limit: Int!`, `cursor: String`, `filter: UserWorkspacesFilter` | `WorkspaceCollection` | Yes | Paginated list of user's workspaces |
| `project(id)` | `id: String!` | `Project` | Yes (`streams:read`) | Get project by ID |
| `project.models` | `limit: Int!`, `cursor: String`, `filter: ProjectModelsFilter` | `ModelCollection` | Yes | Paginated models within a project |
| `project.model(id)` | `id: String!` | `Model` | Yes | Get a specific model by ID |
| `project.versions` | `limit: Int!`, `cursor: String` | `VersionCollection` | Yes | Paginated versions across all models |
| `project.version(id)` | `id: String!` | `Version` | Yes | Get a specific version by ID |
| `project.object(id)` | `id: String!` | `Object` | Yes | Get a specific object by ID |
| `project.webhooks` | -- | `WebhookCollection` | Yes (Owner) | List webhooks on a project |
| `project.permissions` | -- | `ProjectPermissions` | Yes | Check user permissions on project |
| `model.versions` | `limit: Int!`, `cursor: String`, `filter: ModelVersionsFilter` | `VersionCollection` | Yes | Paginated versions within a model |
| `object.children` | `limit: Int!`, `depth: Int`, `select: [String]`, `query: [JSONObject]`, `orderBy: JSONObject` | `ObjectCollection` | Yes | Child objects (uses `objects` field) |
| `serverInfo` | -- | `ServerInfo` | No | Server metadata and capabilities |

### Filter Types

**UserProjectsFilter:**

| Field | Type | Description |
|-------|------|-------------|
| `search` | `String` | Search by project name |
| `onlyWithRoles` | `[String!]` | Filter by user's role on the project |
| `workspaceId` | `String` | Filter by workspace |
| `personalOnly` | `Boolean` | Only personal (non-workspace) projects |
| `includeImplicitAccess` | `Boolean` | Include projects accessible via workspace membership |

**ProjectModelsFilter:**

| Field | Type | Description |
|-------|------|-------------|
| `search` | `String` | Search by model name |
| `sourceApps` | `[String!]` | Filter by source application |
| `contributors` | `[String!]` | Filter by contributor user IDs |
| `onlyWithVersions` | `Boolean` | Only models that have at least one version |
| `ids` | `[String!]` | Include only these model IDs |
| `excludeIds` | `[String!]` | Exclude these model IDs |

---

## Mutations

### Project Mutations

| Mutation | Input Type | Return Type | Required Scope | Description |
|----------|-----------|-------------|----------------|-------------|
| `projectMutations.create` | `ProjectCreateInput` | `Project` | `streams:write` | Create a new project |
| `projectMutations.update` | `ProjectUpdateInput!` | `Project` | `streams:write` | Update project metadata |
| `projectMutations.delete` | `id: String!` | `Boolean!` | `streams:write` | Delete a project |
| `projectMutations.batchDelete` | `ids: [String!]!` | `Boolean!` | `streams:write` | Delete multiple projects |
| `projectMutations.updateRole` | `ProjectUpdateRoleInput!` | `Project` | `streams:write` | Change a user's role on a project |
| `projectMutations.leave` | `id: String!` | `Boolean!` | -- | Leave a project |
| `workspaceMutations.projects.create` | `WorkspaceProjectCreateInput!` | `Project` | `streams:write` | Create project in a workspace |

**ProjectCreateInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `String!` | Yes | Project name |
| `description` | `String` | No | Project description |
| `visibility` | `ProjectVisibility` | No | `PRIVATE`, `UNLISTED`, `PUBLIC`, or `WORKSPACE` |

**ProjectUpdateInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String!` | Yes | Project ID to update |
| `name` | `String` | No | New name |
| `description` | `String` | No | New description |
| `visibility` | `ProjectVisibility` | No | New visibility |
| `allowPublicComments` | `Boolean` | No | Allow public comments |

### Model Mutations

| Mutation | Input Type | Return Type | Required Scope | Description |
|----------|-----------|-------------|----------------|-------------|
| `modelMutations.create` | `CreateModelInput!` | `Model` | `streams:write` | Create a new model |
| `modelMutations.update` | `UpdateModelInput!` | `Model` | `streams:write` | Update model metadata |
| `modelMutations.delete` | `DeleteModelInput!` | `Boolean!` | `streams:write` | Delete a model |

**CreateModelInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `String!` | Yes | Model name |
| `description` | `String` | No | Model description |
| `projectId` | `String!` | Yes | Parent project ID |

**DeleteModelInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String!` | Yes | Model ID |
| `projectId` | `String!` | Yes | Parent project ID |

### Version Mutations

| Mutation | Input Type | Return Type | Required Scope | Description |
|----------|-----------|-------------|----------------|-------------|
| `versionMutations.create` | `CreateVersionInput!` | `Version` | `streams:write` | Create a new version |
| `versionMutations.update` | `UpdateVersionInput!` | `Version` | `streams:write` | Update version message |
| `versionMutations.delete` | `DeleteVersionsInput!` | `Boolean!` | `streams:write` | Delete versions |
| `versionMutations.moveToModel` | `MoveVersionsInput!` | `Model` | `streams:write` | Move versions between models |
| `versionMutations.markReceived` | `MarkReceivedVersionInput!` | `Boolean!` | `streams:write` | Mark version as received |

**CreateVersionInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `objectId` | `String!` | Yes | Uploaded object hash |
| `modelId` | `String!` | Yes | Target model ID |
| `projectId` | `String!` | Yes | Parent project ID |
| `message` | `String` | No | Version message |
| `sourceApplication` | `String` | No | Source application name |
| `parents` | `[String!]` | No | Parent version IDs |

### Webhook Mutations

| Mutation | Input Type | Return Type | Required Scope | Description |
|----------|-----------|-------------|----------------|-------------|
| `webhookCreate` | `WebhookCreateInput!` | `String!` | `streams:write` (Owner) | Create webhook, returns ID |
| `webhookUpdate` | `WebhookUpdateInput!` | `String!` | `streams:write` (Owner) | Update webhook |
| `webhookDelete` | `WebhookDeleteInput!` | `String!` | `streams:write` (Owner) | Delete webhook |

**WebhookCreateInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `streamId` | `String!` | Yes | Project ID (legacy field name) |
| `url` | `String!` | Yes | Webhook endpoint URL |
| `description` | `String` | No | Webhook description |
| `triggers` | `[String!]!` | Yes | Event triggers (e.g., `version_create`, `model_update`) |
| `secret` | `String` | No | HMAC secret for payload verification |
| `enabled` | `Boolean` | No | Whether webhook is active |

### Token Mutations

| Mutation | Input Type | Return Type | Required Scope | Description |
|----------|-----------|-------------|----------------|-------------|
| `apiTokenCreate` | `ApiTokenCreateInput!` | `String!` | `tokens:write` | Create PAT, returns token string |
| `apiTokenRevoke` | `token: String!` | `Boolean!` | `tokens:write` | Revoke a PAT |

**ApiTokenCreateInput:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `String!` | Yes | Token name |
| `scopes` | `[String!]!` | Yes | Permission scopes |
| `lifespan` | `BigInt` | No | Token lifetime in nanoseconds |
| `limitResources` | `[TokenResourceIdentifierInput]` | No | Restrict to specific projects/workspaces |

---

## Subscriptions

| Subscription | Arguments | Payload Fields | Event Types | Description |
|--------------|-----------|----------------|-------------|-------------|
| `userProjectsUpdated` | -- | `id`, `type`, `project` | `ADDED`, `REMOVED` | User's project list changes |
| `projectUpdated` | `id: String!` | `id`, `type`, `project` | `UPDATED`, `DELETED` | Project metadata changes |
| `projectModelsUpdated` | `id: String!`, `modelIds: [String!]` | `id`, `type`, `model` | `CREATED`, `UPDATED`, `DELETED` | Models in a project change |
| `projectVersionsUpdated` | `id: String!` | `id`, `modelId`, `type`, `version` | `CREATED`, `UPDATED`, `DELETED` | Versions in a project change |
| `projectVersionsPreviewGenerated` | `id: String!` | `projectId`, `modelId`, `versionId`, `objectId` | -- | Version preview image generated |

---

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| `ProjectVisibility` | `PRIVATE`, `UNLISTED`, `PUBLIC`, `WORKSPACE` | Project visibility setting |
| `ServerRole` | `SERVER_USER`, `SERVER_ADMIN`, `SERVER_GUEST`, `SERVER_ARCHIVED_USER` | Server-level roles |
| `StreamRole` | `stream:owner`, `stream:contributor`, `stream:reviewer` | Project-level roles |

---

## Pagination Collections

| Collection Type | Items Field | Parameters | Notes |
|----------------|-------------|------------|-------|
| `UserProjectCollection` | `items: [Project!]!` | `limit`, `cursor` | Standard pagination |
| `ModelCollection` | `items: [Model!]!` | `limit`, `cursor` | Standard pagination |
| `VersionCollection` | `items: [Version!]!` | `limit`, `cursor` | Standard pagination |
| `ObjectCollection` | `objects: [Object!]!` | `limit`, `depth`, `select`, `query`, `orderBy` | Uses `objects` not `items` |
| `WebhookCollection` | `items: [Webhook!]!` | -- | Not paginated |
| `WebhookEventCollection` | `items: [WebhookEvent]` | -- | Webhook delivery history |
