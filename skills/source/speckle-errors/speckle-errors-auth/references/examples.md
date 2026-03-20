# speckle-errors-auth — Examples Reference

## Example 1: Diagnose a 401 Error with SpecklePy

**Scenario:** Script fails with `SpeckleException` when connecting to a self-hosted server.

```python
from specklepy.api.client import SpeckleClient

# Step 1: Verify server is reachable (no auth needed)
client = SpeckleClient(host="https://speckle.mycompany.com")

# Step 2: Check server info — confirms correct URL and available auth strategies
server_info = client.server.get()
print(f"Server: {server_info.name}, Version: {server_info.version}")
print(f"Auth strategies: {[s.id for s in server_info.authStrategies]}")

# Step 3: Authenticate and verify
client.authenticate_with_token("your_token_here")
try:
    user = client.active_user.get()
    if user is None:
        print("ERROR: Token is invalid or missing profile:read scope")
    else:
        print(f"Authenticated as: {user.name} (role: {user.role})")
except Exception as e:
    print(f"Auth failed: {e}")
```

---

## Example 2: Diagnose a 403 Error — Missing Scope

**Scenario:** Token works for reading projects but fails when creating a model.

```graphql
# Step 1: Verify token works at all
query { activeUser { id name } }
# Result: { "activeUser": { "id": "abc123", "name": "John" } }
# Token is valid ✓

# Step 2: Check role on the target project
query { project(id: "project123") { role } }
# Result: { "project": { "role": "contributor" } }
# Role is sufficient ✓

# Step 3: Check granular permissions
query {
  project(id: "project123") {
    permissions {
      canCreateModel { authorized code message }
    }
  }
}
# Result: { "permissions": { "canCreateModel": { "authorized": false, "code": "FORBIDDEN", "message": "Token missing required scope" } } }
# Token is missing streams:write scope ✗

# Fix: Create a new PAT with streams:write scope
```

---

## Example 3: Create a PAT with Minimal Scopes

**Scenario:** Creating a token for a CI/CD pipeline that only reads data from one project.

```graphql
mutation {
  apiTokenCreate(token: {
    name: "CI Pipeline - Read Only"
    scopes: ["streams:read", "profile:read"]
    lifespan: 2592000
    limitResources: [
      { id: "project-id-here", type: project }
    ]
  })
}
```

**Result:** Returns the token string. ALWAYS save it immediately — it cannot be retrieved later.

**Why this is correct:**
- Only `streams:read` and `profile:read` — minimal scopes for reading project data
- `lifespan: 2592000` — expires in 30 days (30 * 24 * 60 * 60)
- `limitResources` — restricted to a single project

---

## Example 4: Full OAuth2 Flow with Challenge

**Scenario:** Web application implementing Speckle login.

```javascript
// --- Step 1: Initiate login ---
function startSpeckleLogin() {
  const challenge = crypto.randomUUID();
  localStorage.setItem('speckle_challenge', challenge);

  const serverUrl = 'https://app.speckle.systems';
  const appId = 'your-registered-app-id';

  window.location.href = `${serverUrl}/authn/verify/${appId}/${challenge}`;
}

// --- Step 2: Handle callback (on redirect URI page) ---
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const accessCode = params.get('access_code');

  if (!accessCode) {
    console.error('No access_code in callback URL');
    return;
  }

  const challenge = localStorage.getItem('speckle_challenge');
  if (!challenge) {
    console.error('Challenge not found — was localStorage cleared?');
    return;
  }

  const response = await fetch('https://app.speckle.systems/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessCode: accessCode,
      appId: 'your-registered-app-id',
      appSecret: 'your-app-secret',   // ONLY if using backend proxy
      challenge: challenge
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Token exchange failed: ${error}`);
    // Common causes:
    // - Challenge mismatch (localStorage was cleared between redirect and callback)
    // - Access code expired (took too long to complete callback)
    // - Wrong appId or appSecret
    return;
  }

  const { token, refreshToken } = await response.json();

  // ALWAYS store both tokens
  localStorage.setItem('speckle_token', token);
  localStorage.setItem('speckle_refresh_token', refreshToken);

  // Clean up challenge
  localStorage.removeItem('speckle_challenge');
}

// --- Step 3: Refresh token when access token expires ---
async function refreshSpeckleToken() {
  const refreshToken = localStorage.getItem('speckle_refresh_token');

  if (!refreshToken) {
    console.error('No refresh token available — user must re-authenticate');
    startSpeckleLogin();
    return;
  }

  const response = await fetch('https://app.speckle.systems/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: refreshToken,
      appId: 'your-registered-app-id',
      appSecret: 'your-app-secret'
    })
  });

  if (!response.ok) {
    console.error('Refresh failed — user must re-authenticate');
    localStorage.removeItem('speckle_token');
    localStorage.removeItem('speckle_refresh_token');
    startSpeckleLogin();
    return;
  }

  const data = await response.json();

  // CRITICAL: Store the NEW refresh token — old one is now invalid
  localStorage.setItem('speckle_token', data.token);
  localStorage.setItem('speckle_refresh_token', data.refreshToken);
}
```

---

## Example 5: Debugging Resource-Scoped Token

**Scenario:** Token works for one project but returns FORBIDDEN for another.

```python
from specklepy.api.client import SpeckleClient

client = SpeckleClient(host="https://app.speckle.systems")
client.authenticate_with_token("resource_scoped_token")

# This works — token is scoped to this project
project_a = client.project.get("allowed-project-id")
print(f"Project A: {project_a.name}")  # Success

# This fails — token is NOT scoped to this project
try:
    project_b = client.project.get("other-project-id")
except Exception as e:
    print(f"Project B failed: {e}")
    # SpeckleException: FORBIDDEN
    # Fix: Create a new token that includes both projects in limitResources
    # OR create a token without limitResources
```

---

## Example 6: Discover Server Auth Configuration

**Scenario:** Connecting to an unknown self-hosted server for the first time.

```graphql
# No authentication needed for this query
query {
  serverInfo {
    name
    canonicalUrl
    version
    authStrategies {
      id
      name
      icon
    }
    scopes {
      name
      description
    }
  }
}
```

**Possible results:**

```json
{
  "serverInfo": {
    "name": "Company Speckle Server",
    "canonicalUrl": "https://speckle.company.com",
    "version": "2.20.1",
    "authStrategies": [
      { "id": "local", "name": "Local", "icon": "mdi-email-outline" },
      { "id": "azure-ad", "name": "Microsoft", "icon": "mdi-microsoft" }
    ],
    "scopes": [
      { "name": "streams:read", "description": "Read your streams & models" },
      { "name": "streams:write", "description": "Create, update & delete streams" }
    ]
  }
}
```

**Interpretation:**
- Server supports local (email/password) and Azure AD authentication
- OAuth apps must support these auth strategies
- Available scopes show what permissions can be requested

---

## Example 7: SpecklePy — Use Stored Account from Speckle Manager

**Scenario:** Desktop script using Speckle Manager credentials instead of hardcoded tokens.

```python
from specklepy.api.client import SpeckleClient
from specklepy.api.credentials import get_default_account, get_local_accounts

# Option A: Use the default account
try:
    account = get_default_account()
    client = SpeckleClient(host=account.serverInfo.url)
    client.authenticate_with_account(account)
    user = client.active_user.get()
    print(f"Using default account: {user.name} on {account.serverInfo.url}")
except Exception as e:
    print(f"No default account: {e}")
    print("Open Speckle Manager and log in to set a default account")

# Option B: List all accounts and pick one
accounts = get_local_accounts()
if not accounts:
    print("No accounts found in Speckle Manager")
else:
    for acc in accounts:
        print(f"  - {acc.userInfo.name} on {acc.serverInfo.url}")

    # Use a specific server's account
    target = next(
        (a for a in accounts if "myserver" in a.serverInfo.url),
        None
    )
    if target:
        client = SpeckleClient(host=target.serverInfo.url)
        client.authenticate_with_account(target)
```
