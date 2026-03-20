# Anti-Patterns (Speckle Automate)

## Function Design Anti-Patterns

### 1. Not Explicitly Setting Run Outcome

```python
# WRONG: No explicit outcome -- run status is ambiguous
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    objects = list(flatten_base(base))
    # ... processes objects but never calls mark_run_success or mark_run_failed

# CORRECT: ALWAYS explicitly set the outcome
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    objects = list(flatten_base(base))
    # ... processes objects ...
    automate_context.mark_run_success("Processed all objects.")
```

**WHY**: If neither `mark_run_success()` nor `mark_run_failed()` is called and no exception occurs, the run status is undefined. Users cannot determine whether the function completed successfully or silently failed.

---

### 2. Invoking the Function Instead of Passing a Reference

```python
# WRONG: Calling the function with parentheses
if __name__ == "__main__":
    execute_automate_function(automate_function(), FunctionInputs())

# CORRECT: Pass the function reference and class (no parentheses)
if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```

**WHY**: `execute_automate_function` expects a callable reference and a class type. Calling with parentheses invokes the function immediately (missing required arguments) and passes an instance instead of a class.

---

### 3. Using Plain Strings for Secrets

```python
# WRONG: API key exposed in logs and Speckle UI
class FunctionInputs(AutomateBase):
    api_key: str = Field(title="API Key")

# CORRECT: Use SecretStr to encrypt and hide the value
class FunctionInputs(AutomateBase):
    api_key: SecretStr = Field(title="API Key")
```

```csharp
// WRONG: Secret value visible in logs
public readonly struct FunctionInputs
{
    [Required]
    public string ApiKey { get; init; }
}

// CORRECT: Use [Secret] attribute
public readonly struct FunctionInputs
{
    [Required]
    [Secret]
    public string ApiKey { get; init; }
}
```

**WHY**: Without `SecretStr` (Python) or `[Secret]` (C#), sensitive values appear in plain text in logs, the Speckle UI, and error messages. This is a security vulnerability.

---

### 4. Attaching Errors with Empty Object ID Lists

```python
# WRONG: Empty list produces silent failure -- no annotations visible
automate_context.attach_error_to_objects(
    category="Compliance",
    object_ids=[],
    message="Some objects are non-compliant.",
)

# CORRECT: Only call when you have valid object IDs
if non_compliant_ids:
    automate_context.attach_error_to_objects(
        category="Compliance",
        object_ids=non_compliant_ids,
        message="Some objects are non-compliant.",
    )
```

**WHY**: Passing an empty list to `attach_error_to_objects()` does nothing visible. The error message exists in the run data but no objects are highlighted in the viewer. ALWAYS verify the list is non-empty before calling.

---

### 5. Loading Entire Model into Memory

```python
# WRONG: Materializes the entire object hierarchy at once
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    all_objects = list(flatten_base(base))  # entire model in memory
    # ... processes all_objects ...

# BETTER: Use generators and filter early
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    errors = []
    for obj in flatten_base(base):  # lazy iteration
        if obj.speckle_type == function_inputs.target_type:
            if not hasattr(obj, "name"):
                errors.append(obj.id)
    # Only the error IDs are in memory, not all objects
```

**WHY**: Large models can contain millions of objects. Calling `list()` on the full flatten generator loads everything into memory at once, potentially causing out-of-memory errors in the container.

---

### 6. Blocking on Async in C#

```csharp
// WRONG: .Result blocks the thread and can cause deadlocks
public async Task Run(IAutomationContext ctx, FunctionInputs inputs)
{
    var root = ctx.ReceiveVersion().Result;  // DEADLOCK RISK
}

// CORRECT: ALWAYS use await
public async Task Run(IAutomationContext ctx, FunctionInputs inputs)
{
    var root = await ctx.ReceiveVersion();
}
```

**WHY**: Using `.Result` or `.Wait()` on async methods blocks the calling thread and can cause deadlocks in the async runtime. The C# Automate SDK is fully async -- ALWAYS use `await`.

---

## Input Schema Anti-Patterns

### 7. Missing Field Metadata

```python
# WRONG: No title or description -- UI shows raw field name "fc"
class FunctionInputs(AutomateBase):
    fc: str

# CORRECT: ALWAYS add title and description
class FunctionInputs(AutomateBase):
    fc: str = Field(
        title="Filter Category",
        description="Only check objects in this Revit category",
    )
```

**WHY**: The Speckle UI auto-generates a form from the JSON Schema. Without `title` and `description`, users see cryptic field names and have no guidance on what values to enter.

---

### 8. Optional Inputs Without Defaults

```python
# WRONG: No default makes the field required in the UI
class FunctionInputs(AutomateBase):
    tolerance: float = Field(title="Tolerance")

# CORRECT: Provide a default for optional inputs
class FunctionInputs(AutomateBase):
    tolerance: float = Field(
        default=0.01,
        title="Tolerance",
        description="Acceptable deviation threshold",
    )
```

**WHY**: Pydantic treats fields without defaults as required. If the field is conceptually optional, users are forced to provide a value. ALWAYS set a sensible default for optional parameters.

---

### 9. Complex Nested Input Types

```python
# WRONG: Nested objects may not render correctly in Speckle UI
class FilterConfig(AutomateBase):
    categories: list[str]
    rules: dict[str, list[str]]

class FunctionInputs(AutomateBase):
    config: FilterConfig = Field(title="Configuration")

# CORRECT: Keep inputs flat and simple
class FunctionInputs(AutomateBase):
    categories: str = Field(
        title="Categories",
        description="Comma-separated list of categories to check",
    )
    rule_name: str = Field(
        title="Rule Name",
        description="Which validation rule to apply",
    )
```

**WHY**: The Speckle UI renders input schemas as simple forms. Deeply nested objects, lists of objects, and union types may not render correctly or may confuse users. Keep the schema flat.

---

## Deployment Anti-Patterns

### 10. Pushing Code Without Creating a Release

```
WRONG workflow:
  git push origin main  --> function does NOT appear in library

CORRECT workflow:
  git push origin main
  gh release create v1.0.0  --> function appears in library
```

**WHY**: Functions are published to the Function Library ONLY when a GitHub Release is created. The GitHub Actions workflow triggers on release events, not on push events. Pushing code alone does nothing.

---

### 11. Modifying Auto-Generated Workflow Variables

```yaml
# WRONG: Removing or renaming injected environment variables
env:
  MY_CUSTOM_ID: "..."  # replaced SPECKLE_FUNCTION_ID

# CORRECT: Keep the auto-generated variables intact
env:
  SPECKLE_FUNCTION_ID: ${{ secrets.SPECKLE_FUNCTION_ID }}
  SPECKLE_FUNCTION_TOKEN: ${{ secrets.SPECKLE_FUNCTION_TOKEN }}
```

**WHY**: The Speckle wizard injects `SPECKLE_FUNCTION_ID` and `SPECKLE_FUNCTION_TOKEN` into `.github/workflows/main.yml`. These are required for the GitHub Action to register the function version with Speckle. Removing or renaming them breaks the entire deployment pipeline.

---

## Error Handling Anti-Patterns

### 12. Silently Catching All Exceptions

```python
# WRONG: Broad catch hides real errors
def automate_function(automate_context, function_inputs):
    try:
        base = automate_context.receive_version()
        # ... logic ...
    except Exception:
        pass  # silently swallowed

# CORRECT: Log the error and mark the run as failed
def automate_function(automate_context, function_inputs):
    try:
        base = automate_context.receive_version()
        # ... logic ...
    except Exception as e:
        automate_context.mark_run_failed(f"Unexpected error: {e}")
        raise
```

**WHY**: A broad `except: pass` makes debugging impossible. The run appears to complete without error, but no meaningful result is produced. ALWAYS log exceptions and mark the run as failed, or re-raise to let the platform record the exception.

---

### 13. Confusing "No Issues" with "Function Error"

```python
# WRONG: Reports success when the function actually crashed
def automate_function(automate_context, function_inputs):
    try:
        base = automate_context.receive_version()
        # ... buggy logic that throws ...
    except Exception:
        automate_context.mark_run_success("Completed.")  # MISLEADING

# CORRECT: Only mark success when validation logic truly completed
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    issues = run_validation(base, function_inputs)
    if issues:
        automate_context.mark_run_failed(f"{len(issues)} issues found.")
    else:
        automate_context.mark_run_success("All checks passed.")
```

**WHY**: `mark_run_success()` means "the model passed validation." A function that crashes and then reports success gives users false confidence that their model is correct. ALWAYS distinguish between "validation passed" and "function error."

---

### 14. Not Handling Empty Models

```python
# WRONG: Assumes the model always has elements
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    first_element = base.elements[0]  # AttributeError if no elements

# CORRECT: Check for None/empty before accessing
def automate_function(automate_context, function_inputs):
    base = automate_context.receive_version()
    elements = getattr(base, "elements", None)
    if not elements:
        automate_context.mark_run_success("No elements to check.")
        return
    # ... process elements ...
```

**WHY**: A version might contain an empty or minimal Base object with no `elements` property. Accessing properties without checking causes `AttributeError` or `NoneType` errors, crashing the function instead of producing a meaningful result.
