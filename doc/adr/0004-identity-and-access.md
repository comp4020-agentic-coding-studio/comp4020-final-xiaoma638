# 4. Browser identities, membership checks, JSON-only writes

Status: accepted (2026-10-06)

## Context

There are no accounts. The server has to tell participants apart, keep host
rights to the creator, and stop object ids from working across organizations.

## Decision

- **Identity**: on first create or join, the server makes a random participant
  id and gives the browser a 32-byte random credential in an `httpOnly`,
  `SameSite=Lax` cookie (`Secure` over https). Only the credential's SHA-256
  is stored. Reading pages never creates an identity.
- **Membership**: every org-scoped read, write and subscription checks
  membership on the server. Non-members get the same `404` as for an id that
  doesn't exist, so ids reveal nothing. A join code grants membership only;
  rejoining never changes a role.
- **CSRF**: every write requires `Content-Type: application/json`
  (`readJson` in `src/lib/server/errors.ts`). A cross-site page can't send that
  without a CORS preflight, which the app never answers, and the cookie is
  `SameSite=Lax` as well. SvelteKit's own origin check wasn't usable as the
  defence: `adapter-node` assumes `https` when no protocol header is present,
  so it refuses plain-http writes in CI and local runs.
- **Logs**: ids, outcomes and timings only. No credentials, join codes,
  answer text, chosen options or keywords. Routes are logged by route id, not
  raw URL.

## Alternatives

- **Accounts or magic links**: much more surface area for a classroom tool,
  and they put real names in the data.
- **403 for non-members**: it would confirm to a guesser that an org exists.

## Consequences

- Clearing cookies or switching browsers makes a new identity. The home page
  and org page say so.
- Hiding nicknames on results isn't anonymity: the server knows each answer's
  author, which it needs to enforce one answer per person and no self-likes.
  The org page says this too.
- There's no rate limit on join attempts yet. A six-character code from a
  31-letter alphabet is about 887 million combinations.
