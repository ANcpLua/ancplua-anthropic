---
name: testing-implementation-details
status: draft
evidence: Fallout #478, #519, #535, #559, #561
---

# Tests that obscure cause and effect

## What it looks like
Tests that call an internal step directly instead of the public entry point. Private helper methods that hide the setup. Snapshot or approval files where a short inline expectation would do. A test whose name promises an assertion it never makes.

## Why it is a problem
The test breaks on refactoring and does not show what behaviour it protects. A reader cannot see cause and effect without opening other files.

## Instead
Test through the public API. Keep arrangement and expectation inline in the test. Use a test data builder if setup repeats. Make sure each test asserts what its name says.

## Example

```csharp
// Bad: tests an internal step, hides setup in a helper, name promises more than it checks
[Fact]
public void ReturnsZeroEditsForUnchangedContent()
{
    var result = CreateStep().Rewrite(Load("unchanged.csproj"));
    result.Content.Should().NotBeNull();
}

// Good: public entry point, input and expectation visible in the test
[Fact]
public void A_project_without_Nuke_references_is_left_unchanged()
{
    var project = "<Project><ItemGroup><PackageReference Include=\"Serilog\" Version=\"4.0.0\" /></ItemGroup></Project>";

    var result = Migration.Run(project);

    result.EditCount.Should().Be(0);
    result.Content.Should().Be(project);
}
```
