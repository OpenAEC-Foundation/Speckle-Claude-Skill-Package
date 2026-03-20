# Vooronderzoek: Speckle Automate

> Status: RAW — not yet processed into core files
> Date: 2026-03-20
> Sources: Official Speckle documentation, GitHub template repositories, NuGet packages

---

## 1. What is Speckle Automate

Speckle Automate is a fully-fledged CI/CD platform designed to run custom code on Speckle models whenever a new version is published. It automates model intelligence and data workflows without requiring users to manage their own servers or infrastructure.

**Key characteristics:**
- Serverless: functions run on Speckle's hosted infrastructure, not on user machines
- Event-driven: triggered automatically by version creation events
- Language-agnostic: primarily supports Python and C#, with JavaScript/TypeScript in development
- GitHub-integrated: function code lives in GitHub repositories, deployed via GitHub Actions
- Enterprise-only: currently available only on Enterprise plans on app.speckle.systems

Automate is NOT open-source and NOT self-installable. It is a managed service integrated into the Speckle web application, operating as a separate service dependent on a Speckle Server instance.

---

## 2. Architecture: Functions vs Automations

Speckle Automate distinguishes between two core concepts:

### 2.1 Functions

A **Function** is a discrete unit of code that defines specific execution logic. Functions are:
- Created by developers
- Stored in GitHub repositories
- Built and published via GitHub Actions
- Listed in the Function Library after their first GitHub release
- Reusable across multiple automations and projects

A function is analogous to a "class" or "template" — it defines what CAN be done, not when or where it will be done.

### 2.2 Automations

An **Automation** is a deployed, configured instance of a Function. Automations are:
- Created by project owners or workspace admins
- Bound to a specific project and model
- Configured with specific input parameters
- Triggered automatically when new versions are published to the bound model

An automation is analogous to an "instance" — it specifies when, where, and with what parameters a function will execute.

### 2.3 Relationship

```
Function (code template)
    └── Automation 1 (Project A, Model X, inputs: {...})
    └── Automation 2 (Project B, Model Y, inputs: {...})
    └── Automation 3 (Project A, Model Z, inputs: {...})
```

One function can be deployed as many automations across different projects and models, each with different input configurations.

---

## 3. Trigger Mechanism

The primary (and currently only) trigger for Automate functions is **version creation** — when a new version (commit) is published to a model within a project. The trigger flow is:

1. User publishes a new version to a model (via connector, SDK, or web interface)
2. Speckle Server detects the new version event
3. Server checks all automations bound to that model
4. For each matching automation, Speckle spins up a container
5. The function code executes with access to the new version data
6. Results (pass/fail, error annotations, files) are attached to the version
7. Results are visible in the Speckle web interface and 3D viewer

There is no manual trigger, no scheduled trigger, and no webhook-based trigger for Automate functions (though webhooks exist as a separate Speckle feature for external automation orchestration).

---

## 4. Python SDK: speckle-automate

The Python Automate SDK is bundled within `specklepy` (version 3.1.0+). It provides the classes and entry point needed to write Automate functions.

### 4.1 Core Classes

**AutomateBase** — the base class for function inputs, extending Pydantic's BaseModel:

```python
from pydantic import Field, SecretStr
from speckle_automate import AutomateBase

class FunctionInputs(AutomateBase):
    forbidden_speckle_type: str = Field(
        title="Forbidden speckle type",
        description="If an object has this speckle_type, it will be marked with an error."
    )
    whisper_message: SecretStr = Field(
        title="This is a secret message"
    )
```

`AutomateBase` inherits from Pydantic's `BaseModel`, which means:
- All fields support Pydantic validation (type checking, constraints, defaults)
- `SecretStr` fields are encrypted and not exposed in logs
- `Field()` metadata (title, description) generates the input schema displayed in the Speckle UI
- The JSON Schema is automatically generated from the class definition

**AutomationContext** — the runtime context provided to every function execution. This is the primary API surface for interacting with the Automate platform.

**execute_automate_function** — the entry point function that bootstraps the function execution.

### 4.2 AutomationContext Methods (Python)

The `AutomationContext` object is injected into every function call and provides the following methods:

#### receive_version()

```python
base_object = automate_context.receive_version()
```

Retrieves the Speckle Base object for the version that triggered the automation. Returns the root `Base` object with all nested children deserialized. This is the primary way to access model data within an Automate function.

#### attach_error_to_objects()

```python
automate_context.attach_error_to_objects(
    category="Compliance",
    object_ids=["id1", "id2", "id3"],
    message="These objects violate the naming convention."
)
```

Attaches error annotations to specific objects in the model. These errors are:
- Visible in the Speckle 3D viewer as highlighted objects
- Listed in the automation run report
- Filterable by category

Parameters:
- `category: str` — a grouping label for the error (e.g., "Compliance", "Geometry", "Naming")
- `object_ids: List[str]` — list of Speckle object IDs to annotate
- `message: str` — human-readable error description

#### mark_run_failed()

```python
automate_context.mark_run_failed("3 objects failed compliance check.")
```

Marks the automation run as intentionally failed. Use this when the function logic determines that the model does not meet the required criteria. The message is displayed in the run report.

#### mark_run_success()

```python
automate_context.mark_run_success("All objects passed compliance check.")
```

Marks the automation run as successful. The message is displayed in the run report. If neither `mark_run_failed` nor `mark_run_success` is called, the run status depends on whether an unhandled exception occurred.

#### store_file_result()

```python
automate_context.store_file_result("report.pdf")
```

Attaches a file artifact to the automation run. The file is uploaded and stored alongside the run results. Use this for generated reports, exported data, logs, or any file output.

#### set_context_view()

```python
automate_context.set_context_view()
```

Sets the viewer context to display the original model view associated with the automation run. This configures the 3D viewer URL so that clicking on the run result navigates to the relevant model view.

### 4.3 Entry Point Pattern

Every Python Automate function follows this exact pattern:

```python
from speckle_automate import (
    AutomateBase,
    AutomationContext,
    execute_automate_function,
)

class FunctionInputs(AutomateBase):
    # Define inputs with Pydantic Field()
    param_name: str = Field(title="...", description="...")

def automate_function(
    automate_context: AutomationContext,
    function_inputs: FunctionInputs,
) -> None:
    # 1. Receive the version data
    base = automate_context.receive_version()

    # 2. Process/validate the data
    # ... your logic here ...

    # 3. Report results
    automate_context.mark_run_success("Done.")

# Entry point — MUST be at module level
if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```

**CRITICAL:** The `execute_automate_function` call passes the function reference WITHOUT invocation (no parentheses). It also passes the FunctionInputs CLASS (not an instance). The Automate runtime handles instantiation, argument parsing, and injection.

### 4.4 Object Traversal in Automate Functions

A common pattern is flattening the received object hierarchy to inspect individual objects:

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
- Returns an `Iterable[Base]` for lazy evaluation (memory-efficient for large models)
- Is included in the official Python template as `flatten.py`

### 4.5 Complete Python Example

From the official template repository (`speckle_automate_python_example`):

```python
from pydantic import Field, SecretStr
from speckle_automate import (
    AutomateBase,
    AutomationContext,
    execute_automate_function,
)
from flatten import flatten_base

class FunctionInputs(AutomateBase):
    whisper_message: SecretStr = Field(title="This is a secret message")
    forbidden_speckle_type: str = Field(
        title="Forbidden speckle type",
        description=(
            "If an object has the following speckle_type,"
            " it will be marked with an error."
        ),
    )

def automate_function(
    automate_context: AutomationContext,
    function_inputs: FunctionInputs,
) -> None:
    base = automate_context.receive_version()

    # Flatten and filter objects
    objects = list(flatten_base(base))
    forbidden = [
        obj for obj in objects
        if obj.speckle_type == function_inputs.forbidden_speckle_type
    ]

    if forbidden:
        automate_context.attach_error_to_objects(
            category="Forbidden Type",
            object_ids=[obj.id for obj in forbidden],
            message=f"Found {len(forbidden)} objects of forbidden type."
        )
        automate_context.mark_run_failed(
            f"{len(forbidden)} objects of forbidden type found."
        )
    else:
        automate_context.set_context_view()
        automate_context.mark_run_success("No forbidden objects found.")

if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```

---

## 5. C# SDK: Speckle.Automate.Sdk

The C# Automate SDK is distributed as the NuGet package `Speckle.Automate.Sdk` (current version: 3.4.0-alpha.20). It targets .NET 8.0.

### 5.1 Project Setup

**.csproj configuration:**
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

The C# SDK uses Microsoft.Extensions.DependencyInjection for service registration and resolution.

### 5.2 FunctionInputs

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

Key differences from Python:
- Uses `readonly struct` for immutability (not a class)
- Validation uses `System.ComponentModel.DataAnnotations` attributes (`[Required]`, `[Range]`, `[DefaultValue]`)
- Secret values use `[Secret]` attribute (not `SecretStr`)
- JSON Schema is generated from the struct definition and its attributes

### 5.3 AutomateFunction Class

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
        // 1. Receive the version data
        var rootObject = await automationContext.ReceiveVersion();

        // 2. Process the data
        var allObjects = rootObject.Flatten().ToList();
        var matchingObjects = allObjects
            .Where(o => o.speckle_type == functionInputs.SpeckleTypeToCount)
            .ToList();

        // 3. Report results
        if (matchingObjects.Count != functionInputs.SpeckleTypeTargetCount)
        {
            automationContext.MarkRunFailed(
                $"Expected {functionInputs.SpeckleTypeTargetCount} but found {matchingObjects.Count}"
            );
        }
        else
        {
            automationContext.MarkRunSuccess(
                $"Found exactly {matchingObjects.Count} matching objects."
            );
        }
    }
}
```

**IAutomationContext interface methods (C#):**
- `ReceiveVersion()` — async, returns the root `Base` object
- `MarkRunSuccess(string message)` — marks the run as successful
- `MarkRunFailed(string message)` — marks the run as failed
- `AttachErrorToObjects(string category, IList<string> objectIds, string message)` — attaches error annotations
- `StoreFileResult(string filePath)` — uploads a file artifact
- `SetContextView()` — configures the viewer context

Note: The C# SDK uses `IAutomationContext` (interface) rather than a concrete class, following dependency injection patterns.

### 5.4 Entry Point (Program.cs)

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

The entry point:
1. Creates a DI container with `AddAutomateSdk()` extension method
2. Registers the user's `AutomateFunction` as a singleton
3. Resolves `IAutomationRunner` and the function from the container
4. Calls `runner.Main<FunctionInputs>(args, function.Run)` which:
   - Parses command-line arguments
   - Deserializes function inputs as `FunctionInputs`
   - Creates the `IAutomationContext`
   - Invokes `function.Run` with both

**CRITICAL:** The `runner.Main()` call is essential. Removing it prevents the automation from executing. The generic type parameter `FunctionInputs` tells the runner how to deserialize the input schema.

### 5.5 Key Differences: Python vs C#

| Aspect | Python | C# |
|---|---|---|
| Input class | `AutomateBase` (Pydantic) | `readonly struct` with DataAnnotations |
| Secret fields | `SecretStr` | `[Secret]` attribute |
| Context type | `AutomationContext` (concrete) | `IAutomationContext` (interface) |
| Entry point | `execute_automate_function()` | DI container + `IAutomationRunner.Main()` |
| Object flattening | Manual `flatten_base()` function | `Flatten()` extension method |
| Async pattern | Synchronous (Python GIL) | Full async/await |
| Package | `specklepy` (includes automate) | `Speckle.Automate.Sdk` (separate NuGet) |
| Target framework | Python 3.10+ | .NET 8.0 |

---

## 6. Function Development Workflow

### 6.1 Creation via Wizard

1. Navigate to the Automations tab in a Speckle Enterprise project
2. Click "View Functions" then "New Function"
3. Authorize GitHub OAuth (first time only; appears as "Authorized OAuth Apps" in GitHub settings)
4. Select template: Python or C#
5. Configure metadata:
   - **Name** (required) — descriptive identifier, does NOT need to be unique
   - **Description** (required) — Markdown-supported text
   - **Avatar/Logo** (optional) — displayed in function listings
   - **Source Application** (optional) — target application compatibility
   - **Tags** (optional) — categorical identifiers (e.g., "Solar_Panels", "Compliance")
   - **GitHub Organization** — personal or organizational account
6. Wizard automatically:
   - Clones the template into your GitHub repositories
   - Creates `.github/workflows/main.yml` for build and deployment
   - Injects environment variables: `SPECKLE_FUNCTION_ID` and `SPECKLE_FUNCTION_TOKEN`

### 6.2 GitHub Actions CI/CD

The auto-generated workflow (`.github/workflows/main.yml`) handles:
- Building the function (pip install / dotnet build)
- Creating a Docker container image
- Publishing the container to the Speckle registry
- Registering the function version with Speckle Automate

The workflow is triggered on GitHub release creation. Making the first release on GitHub causes the function to appear in the Function Library.

The `speckle-automate-github-action` (or `speckle-automate-github-composite-action`) handles building, publishing, and registering Docker images.

### 6.3 Local Testing

The template repositories include test utilities. For Python:
- Tests are in the `tests/` directory
- A `.env.example` file shows required environment variables
- Local execution can be done via `uv run python main.py` with appropriate arguments

For C#:
- The `TestAutomateFunction/` project contains integration tests
- Tests can be run via `dotnet test`

### 6.4 Deployment Flow

```
1. Developer creates function via wizard
2. Template repo is cloned to GitHub
3. Developer modifies function code locally or in Codespaces
4. Developer pushes changes to GitHub
5. Developer creates a GitHub Release
6. GitHub Actions workflow triggers:
   a. Builds Docker image
   b. Pushes to Speckle registry
   c. Registers function version
7. Function appears in Function Library
8. Users create Automations using the function
```

### 6.5 Function Library Publishing

Functions appear in the Function Library ONLY after their first GitHub release is created. The library shows:
- Function name and description
- Available versions (one per release)
- Tags and source application compatibility
- Author information

Functions in the library can be used by anyone in the workspace to create automations.

---

## 7. Input Schema Definition

The input schema defines what parameters users configure when creating an automation from a function. The schema is automatically generated from the input class definition.

### Python (Pydantic)

```python
class FunctionInputs(AutomateBase):
    # Simple string input
    category_filter: str = Field(
        title="Category Filter",
        description="Only check objects in this category"
    )

    # Numeric with constraints
    max_count: int = Field(
        default=100,
        title="Maximum Object Count",
        ge=1,
        le=10000
    )

    # Secret value (encrypted)
    api_key: SecretStr = Field(
        title="External API Key"
    )

    # Boolean toggle
    strict_mode: bool = Field(
        default=False,
        title="Strict Mode",
        description="Fail on warnings too"
    )

    # Enum/choice (via Literal or Enum)
    check_level: str = Field(
        default="warning",
        title="Check Level"
    )
```

Pydantic validators can be used for complex validation logic. The JSON Schema generated from this class is presented in the Speckle UI as a form.

### C# (DataAnnotations)

```csharp
public readonly struct FunctionInputs
{
    [Required]
    public string CategoryFilter { get; init; }

    [DefaultValue(100)]
    [Range(1, 10000)]
    public int MaxCount { get; init; }

    [Required]
    [Secret]
    public string ApiKey { get; init; }

    [DefaultValue(false)]
    public bool StrictMode { get; init; }

    [DefaultValue("warning")]
    public string CheckLevel { get; init; }
}
```

Standard `System.ComponentModel.DataAnnotations` attributes control validation. The `[Secret]` attribute ensures the value is encrypted.

---

## 8. Error Reporting and Result Attachment

### 8.1 Three Outcome States

Every automation run ends in one of three states:

1. **Success** — function completed and explicitly called `mark_run_success()`. The model meets all criteria.

2. **Failed (by design)** — function completed and explicitly called `mark_run_failed()`. The model does NOT meet the criteria. This is NOT an error — it is an intentional validation failure.

3. **Exception** — function crashed due to unhandled exception (code error) or platform error (resource exhaustion, container misconfiguration).

### 8.2 Result Visibility

Results are visible in multiple places:
- **3D Viewer:** A "doughnut" icon appears on the model, with colored indicators (green/red) for pass/fail
- **Project Dashboard:** Automation status indicators on the project page
- **Run Cards:** Detailed information including messages, annotated objects, and file artifacts
- **Object Annotations:** Error annotations attached via `attach_error_to_objects()` highlight specific objects in the viewer

### 8.3 File Artifacts

Functions can attach file artifacts to run results via `store_file_result()`. Common use cases:
- PDF compliance reports
- CSV data exports
- Log files
- Generated images or screenshots
- JSON analysis results

Files are stored alongside the run and downloadable from the run card in the Speckle UI.

### 8.4 Object-Level Error Annotations

The `attach_error_to_objects()` method creates visual annotations in the 3D viewer:
- Annotated objects are highlighted in the viewer
- Errors are grouped by category
- Each annotation includes a human-readable message
- Users can filter and navigate to annotated objects

This is the primary mechanism for communicating model issues back to designers and engineers.

---

## 9. Execution Environment

### 9.1 Container Runtime

Functions run in Docker containers on Speckle's infrastructure. The template repositories include a `Dockerfile` that defines the container image.

**Python Dockerfile pattern:**
- Base image: Python runtime
- Install dependencies from `pyproject.toml`
- Copy function code
- Set entry point to `main.py`

**C# Dockerfile pattern:**
- Base image: .NET SDK for build, .NET Runtime for execution
- Multi-stage build
- Copy and build project
- Set entry point to compiled executable

### 9.2 Resource Constraints

The documentation does not specify exact resource limits (CPU, memory, timeout). However:
- Out-of-memory errors appear in logs
- Functions should be designed to handle large models efficiently
- Streaming/lazy processing is recommended over loading entire models into memory

### 9.3 Permissions

- Only Enterprise workspaces can create, build, and publish custom functions
- Personal projects: the automation author configures the automation
- Workspace projects: project owners configure automations
- Any project viewer can see automation results
- Workspace admins and project owners can access full run history

---

## 10. Anti-Patterns and Common Mistakes

### Function Design

1. **Not calling `mark_run_success()` or `mark_run_failed()`.** If neither is called and no exception occurs, the run status is ambiguous. ALWAYS explicitly set the outcome.

2. **Loading entire model into memory at once.** For large models, calling `list(flatten_base(base))` materializes the entire hierarchy. Use generators and iterators for lazy processing when possible.

3. **Ignoring `SecretStr` for sensitive inputs.** Sensitive values (API keys, tokens, credentials) MUST use `SecretStr` (Python) or `[Secret]` (C#) to prevent them from appearing in logs and UI.

4. **Not handling empty models.** A version might contain an empty or minimal Base object. ALWAYS check that received data is non-null and contains expected properties before processing.

5. **Blocking on synchronous I/O in C#.** The C# function is async. NEVER use `.Result` or `.Wait()` — ALWAYS use `await` for async operations.

6. **Attaching errors without object IDs.** The `attach_error_to_objects()` method requires a list of object IDs. Passing empty lists or invalid IDs produces silent failures with no visible annotations.

### Deployment

7. **Forgetting to create a GitHub release.** Functions are NOT published to the Function Library until a GitHub release is created. Pushing code to the repository is not sufficient.

8. **Modifying the auto-generated workflow.** The `.github/workflows/main.yml` file contains injected environment variables (`SPECKLE_FUNCTION_ID`, `SPECKLE_FUNCTION_TOKEN`). Overwriting or removing these variables breaks the deployment pipeline.

9. **Using private GitHub repos without proper access.** If the function repo is private, ensure all team members and the Speckle OAuth app have access.

### Input Schema

10. **Not providing default values for optional inputs.** Inputs without defaults are treated as required. If an input is truly optional, ALWAYS provide a `default` value in `Field()` (Python) or `[DefaultValue]` (C#).

11. **Using complex nested types in inputs.** The input schema is rendered as a form in the Speckle UI. Deeply nested objects, lists of objects, or union types may not render correctly. Keep inputs flat and simple.

12. **Not adding titles and descriptions to fields.** Without `title` and `description`, the Speckle UI shows raw field names. ALWAYS add human-readable metadata to every input field.

### Error Handling

13. **Catching all exceptions silently.** A broad `except Exception: pass` (Python) or empty `catch` (C#) hides real errors. ALWAYS log exceptions and either mark the run as failed or re-raise.

14. **Not distinguishing between "no issues found" and "function error".** A function that crashes on unexpected input should be an exception, not a "success" result. Use `mark_run_success()` ONLY when the function actually completed its validation logic.

---

## 11. Best Practices

### Function Architecture

1. **Keep functions focused.** Each function should check ONE thing (compliance, naming, geometry validation). Do NOT combine multiple unrelated checks in a single function.

2. **Use categories for error grouping.** When attaching errors, use meaningful categories that help users filter and prioritize issues.

3. **Generate human-readable reports.** Attach summary reports (PDF, CSV) via `store_file_result()` for stakeholders who do not use the 3D viewer.

4. **Test locally before deploying.** Use the template's test infrastructure to verify function logic before creating a release.

5. **Version your function meaningfully.** Use semantic versioning for GitHub releases so users can pin to specific function versions.

### Performance

6. **Use `flatten_base()` with generators.** The `yield from` pattern in the flatten function enables lazy evaluation. Filter early and break early to avoid processing the entire model.

7. **Cache frequently accessed properties.** If you check the same property on many objects, cache the attribute name check results.

8. **Minimize file artifact size.** Large file artifacts slow down result retrieval. Compress reports and limit output to essential data.

---

## 12. Open Questions for Skills

1. What is the exact execution timeout for Automate functions? Is it configurable?
2. What are the exact CPU and memory resource limits per function execution?
3. Can functions access external services (HTTP requests to third-party APIs)?
4. How does the versioning of functions work — can users pin to a specific function version?
5. What happens when a function is updated — do existing automations auto-update or stay pinned?
6. Is there a way to trigger functions manually for testing (not just on version creation)?
7. What is the exact Docker base image used for Python and C# functions?
8. Can functions create new versions or modify existing data (write-back pattern)?
9. How do subscriptions/webhooks interact with Automate — are they alternative trigger mechanisms?
10. What is the complete list of `AutomationContext` methods beyond the documented ones?
11. Can multiple functions be chained in sequence (pipeline pattern)?
12. What logging/observability is available during function execution?

---

## 13. Sources Consulted

| Source | URL | Accessed |
|---|---|---|
| Automate Introduction | https://docs.speckle.systems/developers/automate/introduction.md | 2026-03-20 |
| Automate Quickstart | https://docs.speckle.systems/developers/automate/quickstart.md | 2026-03-20 |
| Automate Create Function | https://docs.speckle.systems/developers/automate/create-function.md | 2026-03-20 |
| Automate FAQ | https://docs.speckle.systems/developers/automate/faq.md | 2026-03-20 |
| Automate Troubleshooting | https://docs.speckle.systems/developers/automate/troubleshooting.md | 2026-03-20 |
| Python Template Repository | https://github.com/specklesystems/speckle_automate_python_example | 2026-03-20 |
| Python Template — main.py | https://raw.githubusercontent.com/specklesystems/speckle_automate_python_example/main/main.py | 2026-03-20 |
| Python Template — flatten.py | https://raw.githubusercontent.com/specklesystems/speckle_automate_python_example/main/flatten.py | 2026-03-20 |
| Python Template — pyproject.toml | https://raw.githubusercontent.com/specklesystems/speckle_automate_python_example/main/pyproject.toml | 2026-03-20 |
| C# Template Repository | https://github.com/specklesystems/SpeckleAutomateDotnetExample | 2026-03-20 |
| C# Template — AutomateFunction.cs | https://raw.githubusercontent.com/specklesystems/SpeckleAutomateDotnetExample/main/SpeckleAutomateDotnetExample/AutomateFunction.cs | 2026-03-20 |
| C# Template — FunctionInputs.cs | https://raw.githubusercontent.com/specklesystems/SpeckleAutomateDotnetExample/main/SpeckleAutomateDotnetExample/FunctionInputs.cs | 2026-03-20 |
| C# Template — Program.cs | https://raw.githubusercontent.com/specklesystems/SpeckleAutomateDotnetExample/main/SpeckleAutomateDotnetExample/Program.cs | 2026-03-20 |
| C# Template — .csproj | https://raw.githubusercontent.com/specklesystems/SpeckleAutomateDotnetExample/main/SpeckleAutomateDotnetExample/SpeckleAutomateDotnetExample.csproj | 2026-03-20 |
| Speckle Automate GitHub Action | https://github.com/specklesystems/speckle-automate-github-action | 2026-03-20 |
| Speckle Docs LLMs Index | https://docs.speckle.systems/llms.txt | 2026-03-20 |
