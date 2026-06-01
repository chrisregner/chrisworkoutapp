# Live PGLite Development Bridge

## Purpose

Allow a local coding agent or developer to inspect and modify the application's
live browser-local PGLite database with unrestricted SQL from the repository
terminal.

The runtime database remains `idb://chrisworkoutapp`. The browser tab remains
the sole owner of that IndexedDB-backed PGLite instance. The tooling is a
development operator surface, not an application feature.

## Scope

The first increment provides:

- `pnpm db:sql "SELECT ..."` for inline SQL.
- `pnpm db:exec ./path/to/script.sql` for SQL files.
- Unrestricted SQL, including reads, writes, and DDL.
- Structured terminal output suitable for both humans and coding agents.
- Clear errors when the bridge server is unavailable or no app tab is
  connected.
- Development-only enablement with localhost-only network binding.

The first increment does not provide:

- `psql`, DBeaver, or Postgres wire-protocol compatibility.
- Remote or LAN access.
- Production bundle exposure.
- Repository validation, domain invariant enforcement, or cache invalidation
  after direct SQL writes.
- Snapshot export or import. That is a later recovery feature.

## Architecture

The bridge has three parts.

### Local Bridge Server

A small Node development process runs alongside Vite and binds only to
`127.0.0.1`. It accepts:

- One browser WebSocket connection from the development app tab.
- Local CLI requests containing SQL.

For each CLI request, it forwards the SQL to the connected browser tab, waits
for the response, and returns the structured result to the CLI. If no browser
tab is connected, it fails immediately with an actionable message.

The bridge server does not open PGLite or IndexedDB itself. It only correlates
requests and responses.

### Browser Bridge Client

After `getDb()` resolves in development, a browser-only bridge client connects
to the local server. It receives SQL requests and executes them through the
existing live PGLite client exposed as `db.$client`.

The client returns either:

- A successful structured result for each executed SQL statement.
- A structured error containing the database error message.

Direct SQL deliberately bypasses repositories, smart constructors, domain
invariants, and TanStack Query invalidation. The app should display a
development-only warning while the bridge is connected. After writes, the
operator reloads the page when fresh UI state is required.

### Repository CLI

The repository exposes:

```bash
pnpm db:sql "SELECT * FROM equipment_defs"
pnpm db:exec ./scripts/data-fix.sql
```

The CLI sends SQL to the localhost bridge and prints:

- Tabular output for result rows in normal terminal use.
- A concise affected-row summary for writes.
- Non-zero exit status and the returned message for errors.

The transport response remains structured so a later `--json` flag can be
added without changing the bridge protocol.

## Data Flow

1. The developer starts the normal development environment.
2. The Vite app opens `idb://chrisworkoutapp`, runs migrations, and renders.
3. The development-only browser bridge client connects to the localhost bridge.
4. The coding agent runs `pnpm db:sql "..."` or `pnpm db:exec file.sql`.
5. The bridge server forwards the SQL to the browser.
6. The browser executes SQL against the live PGLite instance.
7. The result or error returns through the bridge server to the CLI.

Only one app tab is supported initially. A second browser connection is
rejected with a clear error so the active live database cannot change
underneath an in-flight CLI operation.

## Safety

This surface is intentionally unrestricted because its purpose is operator
access. Safety comes from containment:

- The server binds only to `127.0.0.1`.
- Browser bridge code is enabled only during Vite development.
- Production builds do not start a bridge connection.
- The UI visibly states that direct writes can violate domain invariants.
- CLI help states that direct writes may require a browser reload.

The bridge must not silently fall back to another database. If the live browser
tab is absent, commands fail.

## Error Handling

The CLI reports distinct failures for:

- Local bridge server is not running.
- Browser app tab is not connected.
- Browser connection closes while a query is running.
- SQL execution fails.
- SQL file cannot be read.
- Request times out.

Each pending request has a timeout and is rejected if the browser disconnects.

## Testing

Focused automated tests cover:

- Server forwards a CLI SQL request to the connected browser and returns the
  browser response.
- Server rejects CLI requests when no browser is connected.
- Server rejects a second browser connection.
- Server rejects pending requests if the browser disconnects.
- Server times out abandoned requests.
- CLI sends inline SQL and file SQL correctly.
- CLI exits non-zero and prints actionable errors for unavailable bridge and
  SQL failures.
- Production mode does not initialize the browser bridge client.

Manual verification runs the app, opens one browser tab, reads live rows with
`pnpm db:sql`, writes a disposable row or value, confirms the write with a
second query, and reloads the UI to observe the updated state.

## Deferred Work

Later increments may add:

- `--json` CLI output.
- Snapshot export and import using PGLite `dumpDataDir()` or `pgDump`.
- A browser SQL console using the same bridge execution path.
- A local TCP proxy for `psql` compatibility if standard Postgres tooling
  becomes valuable.
