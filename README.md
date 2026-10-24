# Meticulous Web UI

The machine's own web page, served by the machine at `http://<machine-ip>/`.

- **Machine**: live status, weight and temperature; tare, purge, raise and
  preheat; the selected profile, start / continue / stop; the current or last
  shot; and the profiles, in the machine's order.
- **Sensors**: six live charts with every sensor the machine streams (layout
  from Xavi's "Log review" preset in ProfilePlotter), the raw readings with
  out-of-range flags, pause, time window and CSV export.
- **Settings**: the machine's settings, profile order, log and archive
  downloads, machine info, and an **API explorer** that runs any backend
  endpoint with its parameters (`src/api/endpoints.ts`).

## Development

```bash
npm ci
SERVER_URL=10.10.0.42 npm run dev
```

On Windows PowerShell: `$env:SERVER_URL="10.10.0.42"; npm run dev`.

`SERVER_URL` (or `VITE_SERVER_URL`, for example in a git-ignored
`.env.development.local`) is the machine the dev server talks to. Without it,
open the page and pick a machine from the connection pill in the header (or
Settings → Machine); the choice is remembered in the browser. A
`?machine=<ip>` query parameter does the same.

`npm run dev:lan` also serves the page to other devices on the network.

The machine's API and socket allow any origin, so no proxy is needed. A few
endpoints only answer callers on the machine itself; the API explorer marks
them "Local only".

## Checks

CI runs `npx prettier . --check`, `npx eslint .`, `npx tsc --noEmit` and
`npm run build`.
