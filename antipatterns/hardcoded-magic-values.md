---
name: hardcoded-magic-values
status: draft
evidence: Fallout #476, #509, #531, #581
---

# Hard-coded values that should be derived or centralised

## What it looks like
Package IDs, target frameworks and version numbers typed as string literals in many places. A version nobody has bumped in years.

## Why it is a problem
Every change means a hunt across the code. Stale values ship silently.

## Instead
Read the value from its source, such as a project property. If that is impossible, define one named constant in a central place and reference it. Do a dedicated cleanup PR if the change is too wide for the current one.

## Example

```csharp
// Bad: the same literals in several files
var toolId = "Fallout.Cli";
var framework = "net10.0";
if (installed < new Version("10.3.49")) { /* ... */ }

// Good: read it from the project, or define it once
var toolId = Solution.Fallout_Cli.GetProperty("PackageId");

internal static class Constants
{
    public const string TargetFramework = "net10.0";
    public const string MinimumToolVersion = "10.3.49";
}
```
