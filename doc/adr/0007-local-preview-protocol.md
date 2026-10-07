# 7. Supply the actual protocol when previewing the production build

Status: accepted (2026-10-07)

Complements [decision 4](0004-identity-and-access.md); the identity and membership
rules are unchanged.

## Problem and evidence

The project owner reported that Host creation did not work. The preview log
showed successful `POST /api/orgs` responses followed by room requests with no
participant identity. The initial local launch used `node build` on HTTP without
supplying a protocol to adapter-node, which defaults to HTTPS. New identity
cookies consequently had `Secure` set. Browsers differ in whether they accept
that attribute on local HTTP addresses.

The existing HTTP test client retained every cookie without enforcing browser
transport rules. Earlier UI checks also reused an established identity. A new
cookie-attribute regression failed against the original preview: its HTTP
response incorrectly carried `Secure`. A separate in-app browser on IPv6
loopback accepted the cookie, illustrating why one browser's result alone was
not sufficient evidence of compatibility.

## Decision

- Add `pnpm preview` for local checks of the production build. It binds only to
  loopback and supplies an HTTP protocol header before adapter-node processes
  each request. It overwrites any client value for that internal header.
- Use adapter-node's exported server so its normal request handling, timers
  and shutdown remain in use. Resolve generated modules at runtime rather than
  pulling build artifacts into source type checking.
- Keep `pnpm start` and Fly's trusted `x-forwarded-proto` configuration for
  deployment. Do not disable `Secure` cookies globally.
- Assert credential attributes against the browser-facing URL, and check that
  a newly created host can open and reload their room. CI's HTTP test client
  explicitly simulates Fly's trusted proxy via `APP_PROTOCOL_HEADER`; direct
  local-preview checks leave that option unset.

The installed SvelteKit 3 / adapter-node 6 no longer reads the old runtime
`ORIGIN` variable. An initial attempt using that setting still failed the
regression and was replaced. This agrees with the current
[adapter documentation](https://svelte.dev/docs/kit/adapter-node#PROTOCOL_HEADER-HOST_HEADER-and-PORT_HEADER).

## Local use and verification

```sh
pnpm build
PORT=8082 pnpm preview
# in another terminal
APP_URL=http://127.0.0.1:8082 pnpm check
```

The existing 8082 preview was restarted with the same temporary database.
`pnpm check` passed all 54 tests in 10 files, with zero Svelte errors or
warnings. The credential protocol assertion failed before the fix and passed
afterward. The browser Host form created a room, displayed host-only question
controls, and retained access after reload. The browser check used an existing
identity; first-time credential attributes and navigation were separately
checked by the regression tests.

The 7 identity tests also passed against a separate production-build server
configured with Fly's protocol header, using the CI proxy-mode test setting.
A request with the trusted HTTPS protocol returned 201 with `Secure` retained.
This checks protocol handling locally; no deployment was performed.

Screenshot: [created room after reload](../../docs/design/host-created.jpg).
