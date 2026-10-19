---
name: ignoring-repo-conventions
status: draft
evidence: Fallout #448, #451, #486, #535, #597, #661
---

# Ignoring the repo's code conventions

## What it looks like
New code that uses `_` field prefixes, omits braces, uses `var` where the type is not visible, breaks naming or member-order rules, exceeds the line length, or skips newer language features the repo has adopted.

## Why it is a problem
Reviews fill up with style nitpicks, and the codebase stays inconsistent. Conventions that live only in someone's head are not followed.

## Instead
Put the rule in `.editorconfig` and enable the analyzers so the build reports it. Run the IDE auto-cleanup on files you touch. Read a neighbouring file before writing a new one.

## Example

```csharp
// Bad: underscore field, no braces, explicit type where it is not visible
class DelegateCommand
{
    private readonly Func<int> _run;
    public DelegateCommand(Func<int> run) { _run = run; }
    public int Execute()
    {
        if (_run == null) return 1;
        Dictionary<string, string> map = GetMap();
        return _run();
    }
}

// Good: no underscore, braces always, var, explicit access modifiers
internal sealed class DelegateCommand(Func<int> run)
{
    private readonly Func<int> run = run;

    public int Execute()
    {
        if (run is null)
        {
            return 1;
        }

        var map = GetMap();
        return run();
    }
}
```

Better still, let the build enforce the rules in `.editorconfig`:

```ini
dotnet_style_require_accessibility_modifiers = always:warning
csharp_prefer_braces = true:warning
max_line_length = 130
```
