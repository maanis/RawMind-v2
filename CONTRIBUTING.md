# Contributing to MindScroll

Thanks for contributing.

## Local Development
1. Copy `.env.example` to `.env.local` and set required keys.
2. Install dependencies with `npm install`.
3. Start app with `npm run dev`.

## Pull Requests
1. Create a feature branch from `main`.
2. Keep PRs focused and small where possible.
3. Include a short description of behavior changes and test notes.
4. Ensure CI checks pass (`lint`, `tsc`, `build`, and tests).

## Code Style
- Follow existing TypeScript + Next.js patterns.
- Run `npm run lint` and `npm test` before opening a PR.
- Prefer small, readable functions and structured logs for operational code.

## Architecture
See `AGENTS.md` for system architecture and conventions.
