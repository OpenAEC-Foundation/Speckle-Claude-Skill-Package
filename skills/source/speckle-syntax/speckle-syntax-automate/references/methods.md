# API Signatures Reference (Speckle Automate)

## Python: AutomationContext

The `AutomationContext` object is injected into every Automate function call. It is the primary API surface for interacting with the platform.

```python
class AutomationContext:
    def receive_version(self) -> Base:
        """Retrieve the root Base object for the version that triggered this automation.
        Returns the fully deserialized object hierarchy."""

    def attach_error_to_objects(
        self,
        category: str,
        object_ids: list[str],
        message: str,
    ) -> None:
        """Attach error annotations to specific objects.
        - category: grouping label (e.g., "Compliance", "Geometry")
        - object_ids: list of Speckle object IDs to annotate
        - message: human-readable error description
        Errors are visible in the 3D viewer as highlighted objects."""

    def attach_info_to_objects(
        self,
        category: str,
        object_ids: list[str],
        message: str,
    ) -> None:
        """Attach informational (non-error) annotations to specific objects.
        Same parameters as attach_error_to_objects but does NOT indicate failure."""

    def mark_run_failed(self, message: str) -> None:
        """Mark the automation run as intentionally failed.
        Use when model does NOT meet required criteria.
        The message is displayed in the run report."""

    def mark_run_success(self, message: str) -> None:
        """Mark the automation run as successful.
        Use when model meets all required criteria.
        The message is displayed in the run report."""

    def store_file_result(self, file_path: str) -> None:
        """Upload a file artifact to the automation run results.
        The file is stored alongside run results and downloadable from the run card.
        Common uses: PDF reports, CSV exports, log files, images."""

    def set_context_view(self) -> None:
        """Configure the 3D viewer URL so clicking the run result
        navigates to the relevant model view."""
```

---

## Python: AutomateBase

Base class for function inputs. Inherits from Pydantic `BaseModel`.

```python
from speckle_automate import AutomateBase

class AutomateBase(BaseModel):
    """Base class for Automate function inputs.
    Inherits all Pydantic BaseModel functionality:
    - Type validation and coercion
    - Field constraints (ge, le, min_length, max_length, regex)
    - Default values
    - JSON Schema generation (used by Speckle UI)
    """
```

---

## Python: execute_automate_function

Entry point that bootstraps the function execution.

```python
def execute_automate_function(
    automate_function: Callable[[AutomationContext, T], None],
    inputs_type: Type[T],
) -> None:
    """Bootstrap and run the Automate function.

    Parameters:
    - automate_function: reference to the function (NO parentheses)
    - inputs_type: the FunctionInputs CLASS (NOT an instance)

    The runtime handles:
    - Parsing command-line arguments
    - Deserializing function inputs
    - Creating the AutomationContext
    - Invoking the function with both parameters
    """
```

---

## Python: flatten_base utility

```python
def flatten_base(base: Base) -> Iterable[Base]:
    """Recursively flatten a Base object hierarchy.

    Traversal: depth-first, bottom-up (children before parent).
    Uses getattr with fallback: checks 'elements' then '@elements'.
    Returns Iterable[Base] for lazy evaluation.

    Parameters:
    - base: root Base object (typically from receive_version())

    Yields:
    - Every Base object in the hierarchy
    """
```

---

## C#: IAutomationContext

The C# SDK uses an interface (following dependency injection patterns).

```csharp
public interface IAutomationContext
{
    /// <summary>
    /// Retrieve the root Base object for the triggering version.
    /// Async -- ALWAYS await this call.
    /// </summary>
    Task<Base> ReceiveVersion();

    /// <summary>
    /// Attach error annotations to specific objects in the model.
    /// Errors are visible as highlighted objects in the 3D viewer.
    /// </summary>
    /// <param name="category">Grouping label for the error</param>
    /// <param name="objectIds">List of Speckle object IDs</param>
    /// <param name="message">Human-readable error description</param>
    void AttachErrorToObjects(string category, IList<string> objectIds, string message);

    /// <summary>
    /// Mark the automation run as intentionally failed.
    /// </summary>
    /// <param name="message">Displayed in the run report</param>
    void MarkRunFailed(string message);

    /// <summary>
    /// Mark the automation run as successful.
    /// </summary>
    /// <param name="message">Displayed in the run report</param>
    void MarkRunSuccess(string message);

    /// <summary>
    /// Upload a file artifact to the run results.
    /// </summary>
    /// <param name="filePath">Path to the file to upload</param>
    void StoreFileResult(string filePath);

    /// <summary>
    /// Configure the viewer context for the run result.
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
    /// Parses args, deserializes inputs, creates context, invokes the function.
    /// </summary>
    /// <typeparam name="T">The FunctionInputs type</typeparam>
    /// <param name="args">Command-line arguments</param>
    /// <param name="function">The function delegate to execute</param>
    Task<int> Main<T>(string[] args, Func<IAutomationContext, T, Task> function);
}
```

---

## C#: DI Extension Methods

```csharp
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register all Speckle Automate SDK services in the DI container.
    /// MUST be called before resolving IAutomationRunner.
    /// </summary>
    public static IServiceCollection AddAutomateSdk(this IServiceCollection services);
}
```

---

## C#: Base Extension Methods

```csharp
namespace Speckle.Sdk.Models.Extensions
{
    public static class BaseExtensions
    {
        /// <summary>
        /// Flatten a Base object hierarchy into a flat enumerable.
        /// Equivalent to Python's flatten_base() utility.
        /// </summary>
        public static IEnumerable<Base> Flatten(this Base root);
    }
}
```
