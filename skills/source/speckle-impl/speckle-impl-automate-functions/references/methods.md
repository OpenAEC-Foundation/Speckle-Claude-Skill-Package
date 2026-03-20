# API Signatures Reference (Speckle Automate)

## Python: AutomationContext

The `AutomationContext` object is injected into every Automate function execution. It is the primary API surface for interacting with the Automate platform.

```python
class AutomationContext:
    def receive_version(self) -> Base
        """Retrieve the root Base object for the version that triggered
        the automation. Returns the fully deserialized object hierarchy."""

    def attach_error_to_objects(
        self,
        category: str,
        object_ids: List[str],
        message: str,
    ) -> None
        """Attach error annotations to specific objects in the model.
        Errors are visible in the 3D viewer and grouped by category.
        NEVER pass an empty list for object_ids."""

    def mark_run_success(self, message: str) -> None
        """Explicitly mark the automation run as successful.
        The message appears in the run report."""

    def mark_run_failed(self, message: str) -> None
        """Explicitly mark the automation run as failed.
        Use for intentional validation failures, NOT code errors."""

    def store_file_result(self, file_path: str) -> None
        """Attach a file artifact to the run results.
        The file is uploaded and stored alongside the run."""

    def set_context_view(self) -> None
        """Configure the 3D viewer URL so clicking on the run result
        navigates to the relevant model view."""
```

---

## Python: AutomateBase

Base class for function inputs. Extends Pydantic's `BaseModel`.

```python
from speckle_automate import AutomateBase
from pydantic import Field, SecretStr

class AutomateBase(BaseModel):
    """Base class for Automate function inputs.
    All fields support Pydantic validation.
    JSON Schema is auto-generated from the class definition."""
    pass
```

### Field Types

| Python Type | Speckle UI Rendering | Notes |
|-------------|---------------------|-------|
| `str` | Text input | ALWAYS add `title` and `description` via `Field()` |
| `int` | Number input | Use `ge`, `le`, `gt`, `lt` for constraints |
| `float` | Number input | Use `ge`, `le`, `gt`, `lt` for constraints |
| `bool` | Checkbox / toggle | ALWAYS provide `default` value |
| `SecretStr` | Password input | Value encrypted, NEVER shown in logs |
| `Optional[T]` | Optional field | ALWAYS provide `default=None` |

### Field() Parameters

```python
from pydantic import Field

Field(
    default=...,          # Default value (omit for required fields)
    title="...",          # Human-readable label in Speckle UI
    description="...",    # Help text shown below the input
    ge=0,                 # Greater than or equal (numbers)
    le=100,               # Less than or equal (numbers)
    min_length=1,         # Minimum string length
    max_length=255,       # Maximum string length
)
```

---

## Python: execute_automate_function

```python
from speckle_automate import execute_automate_function

def execute_automate_function(
    automate_function: Callable[[AutomationContext, T], None],
    inputs_class: Type[T],
) -> None
    """Bootstrap the Automate function execution.

    Parameters:
        automate_function: Reference to the function (NO parentheses).
        inputs_class: The FunctionInputs CLASS (NOT an instance).

    The runtime handles:
        - Command-line argument parsing
        - Input deserialization and validation
        - AutomationContext creation
        - Function invocation
        - Exception handling and reporting
    """
```

---

## Python: flatten_base

```python
from specklepy.objects import Base
from typing import Iterable

def flatten_base(base: Base) -> Iterable[Base]:
    """Recursively flatten a Base object hierarchy.

    Traversal: depth-first, bottom-up (descendants before parent).
    Memory: lazy via generator — efficient for large models.

    Handles both 'elements' and '@elements' attribute names
    via getattr fallback chain.
    """
```

---

## C#: IAutomationContext

The C# SDK uses an interface for the automation context, following dependency injection patterns.

```csharp
public interface IAutomationContext
{
    /// <summary>
    /// Retrieve the root Base object for the triggering version.
    /// ALWAYS await this call.
    /// </summary>
    Task<Base> ReceiveVersion();

    /// <summary>
    /// Attach error annotations to specific objects.
    /// NEVER pass an empty list for objectIds.
    /// </summary>
    void AttachErrorToObjects(
        string category,
        IList<string> objectIds,
        string message);

    /// <summary>
    /// Mark the run as successful with a message.
    /// </summary>
    void MarkRunSuccess(string message);

    /// <summary>
    /// Mark the run as intentionally failed with a message.
    /// </summary>
    void MarkRunFailed(string message);

    /// <summary>
    /// Upload a file artifact attached to the run results.
    /// </summary>
    void StoreFileResult(string filePath);

    /// <summary>
    /// Configure the 3D viewer URL for the run result.
    /// </summary>
    void SetContextView();
}
```

---

## C#: IAutomationRunner

```csharp
public interface IAutomationRunner
{
    /// <summary>
    /// Main entry point for the Automate function.
    /// Parses args, deserializes inputs, creates context, invokes function.
    /// </summary>
    /// <typeparam name="T">The FunctionInputs type.</typeparam>
    /// <param name="args">Command-line arguments.</param>
    /// <param name="function">The function delegate to execute.</param>
    /// <returns>Exit code (0 = success).</returns>
    Task<int> Main<T>(string[] args, Func<IAutomationContext, T, Task> function);
}
```

---

## C#: AddAutomateSdk Extension

```csharp
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register all Speckle Automate SDK services into the DI container.
    /// ALWAYS call this before resolving IAutomationRunner.
    /// </summary>
    public static IServiceCollection AddAutomateSdk(
        this IServiceCollection services);
}
```

---

## C#: Flatten Extension Method

```csharp
using Speckle.Sdk.Models.Extensions;

public static class BaseExtensions
{
    /// <summary>
    /// Flatten the entire Base object hierarchy into a flat enumerable.
    /// Replaces the manual flatten_base() pattern from Python.
    /// </summary>
    public static IEnumerable<Base> Flatten(this Base root);
}
```

---

## C#: FunctionInputs Attributes

| Attribute | Namespace | Purpose |
|-----------|-----------|---------|
| `[Required]` | `System.ComponentModel.DataAnnotations` | Mark field as mandatory |
| `[DefaultValue(value)]` | `System.ComponentModel` | Set default value |
| `[Range(min, max)]` | `System.ComponentModel.DataAnnotations` | Numeric range constraint |
| `[Secret]` | `Speckle.Automate.Sdk` | Encrypt value, hide from logs |
| `[StringLength(max)]` | `System.ComponentModel.DataAnnotations` | String length constraint |

---

## GitHub Actions: speckle-automate-github-action

The composite action handles building, publishing, and registering Docker images.

### Required Secrets

| Secret | Source | Purpose |
|--------|--------|---------|
| `SPECKLE_FUNCTION_ID` | Injected by wizard | Function identifier in Speckle registry |
| `SPECKLE_FUNCTION_TOKEN` | Injected by wizard | Authentication token for publishing |

### Trigger

The workflow triggers on GitHub release creation (`on: release`). NEVER change this trigger without understanding the full deployment pipeline.
