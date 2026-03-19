# Repository Guidelines

## Project Structure & Module Organization
This repository is a Cloudflare Worker API. `src/index.js` is the only Worker entrypoint referenced by `wrangler.toml`; it routes `/login/*` and `/callback/*` requests to provider classes under `src/providers/`. Keep provider-specific OAuth flow logic inside `src/providers/github.js` and `src/providers/linkedin.js`, and keep request dispatch in `src/index.js` thin. `src/index.test.js` exercises the worker end to end by calling `worker.fetch(...)` directly with mocked `fetch` responses.

## Build, Test, and Development Commands
Use `npm run dev` to start `wrangler dev` for local Worker development. Use `npm run deploy` to publish with Wrangler. Use `npm test` to run the full Vitest suite, and `npx vitest run src/index.test.js` when you only need the worker integration tests in this repo. Use `npm run lint` to run ESLint against `src/`. Wrangler secrets are not committed; `wrangler.toml` expects `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `ALLOWED_ORIGINS` to be provided with `wrangler secret put`.

## Coding Style & Naming Conventions
Code is plain ES modules targeting ECMAScript 2022. Follow the existing style: double quotes, semicolons, and named provider classes with `PascalCase` exports (`GitHubProvider`, `LinkedInProvider`). Route paths stay in the Worker switch, while external API calls, redirect URI construction, and token exchange details stay in provider modules. Avoid comments that restate code that is already easy to understand; add comments only when they clarify non-obvious intent or behavior. ESLint uses `@eslint/js` recommended rules plus browser globals, so write code that is valid in the Worker runtime rather than Node-specific globals unless tests require them.

## Testing Guidelines
Vitest runs in a `node` environment. Add or update tests in `src/index.test.js` whenever route behavior, OAuth state handling, or provider error mapping changes. Prefer mocking upstream OAuth/token/profile requests with `vi.stubGlobal("fetch", ...)` so tests stay deterministic and do not hit external services.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects such as `Add observability logs configuration to wrangler.toml`, `add vitest for all source code`, and `Refactor to class-based GitHubProvider and LinkedInProvider`. Keep commit titles concise, action-led, and specific to one change. GitHub merges currently produce `Merge pull request #...` commits, so branch commits should be clean enough to read well before squash or merge. The local GitHub CLI is available in this repository; prefer `gh pr create` when opening pull requests from the terminal.
