# Webhook Anti-Patterns

## AP-1: Using Display Names as Trigger Strings

**WRONG:**
```json
{
  "triggers": ["version_create", "model_update", "project_delete"]
}
```

**RIGHT:**
```json
{
  "triggers": ["commit_create", "branch_update", "stream_delete"]
}
```

**WHY:** The Speckle API uses legacy/internal terminology for webhook trigger strings. The UI displays modern names (version, model, project) but the GraphQL API requires the legacy names (commit, branch, stream). Using display names causes the webhook to NEVER fire because the trigger strings do not match any internal event.

---

## AP-2: Comparing Signatures with == Instead of Constant-Time Comparison

**WRONG:**
```python
if computed_signature == received_signature:
    process_webhook(payload)
```

**RIGHT:**
```python
import hmac
if hmac.compare_digest(computed_signature, received_signature):
    process_webhook(payload)
```

**WHY:** String equality (`==`) is vulnerable to timing attacks. An attacker can determine the correct signature one character at a time by measuring response times. `hmac.compare_digest()` performs constant-time comparison that takes the same amount of time regardless of where characters differ.

---

## AP-3: Processing Webhooks Synchronously

**WRONG:**
```python
@app.route("/webhook", methods=["POST"])
def handle():
    payload = request.get_json()
    # Long-running processing inline
    download_all_objects(payload["streamId"])
    run_analysis(payload)
    generate_report(payload)
    return "OK", 200
```

**RIGHT:**
```python
@app.route("/webhook", methods=["POST"])
def handle():
    payload = request.get_json()
    # Enqueue for background processing, return immediately
    queue.enqueue(process_speckle_event, payload)
    return "OK", 200
```

**WHY:** Webhook endpoints MUST return a 2xx response promptly. Long-running processing blocks the response, causing Speckle to treat the delivery as failed and trigger retries. This leads to duplicate event processing and potential cascading failures.

---

## AP-4: Not Validating the Webhook ID

**WRONG:**
```python
@app.route("/webhook", methods=["POST"])
def handle():
    payload = request.get_json()
    # Process any incoming request without validation
    process_event(payload)
    return "OK", 200
```

**RIGHT:**
```python
EXPECTED_WEBHOOK_IDS = {"wh_abc123", "wh_def456"}

@app.route("/webhook", methods=["POST"])
def handle():
    payload = request.get_json()
    webhook_id = payload.get("webhook", {}).get("id")
    if webhook_id not in EXPECTED_WEBHOOK_IDS:
        return "Unknown webhook", 403
    process_event(payload)
    return "OK", 200
```

**WHY:** Without webhook ID validation, any HTTP client that discovers your endpoint URL can send fabricated payloads. ALWAYS verify the webhook ID matches one you created. Combine with HMAC signature verification for defense in depth.

---

## AP-5: Assuming the Secret Is Returned in Queries

**WRONG:**
```python
# Trying to retrieve the secret from the API
result = client.execute("""
  query { project(id: "abc") { webhooks { items { secret } } } }
""")
secret = result["data"]["project"]["webhooks"]["items"][0]["secret"]
```

**RIGHT:**
```python
# Store the secret at creation time
webhook_secret = "whsec_my_secret"
result = client.execute(webhook_create_mutation, variables={
    "webhook": {"streamId": "abc", "url": "...", "triggers": [...], "secret": webhook_secret}
})
# Save webhook_secret to your secure configuration store
```

**WHY:** Speckle NEVER returns the webhook secret after creation. The API only exposes a `hasSecret` boolean field. If you lose the secret, you MUST update the webhook with a new secret. ALWAYS store the secret in a secure location (environment variable, secrets manager) at the time of webhook creation.

---

## AP-6: Exceeding the Webhook Limit

**WRONG:**
```python
# Creating a separate webhook for each event type
for trigger in all_14_triggers:
    create_webhook(stream_id, url, [trigger])
```

**RIGHT:**
```python
# Combine triggers into a single webhook
create_webhook(stream_id, url, [
    "commit_create", "branch_create", "branch_update",
    "stream_permissions_add", "stream_permissions_remove"
])
```

**WHY:** Each project has a hard limit of 100 webhooks (`MAX_STREAM_WEBHOOKS = 100`). Creating one webhook per trigger wastes this quota. ALWAYS consolidate related triggers into a single webhook and route events by `event.event_name` in your handler.

---

## AP-7: Partial Trigger Updates (Forgetting Existing Triggers)

**WRONG:**
```json
{
  "webhook": {
    "id": "wh_xyz",
    "streamId": "abc",
    "triggers": ["comment_created"]
  }
}
```
This REPLACES all triggers, removing any previously configured triggers like `commit_create`.

**RIGHT:**
```python
# First query existing triggers
existing = query_webhook(webhook_id)
current_triggers = existing["triggers"]

# Then merge with new triggers
new_triggers = list(set(current_triggers + ["comment_created"]))
update_webhook(webhook_id, stream_id, triggers=new_triggers)
```

**WHY:** The `webhookUpdate` mutation REPLACES the entire `triggers` array -- it does NOT merge with existing triggers. If you want to ADD a trigger, you MUST first query the current triggers, merge them with the new one, and send the complete list.

---

## AP-8: Not Handling Duplicate Deliveries

**WRONG:**
```python
@app.route("/webhook", methods=["POST"])
def handle():
    payload = request.get_json()
    # Process every delivery as unique
    create_version_record(payload)
    return "OK", 200
```

**RIGHT:**
```python
@app.route("/webhook", methods=["POST"])
def handle():
    payload = request.get_json()
    event_id = payload["event"].get("id", "")
    if is_already_processed(event_id):
        return "OK", 200  # Idempotent response
    mark_as_processed(event_id)
    create_version_record(payload)
    return "OK", 200
```

**WHY:** Webhook retries can deliver the same event multiple times. If your endpoint was slow or returned a non-2xx status on the first attempt, Speckle retries the delivery. Without idempotency checks, you process the same event multiple times, causing duplicate records or actions.

---

## AP-9: Ignoring Webhook History for Debugging

**WRONG:** Blindly assuming webhooks are working without checking delivery status.

**RIGHT:**
```graphql
query {
  project(id: "abc") {
    webhooks {
      items {
        id
        url
        enabled
        history(limit: 10) {
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
```

**WHY:** The webhook history provides HTTP status codes, error messages, retry counts, and timestamps for every delivery attempt. ALWAYS check history when debugging webhook issues. A `retryCount` greater than 0 indicates delivery problems that need investigation.

---

## AP-10: Expecting Sensitive Fields in Payloads

**WRONG:**
```python
# Trying to use user email from webhook payload
user_email = payload["user"]["email"]
send_notification(user_email, "Your version was processed")
```

**RIGHT:**
```python
# Query user details separately via GraphQL
user_id = payload["userId"]
user_details = query_user(user_id)  # GraphQL query with appropriate scope
send_notification(user_details["email"], "Your version was processed")
```

**WHY:** Speckle ALWAYS strips sensitive fields from webhook payloads: `server.id`, `user.passwordDigest`, `user.email`, and `webhook.secret`. If you need a user's email address, query it separately via the GraphQL API with appropriate authentication scope (`users:email`).
