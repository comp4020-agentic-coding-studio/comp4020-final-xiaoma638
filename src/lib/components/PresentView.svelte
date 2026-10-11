<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { LiveOrg } from "#lib/live.svelte.ts";
  import type { Snapshot } from "#lib/types.ts";
  import AnswerPile from "./AnswerPile.svelte";
  import ChoiceResults from "./ChoiceResults.svelte";
  import Countdown from "./Countdown.svelte";
  import OpenResults from "./OpenResults.svelte";
  import PhaseBanner from "./PhaseBanner.svelte";
  import QrCode from "./QrCode.svelte";

  // The shared screen: question, time, progress and results. It shows only
  // what every member can see, so nothing here marks the presenter's own answer.
  let { initial }: { initial: Snapshot } = $props();

  // svelte-ignore state_referenced_locally
  const live = new LiveOrg(initial);
  onMount(() => live.connect());

  const s = $derived(live.snapshot);
  const q = $derived(s.current);
  const inviteUrl = $derived.by(() => {
    const invite = new URL("/", page.url.origin);
    invite.searchParams.set("code", s.org.joinCode);
    return invite.href;
  });
  // Late joiners may still answer, so the invite stays up until the reveal.
  const showInvite = $derived(!q || q.phase === "DRAFT" || q.phase === "COLLECTING");

  let fullscreen = $state(false);
  onMount(() => {
    const sync = () => (fullscreen = document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  });
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }
</script>

<svelte:head><title>Presenting · {s.org.name}</title></svelte:head>

<div class="present">
  <header class="bar">
    <p class="org">
      <strong>{s.org.name}</strong>
      <span class="muted">{s.org.memberCount} {s.org.memberCount === 1 ? "member" : "members"}</span>
      <span class="live live-{live.connection}" role="status">
        <span class="dot" aria-hidden="true"></span>
        {#if live.connection === "live"}Live{:else if live.connection === "connecting"}Syncing…{:else}Reconnecting…{/if}
      </span>
    </p>
    <div class="tools">
      <button class="ghost small" onclick={toggleFullscreen}>{fullscreen ? "Exit full screen" : "Full screen"}</button>
      <a class="ghost-link" href="/o/{s.org.id}">Back to room</a>
    </div>
  </header>

  {#if live.gone}
    <p class="status bad" role="alert">This review space is no longer available to you.</p>
  {/if}

  <div class="stage" class:with-invite={showInvite}>
    <section class="main" aria-labelledby="present-h">
      {#if !q}
        <h1 id="present-h" class="prompt quiet">Waiting for the next question</h1>
      {:else}
        <PhaseBanner phase={q.phase} kind={q.kind} />
        <h1 id="present-h" class="prompt">{q.prompt}</h1>

        {#if q.phase === "DRAFT"}
          <p class="lead muted">Starting soon. Join now to be ready.</p>
        {:else if q.phase === "COLLECTING" && q.deadline}
          <div class="progress">
            <div class="clock">
              <Countdown deadline={q.deadline} durationSec={q.durationSec} serverNow={() => live.serverNow()} />
            </div>
            <p class="submitted" aria-live="polite">
              {#key q.submittedCount}<span class="num bump">{q.submittedCount}</span>{/key}
              {q.submittedCount === 1 ? "response submitted" : "responses submitted"}
            </p>
          </div>
          <div class="pile-wrap"><AnswerPile count={q.submittedCount} size="large" /></div>
        {:else if q.results}
          <div class="results">
            {#if q.results.kind === "choice"}
              <ChoiceResults results={q.results} myOptionId={null} />
            {:else}
              <OpenResults results={q.results} canLike={false} presenting />
            {/if}
          </div>
        {/if}
      {/if}
    </section>

    {#if showInvite}
      <aside class="invite" aria-labelledby="invite-h">
        <h2 id="invite-h">Scan to join</h2>
        <QrCode value={inviteUrl} label="QR code for the invite link to {s.org.name}" />
        <p class="code-label">or enter code</p>
        <p class="code">{s.org.joinCode}</p>
      </aside>
    {/if}
  </div>
</div>

<style>
  /* Larger type everywhere on the shared screen, including shared components. */
  :global(html:has(.present)) { font-size: clamp(16px, 1.15vw, 24px); }
  :global(main:has(.present)) { max-width: none; padding: 0; }

  .present { min-height: 100vh; display: flex; flex-direction: column; padding: 1.25rem clamp(16px, 3vw, 3rem) 2rem; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .org { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin: 0; }
  .org strong { font-family: var(--font-display); font-size: 1.2rem; }
  .tools { display: flex; gap: 0.5rem; align-items: center; }
  .small { min-height: 44px; padding: 0.35rem 0.8rem; font-size: 0.9rem; }
  .ghost-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 0.75rem; color: var(--muted); font-size: 0.9rem; text-decoration: none; }
  .ghost-link:hover { color: var(--accent); }
  .live { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700; }
  .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; }
  .live-live { color: var(--ok); }
  .live-connecting { color: var(--muted); }
  .live-lost { color: var(--bad); }

  .stage { flex: 1; display: grid; gap: clamp(1.5rem, 4vw, 4rem); align-items: center; margin-top: 2rem; }
  .stage.with-invite { grid-template-columns: minmax(0, 1fr) minmax(14rem, 20rem); }
  .main { min-width: 0; }
  .prompt { font-size: clamp(2rem, 4.5vw, 3.6rem); line-height: 1.15; margin: 1rem 0 2rem; overflow-wrap: anywhere; }
  .prompt.quiet { color: var(--muted); }
  .lead { font-size: 1.3rem; }

  .progress { display: flex; align-items: flex-end; gap: clamp(2rem, 6vw, 5rem); flex-wrap: wrap; }
  .clock :global(.time), .clock :global(.final) { font-size: clamp(4rem, 9vw, 7.5rem); }
  .submitted { margin: 0; font-size: 1.2rem; color: var(--muted); }
  .submitted .num { display: block; font-family: var(--font-display); font-size: clamp(3rem, 6vw, 5rem); font-weight: 650; line-height: 1; color: var(--ink); }

  .bump { animation: bump 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3); }
  @keyframes bump { 30% { transform: scale(1.18); color: var(--phase-collecting); } }
  .pile-wrap { margin-top: 2.5rem; }
  .results { max-width: 64rem; }
  .results :global(.wall) { grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); }

  .invite { padding: 1.5rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); text-align: center; }
  .invite h2 { margin: 0 0 1rem; font-size: 1.3rem; }
  .code-label { margin: 1rem 0 0.2rem; color: var(--muted); font-size: 0.9rem; }
  .code { margin: 0; font-family: var(--font-mono); font-size: clamp(1.8rem, 3vw, 2.6rem); font-weight: 700; letter-spacing: 0.16em; user-select: all; }

  @media (max-width: 760px) {
    .stage.with-invite { grid-template-columns: 1fr; }
    .invite { max-width: 20rem; width: 100%; margin: 0 auto; }
  }
</style>
