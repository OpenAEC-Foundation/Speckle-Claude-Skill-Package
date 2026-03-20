# Working Code Examples (Speckle Automate)

## Example 1: Python -- Forbidden Type Checker

Complete function that checks for forbidden object types in a model.

```python
# main.py
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

    objects = list(flatten_base(base))
    forbidden = [
        obj for obj in objects
        if obj.speckle_type == function_inputs.forbidden_speckle_type
    ]

    if forbidden:
        automate_context.attach_error_to_objects(
            category="Forbidden Type",
            object_ids=[obj.id for obj in forbidden],
            message=f"Found {len(forbidden)} objects of forbidden type.",
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

```python
# flatten.py
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

---

## Example 2: Python -- Property Compliance Checker

Function that verifies all objects have a required property.

```python
from pydantic import Field
from speckle_automate import (
    AutomateBase,
    AutomationContext,
    execute_automate_function,
)
from flatten import flatten_base


class FunctionInputs(AutomateBase):
    required_property: str = Field(
        title="Required Property",
        description="Property name that ALL objects must have",
    )
    target_category: str = Field(
        default="",
        title="Target Category",
        description="Only check objects of this speckle_type (empty = all)",
    )


def automate_function(
    automate_context: AutomationContext,
    function_inputs: FunctionInputs,
) -> None:
    base = automate_context.receive_version()
    all_objects = list(flatten_base(base))

    # Filter by category if specified
    if function_inputs.target_category:
        targets = [
            obj for obj in all_objects
            if obj.speckle_type == function_inputs.target_category
        ]
    else:
        targets = all_objects

    # Find objects missing the required property
    missing = [
        obj for obj in targets
        if not hasattr(obj, function_inputs.required_property)
    ]

    if missing:
        automate_context.attach_error_to_objects(
            category="Missing Property",
            object_ids=[obj.id for obj in missing],
            message=f"Missing required property: {function_inputs.required_property}",
        )
        automate_context.mark_run_failed(
            f"{len(missing)} of {len(targets)} objects missing "
            f"'{function_inputs.required_property}'."
        )
    else:
        automate_context.set_context_view()
        automate_context.mark_run_success(
            f"All {len(targets)} objects have '{function_inputs.required_property}'."
        )


if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```

---

## Example 3: Python -- Report Generator with File Artifact

Function that generates a CSV report and attaches it as a file artifact.

```python
import csv
import tempfile
from pathlib import Path
from pydantic import Field
from speckle_automate import (
    AutomateBase,
    AutomationContext,
    execute_automate_function,
)
from flatten import flatten_base


class FunctionInputs(AutomateBase):
    speckle_type_filter: str = Field(
        title="Type Filter",
        description="Only include objects of this speckle_type in the report",
    )


def automate_function(
    automate_context: AutomationContext,
    function_inputs: FunctionInputs,
) -> None:
    base = automate_context.receive_version()
    all_objects = list(flatten_base(base))

    matching = [
        obj for obj in all_objects
        if obj.speckle_type == function_inputs.speckle_type_filter
    ]

    # Generate CSV report
    report_path = Path(tempfile.mkdtemp()) / "object_report.csv"
    with open(report_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Object ID", "Speckle Type"])
        for obj in matching:
            writer.writerow([obj.id, obj.speckle_type])

    # Attach the report file
    automate_context.store_file_result(str(report_path))
    automate_context.set_context_view()
    automate_context.mark_run_success(
        f"Report generated with {len(matching)} objects."
    )


if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```

---

## Example 4: C# -- Object Count Validator

Complete C# function that validates object counts by type.

```csharp
// FunctionInputs.cs
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

```csharp
// AutomateFunction.cs
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

        var matchingObjects = allObjects
            .Where(o => o.speckle_type == functionInputs.SpeckleTypeToCount)
            .ToList();

        if (matchingObjects.Count != functionInputs.SpeckleTypeTargetCount)
        {
            automationContext.AttachErrorToObjects(
                "Object Count",
                matchingObjects.Select(o => o.id).ToList(),
                $"Expected {functionInputs.SpeckleTypeTargetCount} but found {matchingObjects.Count}"
            );
            automationContext.MarkRunFailed(
                $"Expected {functionInputs.SpeckleTypeTargetCount} objects of type "
                + $"'{functionInputs.SpeckleTypeToCount}', found {matchingObjects.Count}."
            );
        }
        else
        {
            automationContext.SetContextView();
            automationContext.MarkRunSuccess(
                $"Found exactly {matchingObjects.Count} matching objects."
            );
        }
    }
}
```

```csharp
// Program.cs
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

```xml
<!-- SpeckleAutomateExample.csproj -->
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

---

## Example 5: Python -- Multi-Category Error Reporting

Function that reports errors across multiple categories with proper grouping.

```python
from pydantic import Field
from speckle_automate import (
    AutomateBase,
    AutomationContext,
    execute_automate_function,
)
from flatten import flatten_base


class FunctionInputs(AutomateBase):
    min_name_length: int = Field(
        default=3,
        title="Minimum Name Length",
        ge=1, le=100,
        description="Objects with shorter names are flagged",
    )
    require_material: bool = Field(
        default=True,
        title="Require Material",
        description="Flag objects without a material property",
    )


def automate_function(
    automate_context: AutomationContext,
    function_inputs: FunctionInputs,
) -> None:
    base = automate_context.receive_version()
    all_objects = list(flatten_base(base))

    error_count = 0

    # Check 1: Name length
    short_names = [
        obj for obj in all_objects
        if hasattr(obj, "name")
        and len(getattr(obj, "name", "")) < function_inputs.min_name_length
    ]
    if short_names:
        automate_context.attach_error_to_objects(
            category="Naming Convention",
            object_ids=[obj.id for obj in short_names],
            message=f"Name shorter than {function_inputs.min_name_length} characters.",
        )
        error_count += len(short_names)

    # Check 2: Material property
    if function_inputs.require_material:
        no_material = [
            obj for obj in all_objects
            if not hasattr(obj, "material") and not hasattr(obj, "@material")
        ]
        if no_material:
            automate_context.attach_error_to_objects(
                category="Material Assignment",
                object_ids=[obj.id for obj in no_material],
                message="Object has no material assigned.",
            )
            error_count += len(no_material)

    # Final verdict
    if error_count > 0:
        automate_context.mark_run_failed(
            f"{error_count} issues found across {len(all_objects)} objects."
        )
    else:
        automate_context.set_context_view()
        automate_context.mark_run_success(
            f"All {len(all_objects)} objects passed all checks."
        )


if __name__ == "__main__":
    execute_automate_function(automate_function, FunctionInputs)
```
