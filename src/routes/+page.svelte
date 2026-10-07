<script lang="ts">
  import { goto } from "$app/navigation";
  import { api, ApiError } from "#lib/live.svelte.ts";
  import { LIMITS } from "#lib/domain/rules.ts";

  let { data } = $props();
  let mode = $state<"join" | "host">("join");
  let createName = $state("");
  let createNick = $state("");
  // The form starts with the invitation code, then keeps the user's local edits.
  // svelte-ignore state_referenced_locally
  let joinCode = $state(data.inviteCode);
  let joinNick = $state("");
  let createError = $state("");
  let joinError = $state("");
  let busy = $state(false);

  $effect(() => {
    const invite = data.inviteCode;
    if (invite) {
      joinCode = invite;
      mode = "join";
    }
  });

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    createError = "";
    try {
      const { orgId } = await api<{ orgId: string }>("POST", "/api/orgs", { name: createName, nickname: createNick });
      await goto(`/o/${orgId}`);
    } catch (err) {
      createError = err instanceof ApiError ? err.message : "Couldn't create your review. Please try again.";
    } finally { busy = false; }
  }

  async function join(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    joinError = "";
    try {
      const { orgId } = await api<{ orgId: string }>("POST", "/api/join", { code: joinCode.trim(), nickname: joinNick });
      await goto(`/o/${orgId}`);
    } catch (err) {
      joinError = err instanceof ApiError ? err.message : "Couldn't join this review. Please try again.";
    } finally { busy = false; }
  }
</script>

<svelte:head>
  <title>Silent Review Wall</title>
  <meta name="description" content="Private answers. A shared reveal. A quiet space for group feedback." />
</svelte:head>

<section class="hero" aria-labelledby="intro-h">
  <div class="pitch">
    <h1 id="intro-h">Answer alone.<br /><em>Reveal together.</em></h1>
    <p class="lede">A quiet space for group feedback.</p>
    <div class="paper-stack" aria-hidden="true">
      <div class="paper one"><i></i><i></i><i></i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" /><path d="m9 12 2 2 4-4" /></svg></div>
      <div class="paper two"><i></i><i></i><i></i><svg viewBox="0 0 24 24"><path d="M5 17V9m7 8V5m7 12v-6" /></svg></div>
      <div class="paper three"><i></i><i></i><i></i><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" /></svg></div>
    </div>
  </div>

  <section class="entry card" aria-label="Get started">
    <div class="entry-switch" role="group" aria-label="Join or host a review">
      <button type="button" aria-label="Join a review" aria-pressed={mode === "join"} disabled={busy} onclick={() => (mode = "join")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5v16h-5M4 12h11m-4-4 4 4-4 4" /></svg>Join</button>
      <button type="button" aria-label="Host a review" aria-pressed={mode === "host"} disabled={busy} onclick={() => (mode = "host")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8m-4-4h8" /></svg>Host</button>
    </div>
    {#if mode === "join"}
      <form onsubmit={join} aria-label="Join a review" aria-busy={busy}>
        <fieldset disabled={busy}>
          <label for="join-code">Join code</label>
          <input id="join-code" class="code-input" type="text" bind:value={joinCode} autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" required />
          <label for="join-nick">Nickname</label>
          <input id="join-nick" type="text" bind:value={joinNick} maxlength={LIMITS.nickname} autocomplete="nickname" placeholder="e.g. Alex" required />
          {#if joinError}<p class="status bad" role="alert">{joinError}</p>{/if}
          <button type="submit" class="wide">{busy ? "Joining…" : "Join review"}<span aria-hidden="true">→</span></button>
        </fieldset>
      </form>
    {:else}
      <form onsubmit={create} aria-label="Host a review" aria-busy={busy}>
        <fieldset disabled={busy}>
          <label for="org-name">Space name</label>
          <input id="org-name" type="text" bind:value={createName} maxlength={LIMITS.orgName} placeholder="e.g. Friday crit" required />
          <label for="create-nick">Nickname</label>
          <input id="create-nick" type="text" bind:value={createNick} maxlength={LIMITS.nickname} autocomplete="nickname" placeholder="e.g. Alex" required />
          {#if createError}<p class="status bad" role="alert">{createError}</p>{/if}
          <button type="submit" class="wide">{busy ? "Creating…" : "Create space"}<span aria-hidden="true">→</span></button>
        </fieldset>
      </form>
    {/if}
      <details class="entry-help">
        <summary><span>No account needed</span><span class="help-label">How it works</span></summary>
        <div class="help-content">
          <ol>
            <li>Join with your host's code, or create a space.</li>
            <li>Answer privately. Everyone sees the results when time is up.</li>
            <li>Compare votes or like written answers to discuss.</li>
          </ol>
          <p>Answers appear without names. This browser remembers you; switching browsers or clearing its data creates a new identity.</p>
        </div>
      </details>
  </section>
</section>

{#if data.orgs.length > 0}
  <section class="returning" aria-labelledby="mine">
    <h2 id="mine">Your spaces</h2>
    <ul class="orgs">
      {#each data.orgs as org (org.id)}
        <li><a href="/o/{org.id}">
          <span class="space-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="7" y="7" width="12" height="12" rx="2" /><path d="M15 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg></span>
          <strong>{org.name}</strong>
          {#if org.isHost}<span class="role">Host</span>{/if}
          <span class="space-arrow" aria-hidden="true">→</span>
        </a></li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .hero { max-width: 61rem; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: clamp(2rem, 6vw, 5rem); align-items: center; padding: clamp(2rem, 6vh, 4.5rem) 0 3rem; }
  h1 { font-size: clamp(2.7rem, 4.5vw, 3.8rem); line-height: 1.1; letter-spacing: -0.035em; margin: 0 0 1.2rem; }
  h1 em { color: var(--accent); font-weight: 500; }
  .lede { margin: 0; color: var(--ink-soft); font-size: 1.08rem; }
  .paper-stack { display: flex; align-items: center; height: 9rem; margin: 1.75rem 0 0 0.25rem; max-width: 20rem; }
  .paper { flex: 1; min-width: 0; height: 7.5rem; border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent); border-radius: 10px; padding: 1.2rem 1rem; box-shadow: var(--shadow); }
  .paper i { display: block; height: 3px; border-radius: 4px; background: currentColor; opacity: 0.24; margin-bottom: 0.55rem; }
  .paper i:nth-child(2) { width: 75%; }
  .paper i:nth-child(3) { width: 45%; }
  .paper svg { display: block; margin: 0.6rem 0 0 auto; width: 1.6rem; height: 1.6rem; fill: none; stroke: var(--ink-soft); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .one { background: var(--note-1); transform: rotate(-8deg); }
  .two { background: var(--note-3); transform: rotate(2deg) translateY(-7px); margin-left: -0.25rem; z-index: 1; }
  .three { background: var(--note-4); transform: rotate(8deg); margin-left: -0.25rem; }
  .entry { margin: 0; padding: 1.6rem; border-radius: 20px; border-color: color-mix(in srgb, var(--line-strong) 55%, var(--line)); box-shadow: 0 12px 32px -20px color-mix(in srgb, var(--ink) 30%, transparent), var(--shadow-s); }
  .entry-switch { display: flex; padding: 4px; gap: 4px; background: var(--control); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 1.4rem; }
  .entry-switch button { flex: 1; gap: 0.5rem; padding: 0.55rem; background: transparent; border-color: transparent; color: var(--ink-soft); box-shadow: none; font-size: 0.95rem; border-radius: 8px; }
  .entry-switch svg { width: 1.15rem; height: 1.15rem; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }
  .entry-switch button[aria-pressed="true"] { color: var(--accent); background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 70%, var(--accent-soft)); box-shadow: var(--shadow-s); }
  .entry-switch button:hover:not(:disabled) { color: var(--accent); background: var(--accent-soft); border-color: var(--accent); }
  .entry fieldset { margin: 0; }
  .entry label { font-size: 0.88rem; margin-top: 1.15rem; }
  .entry label:first-child { margin-top: 0; }
  .entry input { min-height: 50px; }
  .code-input { font-family: var(--font-mono); font-size: 1.3rem; letter-spacing: 0.22em; text-transform: uppercase; }
  .wide { width: 100%; min-height: 50px; margin-top: 1.35rem; justify-content: space-between; padding: 0.7rem 1rem; }
  .entry-help { border-top: 1px solid var(--line); margin-top: 1.25rem; padding-top: 0.4rem; font-size: 0.77rem; color: var(--muted); }
  .entry-help summary { min-height: 44px; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; cursor: pointer; }
  .help-label { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--ink-soft); }
  .help-label::after { content: "+"; font-size: 1rem; }
  .entry-help[open] .help-label::after { content: "−"; }
  .entry-help summary::-webkit-details-marker { display: none; }
  .help-content { font-size: 0.84rem; color: var(--ink-soft); }
  .help-content ol { padding-left: 1.2rem; margin: 0.5rem 0 1rem; }
  .help-content li { margin-bottom: 0.6rem; }
  .help-content p { margin: 0; }
  .returning { max-width: 61rem; margin: 0 auto; border-top: 1px solid var(--line); padding-top: 1.5rem; }
  .returning h2 { font-family: var(--font-body); font-size: 0.9rem; font-weight: 600; color: var(--muted); margin-bottom: 1rem; }
  .orgs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
  .orgs a { display: flex; align-items: center; gap: 0.85rem; min-height: 72px; padding: 0.9rem 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: var(--ink); transition: border-color 0.15s, background 0.15s; }
  .orgs a:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent-soft) 30%, var(--surface)); }
  .orgs strong { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 0.95rem; }
  .space-icon { flex: none; width: 2.2rem; height: 2.2rem; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); border-radius: 8px; }
  .space-icon svg { width: 1.2rem; height: 1.2rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .role { color: var(--muted); font-size: 0.8rem; }
  .space-arrow { display: grid; place-items: center; flex: none; width: 1.8rem; height: 1.8rem; color: var(--accent); font-size: 1.1rem; }
  @media (max-width: 760px) {
    .hero { max-width: 28rem; grid-template-columns: 1fr; gap: 1.4rem; padding: 1.25rem 0 1.5rem; }
    .pitch { text-align: center; }
    h1 { font-size: clamp(2.3rem, 8.5vw, 3.5rem); margin-bottom: 0.8rem; }
    .lede { font-size: 0.95rem; }
    .paper-stack { display: none; }
    .entry { padding: 1.15rem; border-radius: 16px; }
    .entry-switch { margin-bottom: 1.15rem; }
    .entry label { margin-top: 1rem; }
    .entry-help { margin-top: 1rem; }
    .orgs { grid-template-columns: 1fr; }
    .returning { max-width: 28rem; }
  }
</style>
