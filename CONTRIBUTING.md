# Contributing to NEXUS Monitor

Thank you for considering a contribution. NEXUS Monitor is being developed in explicit phases so that each system boundary remains understandable and testable.

## Before you start

- Search existing issues before opening a new one.
- Use an issue to discuss significant behavior or architecture changes first.
- Keep pull requests focused on one outcome.
- Never include credentials, private host details, tokens, or unsanitized logs.

## Local workflow

1. Install Node.js 24 and pnpm 11.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env` and replace the local example password.
4. Run `docker compose up -d postgres`.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before opening a pull request.

Use Conventional Commit-style messages such as `feat: add heartbeat validation` or `fix: reject invalid agent identity`.

## Pull requests

Explain the problem, the chosen boundary, and how the change was verified. Add or update tests for behavior changes. Visual changes require screenshots. Maintainers may ask for a smaller scope when a pull request mixes unrelated work.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
