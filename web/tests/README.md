# Next.js Frontend Testing & Quality Verification (`web/tests/`)

This directory contains frontend verification specifications and automated quality checks for the MCP Sentinel Security Console.

## Quality Gates

The frontend application enforces the following quality gates:

1. **TypeScript Static Analysis (`npm run type-check`)**:
   - Executes `tsc --noEmit` across all pages, components, hooks, and libraries with strict typing enabled.
   - Verifies that all API models, approval payloads, and component props align with `web/types/index.ts`.

2. **ESLint Code Quality (`npm run lint`)**:
   - Enforces Next.js core Web Vitals rules and TypeScript lint rules (`eslint.config.mjs`).
   - Ensures no unused variables or unsafe type coercions.

3. **Production Turbopack Build (`npm run build`)**:
   - Compiles all 14 routes (static and dynamic) using Next.js 15 and Turbopack.
   - Enforces standalone output generation (`output: "standalone"`) for memory-optimized production containers.
