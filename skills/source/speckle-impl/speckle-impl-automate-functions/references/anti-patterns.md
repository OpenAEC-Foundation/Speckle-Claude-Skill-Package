# Anti-Patterns (Speckle Automate Functions)

## Function Design Anti-Patterns

### 1. Not Calling mark_run_success() or mark_run_failed()

```python
# WRONG: No explicit outcome — run status is ambiguous
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    objects = list(flatten_base(base))
    # ... process objects ...
    # Function exits without setting status

# CORRECT: ALWAYS set an explicit outcome
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    objects = list(flatten_base(base))
    # ... process objects ...
    automate_context.mark_run_success("Validation complete.")
```

**WHY**: If neither method is called and no exception occurs, the run status is undefined. Consumers of the automation results cannot distinguish between "passed" and "function forgot to report."

---

### 2. Loading Entire Model into Memory

```python
# WRONG: Materializes the entire hierarchy — causes OOM on large models
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    all_objects = list(flatten_base(base))  # entire model in memory
    # ... iterate all_objects ...

# CORRECT: Use generator and filter early
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    forbidden = []
    for obj in flatten_base(base):  # lazy iteration
        if obj.speckle_type == function_inputs.target_type:
            forbidden.append(obj)
            if len(forbidden) > 1000:  # early exit for large models
                break
    # ... report forbidden ...
```

**WHY**: `flatten_base()` returns a generator for lazy evaluation. Calling `list()` on it defeats this purpose and loads every object into memory simultaneously. For models with millions of objects, this causes out-of-memory crashes.

---

### 3. Using Plain Strings for Secrets

```python
# WRONG: API key is visible in logs and the Speckle UI
class FunctionInputs(AutomateBase):
    api_key: str = Field(title="API Key")

# CORRECT: SecretStr encrypts the value
class FunctionInputs(AutomateBase):
    api_key: SecretStr = Field(title="API Key")
```

```csharp
// WRONG: Secret visible in logs
public readonly struct FunctionInputs
{
    [Required]
    public string ApiKey { get; init; }
}

// CORRECT: [Secret] attribute encrypts the value
public readonly struct FunctionInputs
{
    [Required]
    [Secret]
    public string ApiKey { get; init; }
}
```

**WHY**: Without `SecretStr` (Python) or `[Secret]` (C#), sensitive values are stored in plain text, visible in automation logs, and exposed in the Speckle UI input form.

---

### 4. Attaching Errors with Empty Object IDs

```python
# WRONG: Empty list produces a silent failure — no visible annotations
automate_context.attach_error_to_objects(
    category="Compliance",
    object_ids=[],  # nothing to annotate
    message="Some objects failed.",
)

# CORRECT: Only call when you have actual object IDs
if failed_objects:
    automate_context.attach_error_to_objects(
        category="Compliance",
        object_ids=[obj.id for obj in failed_objects],
        message=f"{len(failed_objects)} objects failed.",
    )
```

**WHY**: The method requires actual object IDs to create viewer annotations. An empty list silently does nothing, giving users the false impression that no issues exist.

---

### 5. Not Handling Empty Models

```python
# WRONG: Assumes model always has elements
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    for obj in flatten_base(base):
        # crashes if base has no elements and unexpected structure
        process(obj)

# CORRECT: Guard against empty or minimal models
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    if base is None:
        automate_context.mark_run_failed("Received empty version.")
        return
    objects = list(flatten_base(base))
    if not objects:
        automate_context.mark_run_success("No objects to validate.")
        return
    # ... proceed with validation ...
```

**WHY**: A version might contain an empty or minimal Base object. Functions MUST guard against None values and empty collections to avoid cryptic runtime errors.

---

### 6. Catching All Exceptions Silently

```python
# WRONG: Hides real errors — run appears successful despite failure
def automate_function(automate_context, function_inputs):
    try:
        base = automate_context.receive_version()
        # ... processing ...
        automate_context.mark_run_success("Done.")
    except Exception:
        pass  # silently swallows everything

# CORRECT: Log the error and mark the run as failed
def automate_function(automate_context, function_inputs):
    try:
        base = automate_context.receive_version()
        # ... processing ...
        automate_context.mark_run_success("Done.")
    except Exception as e:
        automate_context.mark_run_failed(f"Unexpected error: {e}")
        raise  # re-raise so Automate records the exception
```

**WHY**: A broad `except: pass` hides legitimate errors. The run appears to complete without issues, but no actual validation occurred. ALWAYS log exceptions and either mark the run as failed or re-raise.

---

## Deployment Anti-Patterns

### 7. Forgetting to Create a GitHub Release

```
WRONG sequence:
1. Push code to main branch
2. Wait for function to appear in Function Library
   → It NEVER appears

CORRECT sequence:
1. Push code to main branch
2. Create a GitHub Release (e.g., v1.0.0)
3. GitHub Actions workflow triggers on the release event
4. Function appears in Function Library after workflow completes
```

**WHY**: The CI/CD workflow triggers on `release` events, NOT on `push` events. Without a release, the workflow never runs and the function is never published.

---

### 8. Modifying Auto-Generated Workflow Environment Variables

```yaml
# WRONG: Removing or renaming injected secrets breaks the pipeline
jobs:
  build:
    steps:
      - uses: specklesystems/speckle-automate-github-composite-action@main
        with:
          speckle_function_id: "hardcoded-value"  # NEVER hardcode
          speckle_function_token: "hardcoded-value"

# CORRECT: Use the secrets injected by the wizard
jobs:
  build:
    steps:
      - uses: specklesystems/speckle-automate-github-composite-action@main
        with:
          speckle_function_id: ${{ secrets.SPECKLE_FUNCTION_ID }}
          speckle_function_token: ${{ secrets.SPECKLE_FUNCTION_TOKEN }}
```

**WHY**: The wizard injects `SPECKLE_FUNCTION_ID` and `SPECKLE_FUNCTION_TOKEN` as repository secrets. Hardcoding values or renaming these secrets breaks authentication with the Speckle registry.

---

## Input Schema Anti-Patterns

### 9. Missing Titles and Descriptions on Fields

```python
# WRONG: Raw field names shown in UI — meaningless to users
class FunctionInputs(AutomateBase):
    max_cnt: int = 100
    tgt_type: str

# CORRECT: Human-readable metadata on every field
class FunctionInputs(AutomateBase):
    max_count: int = Field(
        default=100,
        title="Maximum Object Count",
        description="The maximum number of objects allowed in the model.",
    )
    target_type: str = Field(
        title="Target Speckle Type",
        description="The speckle_type to validate.",
    )
```

**WHY**: Without `title` and `description`, the Speckle UI renders raw Python field names. Users who create automations from your function see `max_cnt` and `tgt_type` with no explanation.

---

### 10. Using Complex Nested Types in Inputs

```python
# WRONG: Nested objects may not render correctly in the Speckle UI form
class FilterConfig(BaseModel):
    include: list[str]
    exclude: list[str]

class FunctionInputs(AutomateBase):
    filters: FilterConfig  # complex nested type

# CORRECT: Keep inputs flat
class FunctionInputs(AutomateBase):
    include_types: str = Field(
        title="Include Types",
        description="Comma-separated list of speckle_types to include.",
    )
    exclude_types: str = Field(
        default="",
        title="Exclude Types",
        description="Comma-separated list of speckle_types to exclude.",
    )
```

**WHY**: The Speckle UI generates a form from the JSON Schema. Deeply nested objects, lists of objects, or union types may not render correctly or may confuse users. ALWAYS use flat, simple types.

---

### 11. Optional Inputs Without Default Values

```python
# WRONG: No default — Speckle treats this as required
class FunctionInputs(AutomateBase):
    optional_filter: str = Field(title="Optional Filter")

# CORRECT: Provide a default for optional inputs
class FunctionInputs(AutomateBase):
    optional_filter: str = Field(
        default="",
        title="Optional Filter",
        description="Leave empty to skip filtering.",
    )
```

**WHY**: Inputs without defaults are treated as required by the JSON Schema generator. If an input is truly optional, it MUST have a `default` value.

---

## C#-Specific Anti-Patterns

### 12. Blocking on Async Calls in C#

```csharp
// WRONG: Blocks the thread and can cause deadlocks
public async Task Run(IAutomationContext ctx, FunctionInputs inputs)
{
    var root = ctx.ReceiveVersion().Result;  // NEVER use .Result
}

// CORRECT: ALWAYS use await
public async Task Run(IAutomationContext ctx, FunctionInputs inputs)
{
    var root = await ctx.ReceiveVersion();
}
```

**WHY**: Using `.Result` or `.Wait()` on async calls blocks the current thread and can cause deadlocks in the async runtime. The C# Automate function is async by design — ALWAYS use `await`.

---

### 13. Forgetting DI Registration

```csharp
// WRONG: Missing AddAutomateSdk() — IAutomationRunner cannot be resolved
var serviceCollection = new ServiceCollection();
serviceCollection.AddSingleton<AutomateFunction>();
var serviceProvider = serviceCollection.BuildServiceProvider();
var runner = serviceProvider.GetRequiredService<IAutomationRunner>();  // throws

// CORRECT: ALWAYS call AddAutomateSdk() before resolving
var serviceCollection = new ServiceCollection();
serviceCollection.AddAutomateSdk();  // registers all SDK services
serviceCollection.AddSingleton<AutomateFunction>();
var serviceProvider = serviceCollection.BuildServiceProvider();
var runner = serviceProvider.GetRequiredService<IAutomationRunner>();  // works
```

**WHY**: `AddAutomateSdk()` registers `IAutomationRunner` and all required services. Without it, the DI container cannot resolve the runner and throws an `InvalidOperationException`.

---

### 14. Confusing Validation Failure with Code Error

```python
# WRONG: Marking success when the function actually crashed
def automate_function(automate_context, function_inputs):
    try:
        base = automate_context.receive_version()
        result = process(base)  # might throw
        automate_context.mark_run_success("Done.")
    except Exception:
        automate_context.mark_run_success("Done.")  # hides the error!

# CORRECT: Distinguish between "no issues found" and "function error"
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    try:
        result = process(base)
    except Exception as e:
        automate_context.mark_run_failed(f"Processing error: {e}")
        raise
    if result.has_issues:
        automate_context.mark_run_failed(f"{result.issue_count} issues found.")
    else:
        automate_context.mark_run_success("No issues found.")
```

**WHY**: `mark_run_success()` means the model passed validation. It does NOT mean the function ran without errors. ALWAYS use `mark_run_failed()` for both validation failures and code errors, and re-raise exceptions for proper logging.
