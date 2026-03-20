# Webhook Examples

## Example 1: Create a Webhook for New Versions

The most common use case -- trigger an action when a new version is created.

### GraphQL Mutation

```graphql
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
```

### Variables

```json
{
  "webhook": {
    "streamId": "abc123def456",
    "url": "https://ci.example.com/speckle/webhook",
    "description": "Trigger CI pipeline on new versions",
    "triggers": ["commit_create"],
    "secret": "whsec_a1b2c3d4e5f6",
    "enabled": true
  }
}
```

### Response

```json
{
  "data": {
    "webhookCreate": "wh_xyz789"
  }
}
```

Store the returned ID (`wh_xyz789`) for future update/delete operations.

---

## Example 2: Create a Webhook for Multiple Events

Monitor model changes AND permission changes on a project.

```json
{
  "webhook": {
    "streamId": "abc123def456",
    "url": "https://audit.example.com/speckle/events",
    "description": "Audit log for model and permission changes",
    "triggers": [
      "branch_create",
      "branch_update",
      "branch_delete",
      "stream_permissions_add",
      "stream_permissions_remove"
    ],
    "secret": "whsec_audit_secret_here",
    "enabled": true
  }
}
```

---

## Example 3: Disable a Webhook

Temporarily disable a webhook without deleting it.

```graphql
mutation WebhookUpdate($webhook: WebhookUpdateInput!) {
  webhookUpdate(webhook: $webhook)
}
```

```json
{
  "webhook": {
    "id": "wh_xyz789",
    "streamId": "abc123def456",
    "enabled": false
  }
}
```

---

## Example 4: Update Webhook Triggers

Change the triggers on an existing webhook. This REPLACES all existing triggers.

```json
{
  "webhook": {
    "id": "wh_xyz789",
    "streamId": "abc123def456",
    "triggers": ["commit_create", "commit_update", "commit_delete"]
  }
}
```

**WARNING:** This removes any triggers not in the new array. If the webhook previously had `branch_create`, it will no longer fire for that event.

---

## Example 5: Delete a Webhook

```graphql
mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
```

```json
{
  "webhook": {
    "id": "wh_xyz789",
    "streamId": "abc123def456"
  }
}
```

---

## Example 6: Query All Webhooks for a Project

```graphql
query ProjectWebhooks($projectId: String!) {
  project(id: $projectId) {
    webhooks {
      totalCount
      items {
        id
        url
        description
        triggers
        enabled
        hasSecret
        history(limit: 3) {
          totalCount
          items {
            id
            status
            statusInfo
            retryCount
            lastUpdate
          }
        }
      }
    }
  }
}
```

### Response

```json
{
  "data": {
    "project": {
      "webhooks": {
        "totalCount": 2,
        "items": [
          {
            "id": "wh_xyz789",
            "url": "https://ci.example.com/speckle/webhook",
            "description": "Trigger CI pipeline on new versions",
            "triggers": ["commit_create"],
            "enabled": true,
            "hasSecret": true,
            "history": {
              "totalCount": 47,
              "items": [
                {
                  "id": "evt_001",
                  "status": 200,
                  "statusInfo": "OK",
                  "retryCount": 0,
                  "lastUpdate": "2026-03-20T10:30:00Z"
                },
                {
                  "id": "evt_002",
                  "status": 500,
                  "statusInfo": "Internal Server Error",
                  "retryCount": 3,
                  "lastUpdate": "2026-03-19T15:45:00Z"
                }
              ]
            }
          }
        ]
      }
    }
  }
}
```

---

## Example 7: Query a Specific Webhook by ID

```graphql
query SingleWebhook($projectId: String!, $webhookId: String!) {
  project(id: $projectId) {
    webhooks(id: $webhookId) {
      items {
        id
        url
        triggers
        enabled
        hasSecret
      }
    }
  }
}
```

---

## Example 8: Python Webhook Endpoint (Flask)

A complete webhook receiver with HMAC signature verification.

```python
import hmac
import hashlib
import json
from flask import Flask, request, abort

app = Flask(__name__)
WEBHOOK_SECRET = "whsec_a1b2c3d4e5f6"
EXPECTED_WEBHOOK_ID = "wh_xyz789"

@app.route("/speckle/webhook", methods=["POST"])
def handle_webhook():
    # Step 1: Verify HMAC signature
    received_signature = request.headers.get("X-Webhook-Signature", "")
    computed_signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        request.data,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_signature, received_signature):
        abort(401, "Invalid signature")

    # Step 2: Parse payload
    payload = request.get_json()

    # Step 3: Validate webhook ID
    if payload.get("webhook", {}).get("id") != EXPECTED_WEBHOOK_ID:
        abort(403, "Unknown webhook")

    # Step 4: Extract event info
    event_name = payload["event"]["event_name"]
    project_id = payload["streamId"]
    user_name = payload["user"]["name"]

    # Step 5: Return 200 immediately, process async
    print(f"Event: {event_name} on project {project_id} by {user_name}")

    # In production: enqueue to background job queue here
    # queue.enqueue(process_speckle_event, payload)

    return "OK", 200
```

---

## Example 9: Python Webhook Endpoint (FastAPI)

```python
import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = "whsec_a1b2c3d4e5f6"

@app.post("/speckle/webhook")
async def handle_webhook(request: Request):
    body = await request.body()

    # Verify signature
    received_sig = request.headers.get("X-Webhook-Signature", "")
    computed_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_sig, received_sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()

    event_name = payload["event"]["event_name"]
    project_id = payload["streamId"]

    # Route by event type
    if event_name == "commit_create":
        # Handle new version
        pass
    elif event_name == "branch_create":
        # Handle new model
        pass
    elif event_name.startswith("stream_permissions"):
        # Handle permission changes
        pass

    return {"status": "received"}
```

---

## Example 10: Webhook Integration Pattern (Complete Workflow)

### Step 1: Create the Webhook

```python
import requests

SPECKLE_URL = "https://app.speckle.systems"
TOKEN = "your-personal-access-token"
PROJECT_ID = "abc123def456"

query = """
mutation WebhookCreate($webhook: WebhookCreateInput!) {
  webhookCreate(webhook: $webhook)
}
"""

variables = {
    "webhook": {
        "streamId": PROJECT_ID,
        "url": "https://your-app.com/speckle/webhook",
        "description": "Automated version processing",
        "triggers": ["commit_create"],
        "secret": "whsec_your_secret",
        "enabled": True
    }
}

response = requests.post(
    f"{SPECKLE_URL}/graphql",
    json={"query": query, "variables": variables},
    headers={"Authorization": f"Bearer {TOKEN}"}
)

webhook_id = response.json()["data"]["webhookCreate"]
print(f"Created webhook: {webhook_id}")
```

### Step 2: Check Delivery History

```python
history_query = """
query WebhookHistory($projectId: String!, $webhookId: String!) {
  project(id: $projectId) {
    webhooks(id: $webhookId) {
      items {
        history(limit: 10) {
          totalCount
          items {
            status
            statusInfo
            retryCount
            lastUpdate
          }
        }
      }
    }
  }
}
"""

response = requests.post(
    f"{SPECKLE_URL}/graphql",
    json={
        "query": history_query,
        "variables": {"projectId": PROJECT_ID, "webhookId": webhook_id}
    },
    headers={"Authorization": f"Bearer {TOKEN}"}
)

events = response.json()["data"]["project"]["webhooks"]["items"][0]["history"]["items"]
for event in events:
    if event["status"] != 200:
        print(f"Failed delivery: {event['statusInfo']} (retries: {event['retryCount']})")
```

### Step 3: Cleanup -- Delete When Done

```python
delete_query = """
mutation WebhookDelete($webhook: WebhookDeleteInput!) {
  webhookDelete(webhook: $webhook)
}
"""

requests.post(
    f"{SPECKLE_URL}/graphql",
    json={
        "query": delete_query,
        "variables": {"webhook": {"id": webhook_id, "streamId": PROJECT_ID}}
    },
    headers={"Authorization": f"Bearer {TOKEN}"}
)
```
