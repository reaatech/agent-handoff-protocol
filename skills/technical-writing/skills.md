# Technical Writing Skill

## Description

Creates accurate, concise documentation for developers using and contributing to the Agent Handoff Protocol. Documentation is code-adjacent: it lives in the repo, is versioned with releases, and is validated for correctness.

## Capabilities

- Write JSDoc comments for all public APIs
- Maintain `README.md` with quick start, examples, and troubleshooting
- Generate TypeDoc API documentation from source comments
- Write `CHANGELOG.md` following Keep a Changelog format
- Create runnable examples in `examples/`

## Triggers

- When documenting new features or APIs
- When creating or updating examples
- When preparing a release (CHANGELOG, version bump)
- When README becomes outdated relative to code

## Handoff Conditions

- Complex technical concepts requiring deep domain expertise
- Needs subject matter expert review (architecture decisions)
- Multi-language documentation
- Advanced integration guides (Kubernetes, custom platforms)

## Dependencies

- All other skills (for understanding features)
- `developer-experience` (for API ergonomics and examples)

## Outputs

| Output    | Path                | Description                      |
| --------- | ------------------- | -------------------------------- |
| README    | `README.md`         | Project overview and quick start |
| API docs  | `docs/` (generated) | TypeDoc output                   |
| Examples  | `examples/`         | Runnable TypeScript examples     |
| CHANGELOG | `CHANGELOG.md`      | Versioned release notes          |
| JSDoc     | Inline in `src/`    | Public API documentation         |

## Quality Standards

### README Checklist

- [ ] One-sentence description at the top
- [ ] "What This Is (and Isn't)" section sets expectations
- [ ] Installation instructions (`npm install`, `pnpm add`)
- [ ] Quick start code block that compiles and runs
- [ ] Link to `DEV_PLAN.md` and `ARCHITECTURE.md`
- [ ] License and contributing sections

### JSDoc Requirements

Every exported function, class, and interface must have:

- [ ] A one-sentence description
- [ ] `@param` tags for all parameters (if not obvious from types)
- [ ] `@returns` description (if not void)
- [ ] `@example` for non-trivial functions

```typescript
/**
 * Execute a handoff from the current agent to the best available target.
 *
 * @param context - The current handoff context (messages, trigger, agents)
 * @param options - Optional overrides for this specific handoff
 * @returns A result indicating success or failure, with routing details
 *
 * @example
 * const result = await manager.executeHandoff(context, { timeout: 10000 });
 * if (result.success) {
 *   console.log(`Handed off to ${result.receivingAgent.agentName}`);
 * }
 */
executeHandoff(context: HandoffContext, options?: HandoffOptions): Promise<HandoffResult>;
```

### Example Requirements

- [ ] All examples in `examples/` are runnable with `tsx` or `ts-node`
- [ ] Each example has a comment header explaining what it demonstrates
- [ ] Examples use the public API only (no internal imports)

### CHANGELOG Format

Follow [Keep a Changelog](https://keepachangelog.com/) with sections:

- `## [Unreleased]`
- `### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`, `### Security`

## Common Pitfalls

- **Do not** let README examples drift from the actual API. When a public API changes, update the README in the same PR.
- **Do not** write prose for prose's sake. Developers scan docs. Use headings, bullet points, and code blocks.
- **Do not** document internal functions in the public TypeDoc. Use `@internal` or `@ignore` JSDoc tags.
- **Do not** commit generated TypeDoc output to `main`. Generate it in CI and publish to GitHub Pages.
- **Do not** use future tense ("will be added"). Use present tense or link to issues.

## Cross-References

- DEV_PLAN.md § Sprint 4 → Documentation deliverables
- CONTRIBUTING.md → Documentation standards for contributors
- README.md → Current state of user-facing docs
