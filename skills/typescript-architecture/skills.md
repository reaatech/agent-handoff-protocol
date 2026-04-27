# TypeScript Architecture Skill

## Description

Designs and implements the core TypeScript architecture, type system, and module structure for the Agent Handoff Protocol.

## Capabilities

- Design type-safe interfaces and classes
- Implement dependency injection patterns (constructor-based, no frameworks)
- Create modular, extensible architecture optimized for tree-shaking
- Ensure strict TypeScript compliance (`strict`, `noImplicitAny`, `exactOptionalPropertyTypes`)
- Define public API contracts and export maps
- Review module boundaries to prevent circular dependencies

## Triggers

- When designing new core interfaces
- When refactoring module structure
- When implementing type system changes
- When setting up project structure
- When defining public API contracts
- When a PR touches `src/types/` or `src/index.ts`

## Handoff Conditions

- Confidence < 0.7 on complex type relationships (e.g., conditional types, mapped types)
- Topic crosses into domain-specific implementation (compression, routing, transport)
- Needs validation from security or performance specialists
- Complex generic type constraints with multiple bounds
- Advanced module resolution scenarios (monorepo, subpath exports)

## Dependencies

- None (foundational skill)

## Outputs

- Type definitions and interfaces
- Module structure and organization
- Public API export maps
- Configuration schemas
- Architecture decision records (ADRs) for major structural changes

## Quality Standards

### TypeScript Strictness Checklist

Before marking any architecture work complete, verify:

- [ ] `strict: true` enabled in `tsconfig.json`
- [ ] No `any` types in public API surface (`src/index.ts` and `src/types/`)
- [ ] All function parameters and return types are explicitly typed
- [ ] `unknown` is used instead of `any` for catch clauses and external data
- [ ] Optional properties use `property?: T` (not `property: T | undefined`) unless `exactOptionalPropertyTypes` requires otherwise
- [ ] No implicit returns
- [ ] No unchecked indexed access

### Tree-Shaking Rules

- [ ] Side-effect-free modules (`"sideEffects": false` in `package.json`)
- [ ] Named exports preferred over default exports
- [ ] No top-level side effects in library code
- [ ] Barrel files (`index.ts`) use `export { ... }` syntax to preserve tree-shaking

### Module Boundaries

```
Allowed imports:
- core/ → types/, utils/, compression/, routing/, transport/, validation/
- compression/ → types/, utils/
- routing/ → types/, utils/
- transport/ → types/, utils/
- validation/ → types/, utils/
- utils/ → types/ only

Forbidden imports:
- types/ → any implementation module
- transport/ → routing/ or compression/ (use interfaces from types/)
- Any circular dependencies between modules
```

### Architecture Patterns

1. **Dependency Injection**: Use constructor injection. Do not use `tsyringe`, `inversify`, or similar frameworks.

   ```typescript
   class HandoffExecutor {
     constructor(
       private router: HandoffRouter,
       private compressor: ContextCompressor,
       private validator: HandoffValidator,
       private transportFactory: TransportFactory
     ) {}
   }
   ```

2. **Interface Segregation**: Keep interfaces small and focused.
   - `ContextCompressor` only compresses and estimates tokens.
   - `TransportLayer` only sends and validates connections.

3. **Factory Functions over Classes for Config**: Use `createHandoffConfig()` to merge defaults with user options and validate in one place.

## Common Pitfalls

- **Do not** leak internal types in the public API. If a type is only used inside a module, keep it unexported or in an `internal.ts` file.
- **Do not** use enums. Prefer string literal unions for better tree-shaking and DX.
- **Do not** add runtime dependencies for type safety (e.g., `zod` is an optional peer dependency; always provide a fallback manual validation path).
