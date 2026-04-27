# Skill Template

Use this template when creating a new skill in the `skills/` directory.

## Description

One-sentence description of what this skill covers and why it exists.

## Capabilities

- Specific, actionable capability 1
- Specific, actionable capability 2
- Specific, actionable capability 3

## Triggers

- When to assign this skill to an agent (specific task patterns)
- When a PR or issue falls into this domain

## Handoff Conditions

- When the assigned agent should stop and request a handoff to another skill
- Complexity thresholds, domain boundaries, or risk factors

## Dependencies

- List upstream skills this skill depends on
- Use `None (foundational skill)` if there are no dependencies

## Outputs

- What artifacts this skill produces
- Files, documentation, tests, or decisions

## Quality Standards

### Checklist

- [ ] Quality criterion 1
- [ ] Quality criterion 2
- [ ] Quality criterion 3

### Patterns & Examples

Include concrete code patterns, formulas, or examples that an agent can copy and adapt.

```typescript
// Example pattern
const example = 'show the right way to do something';
```

### Performance Targets (if applicable)

- Metric: target value
- How to measure it

## Common Pitfalls

- **Do not** ... (anti-pattern 1)
- **Do not** ... (anti-pattern 2)
- **Watch out for** ... (subtle issue)

## Agent Prompt Template

When delegating a task to this skill, use this prompt structure:

```
You are assigned the skill: {{skill_name}}

Task: {{task_description}}

Context:
- Related files: {{file_paths}}
- Architecture reference: ARCHITECTURE.md §{{section}}

Requirements:
- {{requirement_1}}
- {{requirement_2}}

Quality gates:
- {{quality_check_1}}
```
