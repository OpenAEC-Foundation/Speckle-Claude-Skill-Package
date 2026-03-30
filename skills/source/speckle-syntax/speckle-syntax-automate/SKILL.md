---
name: speckle-syntax-automate
description: >
  Use when writing Speckle Automate functions, defining function inputs, or using the AutomationContext API.
  Prevents incorrect input schema definition, missing error reporting, and broken function registration.
  Covers Automate function structure, FunctionInputs (Pydantic/DataAnnotations), AutomationContext API (receive_version, attach_error_to_objects, mark_run_failed/success, store_file_result, set_context_view), and execute_automate_function.
  Keywords: speckle automate, automation context, function inputs, automate function, mark_run_failed, attach_error, store_file_result, write automate function, handle errors.
license: MIT
compatibility: "Designed for Claude Code. Requires Speckle Server 2.x/3.x, SpecklePy, Speckle.Sdk."
metadata:
  author: OpenAEC-Foundation
  version: "1.0"
---

# speckle-syntax-automate

## Quick Reference

### Architecture: Functions vs Automations

| Concept | What It Is | Created By | Scope |
|---------|-----------|------------|-------|
| Function | Reusable code template (GitHub repo) | Developer | Global -- listed in Function Library |
| Automation | Configured instance of a Function | Project owner / admin | Bound to one project + model |

One Function can be deployed as many Automations across different projects, each with different input configurations.

### Trigger Mechanism

The ONLY trigger is **version creation** -- when a new version (commit) is published to a model. There is NO manual trigger, NO scheduled trigger, and NO webhook-based trigger for Automate functions.

### Execution Flow

```
1. User publishes new version to a model
2. Speckle Server detects version creation event
3. Server finds all Automations bound to that model
4. For each Automation, Speckle spins up a Docker container
5. Function code executes with AutomationContext
6. Results (pass/fail, annotations, files) attach to the version
7. Results visible in web interface and 3D viewer
```

### SDK Packages

| Language | Package | Target |
|----------|---------|--------|
| Python | `specklepy` (includes `speckle_automate`) | Python 3.10+ |
| C# | `Speckle.Automate.Sdk` (NuGet) | .NET 8.0 |

### Three Outcome States

| State | Cause | Meaning |
|-------|-------|---------|
| Success | `mark_run_success()` called | Model meets all criteria |
| Failed | `mark_run_failed()` called | Model does NOT meet criteria (intentional) |
| Exception | Unhandled exception thrown | Code error or platform error |

### Critical Warnings

**ALWAYS** explicitly call `mark_run_success()` or `mark_run_failed()` before the function returns. If neither is called and no exception occurs, the run status is ambiguous.

**NEVER** pass `execute_automate_function` a function invocation -- pass the function reference WITHOUT parentheses and the FunctionInputs CLASS (not an instance).

**NEVER** use plain `str` for sensitive inputs (API keys, tokens). ALWAYS use `SecretStr` (Python) or `[Secret]` attribute (C#) to prevent exposure in logs and UI.

**NEVER** pass an empty list to `attach_error_to_objects()` -- it produces silent failures with no visible annotations. ALWAYS verify the list contains valid object IDs before calling.

**NEVER** use `.Result` or `.Wait()` in C# Automate functions -- the function is async. ALWAYS use `await` for all async operations.

**NEVER** use complex nested types in FunctionInputs -- the Speckle UI renders inputs as a flat form. Keep inputs as simple scalar types (str, int, float, bool).

---

## Python: Function Structure

### Entry Point Pattern

Every Python Automate function MUST follow this exact structure:

```python
from speckle_automate import (
    AutomateBase,
    AutomationContext,
    execute_automate_function,
)
from pydantic import Field, SecretStr


class FunctionInputs(AutomateBase):
    """Define inputs with Pydantic Field() -- generates the UI form."""
    param_name: str = Field(title="Human Title", description="Explanation")


def automate_function(
    automate_context: AutomationContext,
    function_inputs: FunctionInputs,
) -> None:
    # 1. Receive the version data
    base = automate_context.receive_version()

    # 2. Process/validate the data
    # ... your logic here ...

    # 3. Report results
    automate_context.mark_run_success("All checks passed.")


# Entry point -- MUST be at module level
if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```

### FunctionInputs (Python -- Pydantic)

`AutomateBase` inherits from Pydantic's `BaseModel`. All Pydantic features work:

```python
class FunctionInputs(AutomateBase):
    # Required string
    category_filter: str = Field(
        title="Category Filter",
        description="Only check objects in this category"
    )

    # Numeric with constraints and default
    max_count: int = Field(
        default=100,
        title="Maximum Object Count",
        ge=1, le=10000
    )

    # Secret value (encrypted, hidden in logs/UI)
    api_key: SecretStr = Field(title="External API Key")

    # Boolean toggle with default
    strict_mode: bool = Field(
        default=False,
        title="Strict Mode",
        description="Fail on warnings too"
    )
```

Rules:
- **ALWAYS** add `title` and `description` to every Field -- without them the Speckle UI shows raw field names
- **ALWAYS** provide `default` values for optional inputs -- inputs without defaults are treated as required
- **ALWAYS** use `SecretStr` for sensitive values (API keys, tokens, credentials)
- The JSON Schema is auto-generated from the class and rendered as a form in Speckle

### AutomationContext API (Python)

| Method | Signature | Purpose |
|--------|-----------|---------|
| `receive_version()` | `() -> Base` | Retrieve the root Base object for the triggering version |
| `attach_error_to_objects()` | `(category: str, object_ids: List[str], message: str) -> None` | Attach error annotations visible in the 3D viewer |
| `attach_info_to_objects()` | `(category: str, object_ids: List[str], message: str) -> None` | Attach informational annotations (non-error) |
| `mark_run_failed()` | `(message: str) -> None` | Mark run as intentionally failed |
| `mark_run_success()` | `(message: str) -> None` | Mark run as successful |
| `store_file_result()` | `(file_path: str) -> None` | Upload a file artifact to the run results |
| `set_context_view()` | `() -> None` | Configure 3D viewer URL for the run result |

### Object Traversal Pattern

Flatten the received object hierarchy to inspect individual objects:

```python
from specklepy.objects import Base
from typing import Iterable


def flatten_base(base: Base) -> Iterable[Base]:
    """Recursively flatten a Base object hierarchy."""
    elements = getattr(base, "elements", getattr(base, "@elements", None))
    if elements is not None:
        for element in elements:
            yield from flatten_base(element)
    yield base
```

This function:
- Uses `getattr` with fallback to handle both `elements` and `@elements` naming
- Yields descendants before the parent (depth-first, bottom-up)
- Returns `Iterable[Base]` for lazy evaluation (memory-efficient for large models)
- Is included in the official Python template as `flatten.py`

---

## C#: Function Structure

### Project Setup

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="8.0.1" />
    <PackageReference Include="Speckle.Automate.Sdk" Version="3.4.0-alpha.20" />
  </ItemGroup>
</Project>
```

### Entry Point (Program.cs)

```csharp
using Microsoft.Extensions.DependencyInjection;
using Speckle.Automate.Sdk;

var serviceCollection = new ServiceCollection();
serviceCollection.AddAutomateSdk();
serviceCollection.AddSingleton<AutomateFunction>();
var serviceProvider = serviceCollection.BuildServiceProvider();

var runner = serviceProvider.GetRequiredService<IAutomationRunner>();
var function = serviceProvider.GetRequiredService<AutomateFunction>();

return await runner.Main<FunctionInputs>(args, function.Run);
```

The `runner.Main<FunctionInputs>()` call:
1. Parses command-line arguments
2. Deserializes function inputs as `FunctionInputs`
3. Creates the `IAutomationContext`
4. Invokes `function.Run` with both

### FunctionInputs (C# -- DataAnnotations)

```csharp
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

public readonly struct FunctionInputs
{
    [Required]
    public string SpeckleTypeToCount { get; init; }

    [DefaultValue(10)]
    [Range(1, 100)]
    [Required]
    public int SpeckleTypeTargetCount { get; init; }

    [Required]
    [Secret]
    public string ExternalServiceKey { get; init; }
}
```

Rules:
- **ALWAYS** use `readonly struct` for immutability
- **ALWAYS** use `System.ComponentModel.DataAnnotations` attributes for validation
- **ALWAYS** use `[Secret]` attribute for sensitive values (NOT `SecretStr`)
- **ALWAYS** use `{ get; init; }` properties

### AutomateFunction Class

```csharp
using Speckle.Automate.Sdk;
using Speckle.Sdk.Models.Extensions;

public class AutomateFunction
{
    public async Task Run(
        IAutomationContext automationContext,
        FunctionInputs functionInputs
    )
    {
        var rootObject = await automationContext.ReceiveVersion();
        var allObjects = rootObject.Flatten().ToList();

        // ... validation logic ...

        automationContext.MarkRunSuccess("All checks passed.");
    }
}
```

### IAutomationContext API (C#)

| Method | Signature | Purpose |
|--------|-----------|---------|
| `ReceiveVersion()` | `async Task<Base>` | Retrieve the root Base object |
| `AttachErrorToObjects()` | `(string category, IList<string> objectIds, string message)` | Attach error annotations |
| `MarkRunFailed()` | `(string message)` | Mark run as intentionally failed |
| `MarkRunSuccess()` | `(string message)` | Mark run as successful |
| `StoreFileResult()` | `(string filePath)` | Upload a file artifact |
| `SetContextView()` | `()` | Configure viewer context |

---

## Python vs C# Comparison

| Aspect | Python | C# |
|--------|--------|-----|
| Input base class | `AutomateBase` (Pydantic `BaseModel`) | `readonly struct` with DataAnnotations |
| Secret fields | `SecretStr` | `[Secret]` attribute |
| Context type | `AutomationContext` (concrete class) | `IAutomationContext` (interface) |
| Entry point | `execute_automate_function(fn, InputsClass)` | DI container + `IAutomationRunner.Main<T>()` |
| Object flattening | Manual `flatten_base()` generator | `Flatten()` extension method |
| Async model | Synchronous | Full async/await |
| Package | `specklepy` (includes automate) | `Speckle.Automate.Sdk` (separate NuGet) |
| Target runtime | Python 3.10+ | .NET 8.0 |

---

## Deployment Workflow

```
1. Create function via Speckle wizard (Automations tab)
2. Template repo cloned to your GitHub account
3. Modify function code locally
4. Push changes to GitHub
5. Create a GitHub Release
6. GitHub Actions builds Docker image and registers function
7. Function appears in Function Library
8. Users create Automations from the function
```

**ALWAYS** create a GitHub Release to publish -- pushing code alone does NOT make the function appear in the Function Library.

**NEVER** modify or remove `SPECKLE_FUNCTION_ID` and `SPECKLE_FUNCTION_TOKEN` environment variables in the auto-generated `.github/workflows/main.yml` -- removing them breaks the deployment pipeline.

---

## Reference Links

- [references/methods.md](references/methods.md) -- Complete API signatures for AutomationContext (Python) and IAutomationContext (C#)
- [references/examples.md](references/examples.md) -- Working code examples for both Python and C#
- [references/anti-patterns.md](references/anti-patterns.md) -- Common mistakes with explanations

### Official Sources

- https://docs.speckle.systems/developers/automate/introduction
- https://docs.speckle.systems/developers/automate/quickstart
- https://docs.speckle.systems/developers/automate/create-function
- https://github.com/specklesystems/speckle_automate_python_example
- https://github.com/specklesystems/SpeckleAutomateDotnetExample
