---
name: undocumented-api
status: draft
evidence: Fallout #466, #478, #519, #535, #597
---

# Undocumented API or algorithm

## What it looks like
Public members without XML docs. Private helpers, regexes and multi-step algorithms with no comment on what they do or why. A comment that no longer matches the code after a change.

## Why it is a problem
Contributors must reverse-engineer intent. Missing docs on public APIs was a long-running weakness of the project we replaced.

## Instead
Document every public member: what it does, accepted inputs, and what happens on edge cases (missing directory, conflicting files). Explain non-obvious private methods and regexes. Update the comment when you change the code.

## Example

```csharp
// Bad
public static void Unzip(this AbsolutePath archive, AbsolutePath directory)
{
    // ...
}

// Good
/// <summary>Extracts a <c>.zip</c> or <c>.tar.gz</c> archive into <paramref name="directory"/>.</summary>
/// <param name="archive">The archive to extract. Supported formats: <c>.zip</c>, <c>.tar.gz</c>.</param>
/// <param name="directory">The target directory. It is created if it does not exist.</param>
/// <exception cref="FileNotFoundException">The archive does not exist.</exception>
/// <remarks>Existing files in <paramref name="directory"/> with the same name are overwritten.</remarks>
public static void Unzip(this AbsolutePath archive, AbsolutePath directory)
{
    // ...
}
```

A regex needs the same care:

```csharp
// Bad
private static readonly Regex VersionPattern = new(@"(?<=Version="")(?!\$\()[^""]+");

// Good: say what it matches and what it skips
// Matches a literal version such as Version="1.2.3".
// The (?!\$\() part skips property-based versions such as Version="$(FooVersion)".
private static readonly Regex VersionPattern = new(@"(?<=Version="")(?!\$\()[^""]+");
```
