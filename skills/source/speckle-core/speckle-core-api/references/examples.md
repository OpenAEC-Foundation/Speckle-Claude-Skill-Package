# speckle-core-api — Examples

> Working GraphQL and REST examples for Speckle Server 2.x/3.x.
> All examples use current (non-deprecated) API surface.

---

## 1. Discover Server Capabilities (No Auth)

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { serverInfo { name version canonicalUrl configuration { objectSizeLimitBytes objectMultipartUploadSizeLimitBytes } scopes { name description } authStrategies { id name } workspaces { workspacesEnabled } } }"
  }'
```

ALWAYS run this first to discover server limits, available scopes, and features.

---

## 2. Authenticate and Get User Profile

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "query { activeUser { id name email role verified } }"
  }'
```

If the response returns `"activeUser": null`, the token is invalid or expired.

---

## 3. List User Projects (Paginated)

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "query($limit: Int!, $cursor: String) { activeUser { projects(limit: $limit, cursor: $cursor) { totalCount cursor items { id name description visibility role createdAt } } } }",
    "variables": { "limit": 25, "cursor": null }
  }'
```

To get the next page, pass the returned `cursor` value as the `cursor` variable.

---

## 4. Get Project with Models

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "query($projectId: String!) { project(id: $projectId) { id name models(limit: 25) { totalCount cursor items { id name displayName description createdAt author { id name } } } } }",
    "variables": { "projectId": "YOUR_PROJECT_ID" }
  }'
```

---

## 5. Get Model Versions (to find referencedObject)

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "query($projectId: String!, $modelId: String!) { project(id: $projectId) { model(id: $modelId) { id name versions(limit: 10) { items { id referencedObject message sourceApplication createdAt } cursor totalCount } } } }",
    "variables": { "projectId": "YOUR_PROJECT_ID", "modelId": "YOUR_MODEL_ID" }
  }'
```

The `referencedObject` is the root object ID needed for REST download.

---

## 6. Download Object Tree via REST

```bash
# Download root object and ALL children (gzip-compressed JSON)
curl -H "Authorization: Bearer YOUR_PAT_HERE" \
  -H "Accept: application/json" \
  "https://app.speckle.systems/objects/YOUR_PROJECT_ID/YOUR_OBJECT_ID" \
  --compressed -o objects.json
```

```bash
# Download single object only (no children)
curl -H "Authorization: Bearer YOUR_PAT_HERE" \
  "https://app.speckle.systems/objects/YOUR_PROJECT_ID/YOUR_OBJECT_ID/single"
```

---

## 7. Complete Send Workflow (Python with requests)

```python
import requests
import json
import hashlib

SERVER = "https://app.speckle.systems"
TOKEN = "YOUR_PAT_HERE"
PROJECT_ID = "YOUR_PROJECT_ID"
MODEL_ID = "YOUR_MODEL_ID"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# Step 1: Create objects
wall = {
    "speckle_type": "Objects.BuiltElements.Wall",
    "height": 3.0,
    "thickness": 0.2,
    "name": "Wall-001",
}

# Compute deterministic ID (SHA-256 of sorted JSON)
wall_json = json.dumps(wall, sort_keys=True)
wall["id"] = hashlib.sha256(wall_json.encode()).hexdigest()[:32]

root = {
    "speckle_type": "Base",
    "name": "My Commit",
    "@elements": [wall],
    "totalChildrenCount": 1,
}
root_json = json.dumps(root, sort_keys=True)
root["id"] = hashlib.sha256(root_json.encode()).hexdigest()[:32]

# Step 2: Upload objects via REST
upload_resp = requests.post(
    f"{SERVER}/objects/{PROJECT_ID}",
    headers={**headers, "Content-Type": "application/json"},
    json=[root, wall],
)
assert upload_resp.status_code == 201, f"Upload failed: {upload_resp.text}"

# Step 3: Create version via GraphQL
mutation = """
mutation($input: CreateVersionInput!) {
  versionMutations {
    create(input: $input) {
      id
      referencedObject
      message
    }
  }
}
"""
variables = {
    "input": {
        "objectId": root["id"],
        "modelId": MODEL_ID,
        "projectId": PROJECT_ID,
        "message": "Automated upload",
        "sourceApplication": "Python Script",
    }
}

resp = requests.post(
    f"{SERVER}/graphql",
    headers=headers,
    json={"query": mutation, "variables": variables},
)
result = resp.json()
print("Created version:", result["data"]["versionMutations"]["create"]["id"])
```

---

## 8. Complete Receive Workflow (Python with requests)

```python
import requests

SERVER = "https://app.speckle.systems"
TOKEN = "YOUR_PAT_HERE"
PROJECT_ID = "YOUR_PROJECT_ID"
VERSION_ID = "YOUR_VERSION_ID"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

# Step 1: Get the referencedObject from the version
query = """
query($projectId: String!, $versionId: String!) {
  project(id: $projectId) {
    version(id: $versionId) {
      id
      referencedObject
      message
    }
  }
}
"""
resp = requests.post(
    f"{SERVER}/graphql",
    headers=headers,
    json={
        "query": query,
        "variables": {"projectId": PROJECT_ID, "versionId": VERSION_ID},
    },
)
version_data = resp.json()["data"]["project"]["version"]
object_id = version_data["referencedObject"]

# Step 2: Download the full object tree via REST
download_resp = requests.get(
    f"{SERVER}/objects/{PROJECT_ID}/{object_id}",
    headers={**headers, "Accept": "application/json"},
)
objects = download_resp.json()
print(f"Downloaded {len(objects)} objects")

# Step 3: Mark version as received
mark_mutation = """
mutation($input: MarkReceivedVersionInput!) {
  versionMutations {
    markReceived(input: $input)
  }
}
"""
requests.post(
    f"{SERVER}/graphql",
    headers=headers,
    json={
        "query": mark_mutation,
        "variables": {
            "input": {
                "projectId": PROJECT_ID,
                "versionId": VERSION_ID,
                "sourceApplication": "Python Script",
                "message": "Received for processing",
            }
        },
    },
)
```

---

## 9. Create a Project

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "mutation($input: ProjectCreateInput) { projectMutations { create(input: $input) { id name visibility } } }",
    "variables": { "input": { "name": "My New Project", "description": "Created via API", "visibility": "PRIVATE" } }
  }'
```

---

## 10. Create a Model in a Project

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "mutation($input: CreateModelInput!) { modelMutations { create(input: $input) { id name } } }",
    "variables": { "input": { "name": "Architecture", "description": "Main architecture model", "projectId": "YOUR_PROJECT_ID" } }
  }'
```

---

## 11. Create a Webhook

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "mutation($webhook: WebhookCreateInput!) { webhookCreate(webhook: $webhook) }",
    "variables": {
      "webhook": {
        "streamId": "YOUR_PROJECT_ID",
        "url": "https://your-endpoint.com/webhook",
        "description": "Version notifications",
        "triggers": ["commit_create", "branch_update"],
        "enabled": true
      }
    }
  }'
```

**CRITICAL**: Use `commit_create` (internal name), NOT `version_create` (display name). Use `streamId` field even though it refers to a project.

---

## 12. OAuth2 + Challenge Flow (Node.js)

```javascript
const crypto = require("crypto");
const express = require("express");
const fetch = require("node-fetch");

const SERVER = "https://app.speckle.systems";
const APP_ID = "YOUR_APP_ID";
const APP_SECRET = "YOUR_APP_SECRET"; // NEVER expose in client-side code
const REDIRECT_URI = "http://localhost:3000/callback";

const app = express();
let storedChallenge = null;

// Step 1: Redirect to Speckle authorization
app.get("/login", (req, res) => {
  storedChallenge = crypto.randomBytes(32).toString("hex");
  res.redirect(`${SERVER}/authn/verify/${APP_ID}/${storedChallenge}`);
});

// Step 2: Handle callback with access_code
app.get("/callback", async (req, res) => {
  const accessCode = req.query.access_code;

  if (!accessCode) {
    return res.status(400).send("Missing access_code");
  }

  // Step 3: Exchange code + challenge for tokens
  const tokenResp = await fetch(`${SERVER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessCode: accessCode,
      appId: APP_ID,
      appSecret: APP_SECRET,
      challenge: storedChallenge, // MUST match the original challenge
    }),
  });

  const tokens = await tokenResp.json();
  // tokens = { token: "...", refreshToken: "..." }

  // Step 4: Use the token
  const userResp = await fetch(`${SERVER}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.token}`,
    },
    body: JSON.stringify({
      query: "query { activeUser { id name email } }",
    }),
  });
  const userData = await userResp.json();
  res.json(userData);
});

// Step 5: Refresh token when expired
async function refreshToken(currentRefreshToken) {
  const resp = await fetch(`${SERVER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: currentRefreshToken,
      appId: APP_ID,
      appSecret: APP_SECRET,
    }),
  });
  return resp.json(); // { token: "...", refreshToken: "..." }
}

app.listen(3000);
```

---

## 13. Pagination Pattern (Complete)

```python
import requests

SERVER = "https://app.speckle.systems"
TOKEN = "YOUR_PAT_HERE"
PROJECT_ID = "YOUR_PROJECT_ID"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

query = """
query($projectId: String!, $limit: Int!, $cursor: String) {
  project(id: $projectId) {
    models(limit: $limit, cursor: $cursor) {
      totalCount
      cursor
      items { id name displayName }
    }
  }
}
"""

all_models = []
cursor = None

while True:
    resp = requests.post(
        f"{SERVER}/graphql",
        headers=headers,
        json={
            "query": query,
            "variables": {
                "projectId": PROJECT_ID,
                "limit": 25,
                "cursor": cursor,
            },
        },
    )
    data = resp.json()["data"]["project"]["models"]
    all_models.extend(data["items"])

    cursor = data["cursor"]
    if cursor is None:
        break  # No more pages

print(f"Fetched {len(all_models)} of {data['totalCount']} models")
```

---

## 14. Rate Limit Handling

```python
import time
import requests

def graphql_request(server, token, query, variables=None, max_retries=3):
    """Execute a GraphQL request with rate limit handling."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    for attempt in range(max_retries):
        resp = requests.post(f"{server}/graphql", headers=headers, json=payload)

        if resp.status_code == 429:
            retry_after_ms = int(resp.headers.get("Retry-After", 5000))
            retry_after_sec = retry_after_ms / 1000
            print(f"Rate limited. Waiting {retry_after_sec}s...")
            time.sleep(retry_after_sec)
            continue

        resp.raise_for_status()
        result = resp.json()

        if "errors" in result:
            for error in result["errors"]:
                code = error.get("extensions", {}).get("code", "UNKNOWN")
                if code == "UNAUTHENTICATED":
                    raise PermissionError("Token is invalid or expired")
                if code == "FORBIDDEN":
                    raise PermissionError(f"Insufficient permissions: {error['message']}")
            raise RuntimeError(f"GraphQL errors: {result['errors']}")

        return result["data"]

    raise RuntimeError(f"Failed after {max_retries} retries (rate limited)")
```

---

## 15. Create Resource-Scoped API Token

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "mutation($token: ApiTokenCreateInput!) { apiTokenCreate(token: $token) }",
    "variables": {
      "token": {
        "name": "CI/CD Token - Project X",
        "scopes": ["streams:read", "streams:write"],
        "lifespan": 2592000000000000,
        "limitResources": [
          { "id": "YOUR_PROJECT_ID", "type": "project" }
        ]
      }
    }
  }'
```

The response contains the token string. This is shown ONLY ONCE -- store it immediately.

---

## 16. Query Webhooks and History

```bash
curl -X POST https://app.speckle.systems/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAT_HERE" \
  -d '{
    "query": "query($projectId: String!) { project(id: $projectId) { webhooks { totalCount items { id url description triggers enabled hasSecret history(limit: 5) { items { id status statusInfo retryCount lastUpdate } } } } } }",
    "variables": { "projectId": "YOUR_PROJECT_ID" }
  }'
```
