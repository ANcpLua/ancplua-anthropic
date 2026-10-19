---
name: silent-failure-or-global-side-effects
status: draft
evidence: Fallout #433, #519, #629, #663
---

# Silent failure and hidden global side effects

## What it looks like
Code that quietly returns nothing when input is missing. Parsing code that throws `IndexOutOfRange` on malformed input. A DI registration method that changes process-wide state on every call.

## Why it is a problem
Failures surface far from their cause. Registration order and repeat calls change behaviour.

## Instead
Skip when it is safe, but log a warning that says what was skipped and why. Handle malformed input without crashing. Keep registration methods idempotent and free of global mutation.

## Example

```csharp
// Bad: skips silently, crashes on malformed input
if (!File.Exists(path))
{
    return;
}

var end = FindEndOfBlock(lines, start);   // can return -1
var next = lines[end + 1];                // IndexOutOfRangeException

// Good: skip visibly, handle malformed input
if (!File.Exists(path))
{
    Log.Warning("Changelog {Path} not found; skipping release notes.", path);
    return;
}

var end = FindEndOfBlock(lines, start);
if (end < 0 || end + 1 >= lines.Count)
{
    Log.Warning("Unrecognised block in {File}; leaving it unchanged.", file);
    return;
}
```

```csharp
// Bad: a DI registration that changes global state on every call
public static IServiceCollection AddFalloutLogging(this IServiceCollection services)
{
    Log.Logger = CreateLogger();
    return services.AddSingleton(Log.Logger);
}

// Good: idempotent, no global mutation
public static IServiceCollection AddFalloutLogging(this IServiceCollection services)
{
    services.TryAddSingleton<ILoggerFactory>(_ => CreateLoggerFactory());
    return services;
}
```
