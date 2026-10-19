---
name: unmarked-breaking-change
status: draft
evidence: Fallout #393, #410, #528
---

# Unmarked breaking change

## What it looks like
A public signature, namespace or behaviour change that is not labelled, not described as breaking, and has no migration path. The PR title says nothing about the break.

## Why it is a problem
Consumers find out when their build fails. Maintainers cannot tell what is safe to ship.

## Instead
Check every public change for compatibility. Label breaking changes, add a callout to the description, and name the migration path. Breaking changes wait for the next major version, or ship behind an experimental attribute.

## Example

```csharp
// Bad: changes the public signature in a minor release, nothing says so
- public static void Run(string path)
+ public static Task RunAsync(string path, CancellationToken token)

// Good: keep the old member, mark it obsolete, add the new one
[Obsolete("Use RunAsync.", DiagnosticId = "FALLOUTOBS012")]
public static void Run(string path) => RunAsync(path, default).GetAwaiter().GetResult();

public static Task RunAsync(string path, CancellationToken token) { /* ... */ }
```

```markdown
PR description for a change that cannot stay compatible:

> ⚠️ **Breaking change.** `Run` is removed. Migration: call `RunAsync` and await it.
> Labels: `breaking-change`, `target/vNext`
```
