# speckle-core-api — Anti-Patterns

> What NOT to do when working with the Speckle API, with explanations of WHY each pattern causes problems.

---

## AP-1: Using Legacy API in New Code

**WRONG**:
```graphql
query { stream(id: "abc123") { branches { items { name } } } }
```

**RIGHT**:
```graphql
query { project(id: "abc123") { models(limit: 25) { items { name } } } }
```

**WHY**: The `stream`, `branch`, and `commit` queries are deprecated and will be removed in a future server release. New code using legacy queries will break when this happens. ALWAYS use `project`, `model`, `version`.

---

## AP-2: Not Paginating Collections

**WRONG**:
```graphql
query { project(id: "abc") { models { items { id name } } } }
```
Assuming all models are returned in a single response.

**RIGHT**:
```graphql
query($cursor: String) {
  project(id: "abc") {
    models(limit: 25, cursor: $cursor) {
      items { id name }
      cursor
      totalCount
    }
  }
}
```
Loop until `cursor` is `null`.

**WHY**: Speckle collections are ALWAYS paginated. Without specifying `limit` and iterating with `cursor`, you silently miss data. A project may have hundreds of models that are not returned in one query.

---

## AP-3: Using children() with query/orderBy for Basic Retrieval

**WRONG**:
```graphql
query {
  project(id: "abc") {
    object(id: "def") {
      children(query: [{ field: "speckle_type", operator: "=", value: "Wall" }], orderBy: { field: "name" }) {
        objects { id data }
      }
    }
  }
}
```

**RIGHT**:
```graphql
# For basic traversal:
query {
  project(id: "abc") {
    object(id: "def") {
      children(limit: 100) {
        objects { id speckleType data }
      }
    }
  }
}

# For large datasets, use REST instead:
# GET /objects/abc/def
```

**WHY**: The `query` and `orderBy` parameters on `children` trigger expensive SQL queries on the server. They are designed for advanced filtering use cases only. For standard data retrieval, use plain `children(limit: N)` or the REST endpoint.

---

## AP-4: Embedding PATs in Client-Side Code

**WRONG**:
```javascript
// In browser JavaScript
const TOKEN = "abc123def456...";  // Personal Access Token hardcoded
fetch("https://app.speckle.systems/graphql", {
  headers: { "Authorization": `Bearer ${TOKEN}` }
});
```

**RIGHT**:
- For browser apps: Use OAuth2 + Challenge flow (see examples.md #12)
- For server-side scripts: Store PAT in environment variables
- For CI/CD: Use secret management (GitHub Secrets, Vault, etc.)

**WHY**: Browser JavaScript is visible to anyone using dev tools. A leaked PAT gives full access to the user's Speckle account with all granted scopes. PATs are for server-side use ONLY.

---

## AP-5: Ignoring Rate Limits

**WRONG**:
```python
for project_id in project_ids:
    resp = requests.post(f"{server}/graphql", json={"query": query})
    # No rate limit handling — crashes on 429
```

**RIGHT**:
```python
for project_id in project_ids:
    resp = requests.post(f"{server}/graphql", json={"query": query})
    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", 5000)) / 1000
        time.sleep(retry_after)
        resp = requests.post(f"{server}/graphql", json={"query": query})
```

**WHY**: Speckle enforces rate limits. Ignoring 429 responses causes your application to fail silently or throw unhandled errors. ALWAYS check for 429, read the `Retry-After` header (milliseconds), and wait before retrying.

---

## AP-6: Using GraphQL for Large Object Downloads

**WRONG**:
```graphql
query {
  project(id: "abc") {
    object(id: "root-object-id") {
      data  # Returns the ENTIRE object as JSON — extremely slow for large models
    }
  }
}
```

**RIGHT**:
```bash
# Use REST endpoint — supports gzip streaming
curl -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  "https://app.speckle.systems/objects/PROJECT_ID/OBJECT_ID" \
  --compressed
```

**WHY**: The GraphQL `data` field serializes the entire object tree into the GraphQL response, which is limited by server memory and response size. The REST endpoint streams gzip-compressed data, handling models with millions of objects efficiently.

---

## AP-7: Using Display Names for Webhook Triggers

**WRONG**:
```json
{
  "webhook": {
    "streamId": "project-123",
    "url": "https://my-endpoint.com/hook",
    "triggers": ["version_create", "model_update"]
  }
}
```

**RIGHT**:
```json
{
  "webhook": {
    "streamId": "project-123",
    "url": "https://my-endpoint.com/hook",
    "triggers": ["commit_create", "branch_update"]
  }
}
```

**WHY**: The Speckle webhook system internally uses legacy terminology. The UI shows "version_create" but the API expects "commit_create". Using display names causes the webhook to silently NOT trigger on the events you intended. This is the most common webhook integration mistake.

---

## AP-8: Forgetting the Challenge in OAuth2

**WRONG**:
```javascript
// Step 1: Redirect (no challenge stored)
res.redirect(`${SERVER}/authn/verify/${APP_ID}/${randomChallenge}`);

// Step 3: Exchange code (wrong/missing challenge)
fetch(`${SERVER}/auth/token`, {
  body: JSON.stringify({
    accessCode: code,
    appId: APP_ID,
    appSecret: APP_SECRET,
    // challenge: ???  — forgot to store and pass it
  })
});
```

**RIGHT**:
```javascript
// Step 1: Generate AND store challenge
const challenge = crypto.randomBytes(32).toString("hex");
req.session.speckleChallenge = challenge;  // Store in session
res.redirect(`${SERVER}/authn/verify/${APP_ID}/${challenge}`);

// Step 3: Pass the SAME challenge
fetch(`${SERVER}/auth/token`, {
  body: JSON.stringify({
    accessCode: code,
    appId: APP_ID,
    appSecret: APP_SECRET,
    challenge: req.session.speckleChallenge,  // Same challenge
  })
});
```

**WHY**: The challenge parameter acts as a PKCE-like proof. Speckle verifies that the challenge sent during authorization matches the one sent during token exchange. Mismatched or missing challenges cause token exchange to fail with no clear error message.

---

## AP-9: Over-Requesting Fields in Nested Queries

**WRONG**:
```graphql
query {
  activeUser {
    projects(limit: 100) {
      items {
        id name description visibility role createdAt updatedAt sourceApps
        models(limit: 100) {
          items {
            id name description createdAt updatedAt
            versions(limit: 100) {
              items {
                id referencedObject message sourceApplication createdAt
                authorUser { id name email bio company avatar }
              }
            }
          }
        }
      }
    }
  }
}
```

**RIGHT**:
```graphql
# Query 1: Get projects
query { activeUser { projects(limit: 25) { items { id name } cursor } } }

# Query 2: Get models for a specific project
query { project(id: "...") { models(limit: 25) { items { id name } cursor } } }

# Query 3: Get versions for a specific model
query { project(id: "...") { model(id: "...") { versions(limit: 10) { items { id referencedObject message } } } } }
```

**WHY**: Deep nesting with many fields causes slow server-side queries. With 100 projects x 100 models x 100 versions, you are requesting up to 1,000,000 version objects in a single query. This causes timeouts or out-of-memory errors. Request only what you need, and use separate queries for different levels.

---

## AP-10: Hardcoding the Server URL

**WRONG**:
```python
SERVER = "https://app.speckle.systems"
# Used throughout the codebase with no way to change
```

**RIGHT**:
```python
import os
SERVER = os.environ.get("SPECKLE_SERVER_URL", "https://app.speckle.systems")
```

**WHY**: Many organizations run self-hosted Speckle servers with custom domains. Hardcoding the cloud URL makes your application unusable for self-hosted deployments. ALWAYS make the server URL configurable via environment variable or constructor parameter.

---

## AP-11: Not Using Aliases for Nested Mutation Parsing

**WRONG**:
```python
result = graphql_request(mutation)
# Navigating deeply nested response structure
project_id = result["data"]["projectMutations"]["create"]["id"]  # fragile
```

**RIGHT**:
```graphql
mutation($input: ProjectCreateInput) {
  data: projectMutations {
    data: create(input: $input) {
      id name
    }
  }
}
```
```python
result = graphql_request(mutation)
project_id = result["data"]["data"]["data"]["id"]  # consistent pattern
```

Or without aliases, use explicit path navigation:
```python
result = graphql_request(mutation)
created = result.get("data", {}).get("projectMutations", {}).get("create", {})
project_id = created.get("id")
```

**WHY**: Speckle mutations use a namespace pattern (`projectMutations.create`, `modelMutations.update`). The SpecklePy SDK uses `data:` aliases to flatten this. In raw GraphQL, either use aliases or implement robust nested access to avoid `KeyError` on unexpected responses.

---

## AP-12: Ignoring Server Upload Limits

**WRONG**:
```python
# Upload a 500MB object blob without checking limits
requests.post(f"{server}/objects/{project_id}", data=huge_payload)
```

**RIGHT**:
```python
# Query limits first
info = graphql_request("query { serverInfo { configuration { objectSizeLimitBytes objectMultipartUploadSizeLimitBytes } } }")
max_size = info["serverInfo"]["configuration"]["objectMultipartUploadSizeLimitBytes"]

# Check payload size before uploading
if len(payload) > max_size:
    # Split into smaller batches
    for chunk in split_objects(objects, max_size):
        requests.post(f"{server}/objects/{project_id}", json=chunk)
else:
    requests.post(f"{server}/objects/{project_id}", json=objects)
```

**WHY**: Speckle servers enforce upload size limits. Exceeding them returns 413 (Payload Too Large). ALWAYS query `serverInfo.configuration` first and split large uploads into batches that fit within the limit.

---

## AP-13: Using ObjectCollection.items Instead of .objects

**WRONG**:
```python
# Expecting items field (like every other collection)
children = result["data"]["project"]["object"]["children"]["items"]
```

**RIGHT**:
```python
# ObjectCollection uses "objects", NOT "items"
children = result["data"]["project"]["object"]["children"]["objects"]
```

**WHY**: `ObjectCollection` is the ONLY collection type in the Speckle schema that uses `objects` instead of `items` as the array field name. This inconsistency causes silent `None`/`undefined` bugs if you assume all collections use `items`.
