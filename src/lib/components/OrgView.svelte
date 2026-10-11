<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { page } from "$app/state";
  import { LIMITS } from "#lib/domain/rules.ts";
  import { api, ApiError, LiveOrg } from "#lib/live.svelte.ts";
  import type { QuestionView, Snapshot } from "#lib/types.ts";
  import AnswerPile from "./AnswerPile.svelte";
  import ChoiceResults from "./ChoiceResults.svelte";
  import Composer from "./Composer.svelte";
  import Countdown from "./Countdown.svelte";
  import ExportResults from "./ExportResults.svelte";
  import OpenResults from "./OpenResults.svelte";
  import PhaseBanner from "./PhaseBanner.svelte";
  import QrCode from "./QrCode.svelte";
  import ResponseForm from "./ResponseForm.svelte";

  let { initial }: { initial: Snapshot } = $props();

  // svelte-ignore state_referenced_locally
  const live = new LiveOrg(initial);
  onMount(() => live.connect());

  const s = $derived(live.snapshot);
  const q = $derived(s.current);
  const refresh = () => void live.refresh();

  // Drafts are the host's queue; the first one is offered in the stage when nothing is live.
  const next = $derived(s.queue[0] ?? null);
  const rest = $derived(q ? s.queue : s.queue.slice(1));
  let editingId = $state<string | null>(null);
  let adding = $state(false);

  function durationText(sec: number): string {
    if (sec === LIMITS.untimed) return "No time limit";
    return sec % 60 === 0 ? `${sec / 60} min` : `${sec} sec`;
  }

  async function removeDraft(d: QuestionView) {
    if (!confirm(`Delete “${d.prompt}”? This can't be undone.`)) return;
    await act(`/api/questions/${d.id}`, "DELETE");
  }
  let actionError = $state("");
  let acting = $state(false);
  let copied = $state(false);
  let copyError = $state("");
  let copyTimer: ReturnType<typeof setTimeout>;
  let qrDialog = $state<HTMLDialogElement | null>(null);
  // The link fills in the join form; it never joins on its own.
  const inviteUrl = $derived.by(() => {
    const invite = new URL("/", page.url.origin);
    invite.searchParams.set("code", s.org.joinCode);
    return invite.href;
  });
  onMount(() => () => clearTimeout(copyTimer));
  // Keep response editors mounted for this visit, even when the host closes
  // a question. Only editors with an unsaved draft render after the reveal.
  let responseQuestions = $state<QuestionView[]>([]);
  $effect(() => {
    const current = q;
    if (!current || current.phase === "DRAFT") return;
    untrack(() => {
      const index = responseQuestions.findIndex((item) => item.id === current.id);
      if (index === -1) responseQuestions.push(current);
      else responseQuestions[index] = current;
    });
  });

  async function act(path: string, method = "POST") {
    if (acting) return;
    acting = true;
    actionError = "";
    try {
      await api(method, path);
      refresh();
    } catch (err) {
      actionError = err instanceof ApiError ? err.message : "That didn't work.";
    } finally {
      acting = false;
    }
  }

  async function copyInvite() {
    copyError = "";
    try {
      await navigator.clipboard.writeText(inviteUrl);
      clearTimeout(copyTimer);
      copied = true;
      copyTimer = setTimeout(() => (copied = false), 2000);
    } catch {
      copyError = "Select the code above and copy it to invite your group.";
    }
  }
</script>

<svelte:head><title>{s.org.name} · Silent Review Wall</title></svelte:head>

<div class="review-shell">
<a class="back" href="/">← All spaces</a>
<header class="org" class:member={!s.me.isHost}>
  <div class="who">
    <h1>{s.org.name}</h1>
    <p class="meta">
      <strong>{s.me.nickname}</strong>
      {#if s.me.isHost}<span class="pill accent">host</span>{/if}
      <span class="sep" aria-hidden="true">·</span>
      <span>{s.org.memberCount} {s.org.memberCount === 1 ? "member" : "members"}</span>
      <span class="live live-{live.connection}" role="status">
        <span class="dot" aria-hidden="true"></span>
        {#if live.connection === "live"}Live{:else if live.connection === "connecting"}Syncing…{:else}Reconnecting…{/if}
      </span>
    </p>
  </div>
  {#if s.me.isHost}
  <div class="invite">
    <div class="ticket">
      <span class="ticket-label">Join code</span>
      <strong class="code">{s.org.joinCode}</strong>
      <button class="secondary small" onclick={copyInvite} aria-label={copied ? "Invite link copied" : "Copy invite link"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)" /></svg>
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <button class="secondary small icon" onclick={() => qrDialog?.showModal()} aria-label="Show QR code" aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 17h4v4h-4" /></svg>
      </button>
    </div>
    {#if s.me.isHost}
      <a class="present-link" href="/o/{s.org.id}/present" target="_blank" rel="noopener">Present on a big screen <span aria-hidden="true">↗</span></a>
    {/if}
    {#if copyError}<p class="invite-hint" role="alert">{copyError}</p>{/if}
  </div>
  {:else}
    <!-- Members already joined: inviting is occasional, so it stays one tap away instead of taking a row above the question. -->
    <button class="secondary small member-invite" onclick={() => qrDialog?.showModal()} aria-haspopup="dialog">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 17h4v4h-4" /></svg>
      Invite
    </button>
  {/if}
  <span class="visually-hidden" role="status">{copied ? "Invite link copied" : ""}</span>
</header>

{#if live.connection === "lost"}
  <p class="status warn" role="alert">Connection lost. Reconnecting automatically…</p>
{/if}
{#if live.gone}
  <p class="status bad" role="alert">You're no longer a member of this review space, or it no longer exists.</p>
{/if}

<dialog class="qr-dialog" bind:this={qrDialog} aria-labelledby="qr-h" onclick={(e) => { if (e.target === qrDialog) qrDialog?.close(); }}>
  <h2 id="qr-h">Scan to join</h2>
  <QrCode value={inviteUrl} label="QR code for the invite link to {s.org.name}" />
  <p class="qr-code"><span class="ticket-label">Join code</span> <strong class="code">{s.org.joinCode}</strong></p>
  {#if !s.me.isHost}
    <button class="secondary" onclick={copyInvite}>{copied ? "Copied ✓" : "Copy invite link"}</button>
    {#if copyError}<p class="invite-hint" role="alert">{copyError}</p>{/if}
  {/if}
  <button class="secondary" onclick={() => qrDialog?.close()}>Close</button>
</dialog>

{#snippet draftSummary(d: QuestionView)}
  {#if d.kind === "choice"}
    <ol class="preview-opts">{#each d.options as o (o.id)}<li>{o.label}</li>{/each}</ol>
  {/if}
  <p class="draft-note">{d.kind === "choice" ? "Single choice" : "Open answer"} · {durationText(d.durationSec)}</p>
{/snippet}

<section class="card stage" style:--stage-color="var(--phase-{q?.phase.toLowerCase() ?? 'draft'})" aria-labelledby="current-h">
  {#if !q}
    {#if s.me.isHost && next && editingId === next.id}
      <h2 id="current-h">Edit question</h2>
      <Composer orgId={s.org.id} draft={next} oncancel={() => (editingId = null)} onchange={() => { editingId = null; refresh(); }} />
    {:else if s.me.isHost && next}
      <p class="eyebrow">Up next{s.queue.length > 1 ? ` · 1 of ${s.queue.length}` : ""}</p>
      <h2 id="current-h" class="prompt">{next.prompt}</h2>
      {@render draftSummary(next)}
      <div class="host-bar">
        <button onclick={() => act(`/api/questions/${next.id}/start`)} disabled={acting}>{acting ? "Starting…" : "Start question"}<span aria-hidden="true">→</span></button>
        <button class="secondary" onclick={() => (editingId = next.id)} disabled={acting}>Edit</button>
      </div>
    {:else if s.me.isHost}
      <h2 id="current-h">New question</h2>
      <Composer orgId={s.org.id} onchange={refresh} />
    {:else}
      <div class="waiting">
        <div class="pulse" aria-hidden="true"></div>
        <h2 id="current-h">Waiting for the host</h2>
        <p class="muted">The next question will appear automatically.</p>
      </div>
    {/if}
  {:else}
    <PhaseBanner phase={q.phase} kind={q.kind} timed={q.deadline !== null} />
    <h2 id="current-h" class="prompt">{q.prompt}</h2>

    {#if q.phase === "COLLECTING"}
      <div class="live-stats">
        {#if q.deadline}
          <Countdown deadline={q.deadline} durationSec={q.durationSec} serverNow={() => live.serverNow()} />
        {:else}
          <p class="no-limit">No time limit</p>
        {/if}
        <div class="answered">
          <AnswerPile count={q.submittedCount} />
          <p>{#key q.submittedCount}<span class="big num bump">{q.submittedCount}</span>{/key} <span class="muted">{q.submittedCount === 1 ? "response submitted" : "responses submitted"}</span></p>
        </div>
      </div>
      {#if s.me.isHost && !q.deadline}
        <div class="host-bar reveal-bar">
          <button onclick={() => act(`/api/questions/${q.id}/reveal`)} disabled={acting}>{acting ? "Revealing…" : "Reveal answers"}</button>
          <span class="hint">Locks answers and shows them to everyone.</span>
        </div>
      {/if}
    {/if}
  {/if}

  {#each responseQuestions as responseQuestion (responseQuestion.id)}
    <ResponseForm
      question={q?.id === responseQuestion.id ? responseQuestion : { ...responseQuestion, phase: "CLOSED" }}
      archived={q?.id !== responseQuestion.id}
      onchange={refresh}
    />
  {/each}

    {#if q?.results}
      {#if q.results.kind === "choice"}
        <ChoiceResults results={q.results} myOptionId={q.myResponse?.optionId ?? null} />
      {:else}
        <OpenResults results={q.results} canLike={q.phase === "REVEALED"} onchange={refresh} />
      {/if}
      {#if q.results.total > 0}<ExportResults prompt={q.prompt} results={q.results} />{/if}
      {#if s.me.isHost && q.phase === "REVEALED"}
        <div class="host-bar end">
          <button class="secondary" onclick={() => act(`/api/questions/${q.id}/close`)} disabled={acting}>{acting ? "Closing…" : "Finish discussion"}</button>
          <span class="hint">{q.kind === "open" ? "Saves results and locks likes." : "Saves results."}{next ? ` Then: “${next.prompt}”` : ""}</span>
        </div>
      {/if}
    {/if}

  {#if actionError}<p class="status bad" role="alert">{actionError}</p>{/if}
</section>

{#if s.me.isHost && (q || s.queue.length > 0)}
  <!-- The host's queue. Members never receive drafts, so this is host-only by data, not just by styling. -->
  <section class="queue" aria-labelledby="queue-h">
    <h2 id="queue-h">{q ? "Up next" : "Later"}{rest.length ? ` (${rest.length})` : ""}</h2>
    {#if rest.length > 0}
      <ol class="queue-list">
        {#each rest as d, i (d.id)}
          <li class:editing={editingId === d.id}>
            {#if editingId === d.id}
              <Composer orgId={s.org.id} draft={d} oncancel={() => (editingId = null)} onchange={() => { editingId = null; refresh(); }} />
            {:else}
              <span class="q-num num" aria-hidden="true">{i + (q ? 1 : 2)}</span>
              <span class="q-body">
                <span class="q-prompt">{d.prompt}</span>
                <span class="q-meta">{d.kind === "choice" ? `Single choice · ${d.options.length} options` : "Open answer"} · {durationText(d.durationSec)}</span>
              </span>
              <span class="q-actions">
                {#if !q}<button class="ghost small" onclick={() => act(`/api/questions/${d.id}/start`)} disabled={acting} aria-label="Start “{d.prompt}” now">Start</button>{/if}
                <button class="ghost small" onclick={() => (editingId = d.id)} disabled={acting} aria-label="Edit “{d.prompt}”">Edit</button>
                <button class="ghost small danger" onclick={() => removeDraft(d)} disabled={acting} aria-label="Delete “{d.prompt}”">Delete</button>
              </span>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}
    {#if adding}
      <div class="queue-add">
        <h3>Add a question</h3>
        <Composer orgId={s.org.id} oncancel={() => (adding = false)} onchange={() => { adding = false; refresh(); }} />
      </div>
    {:else}
      <button class="secondary add" onclick={() => (adding = true)}>+ Add question</button>
    {/if}
  </section>
{/if}

{#if s.history.length > 0}
  <section class="history" aria-labelledby="history-h">
    <h2 id="history-h">History</h2>
    <ul>
      {#each s.history as h (h.id)}
        <li>
          <a href="/o/{s.org.id}/q/{h.id}">
            <span class="h-prompt">{h.prompt}</span>
            <span class="h-meta">
              <span class="num">{h.submittedCount} {h.submittedCount === 1 ? "answer" : "answers"}</span>
              <span aria-hidden="true">↗</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<details class="disclosure privacy-help">
  <summary>Privacy &amp; access</summary>
  <p>Answers are hidden until reveal and shown without names. This browser identifies you, so you can edit your own answer and cannot like it. Switching browsers creates a new identity.</p>
</details>
</div>

<style>
  .review-shell { max-width: 52rem; margin: 0 auto; }
  .back { display: inline-flex; align-items: center; min-height: 44px; font-size: 0.85rem; text-decoration: none; color: var(--muted); margin-bottom: 0.7rem; }
  .back:hover { color: var(--accent); }
  .org { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin: 0.25rem 0 1.25rem; }
  .who { min-width: 0; flex: 1 1 20rem; }
  .who h1 { margin-bottom: 0.4rem; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; margin: 0; color: var(--muted); }
  .meta strong { color: var(--ink); }
  .sep { color: var(--line-strong); }
  .live {
    display: inline-flex; align-items: center; gap: 0.35rem;
    margin-left: 0.25rem;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 700;
    background: transparent;
    border: 1px solid transparent;
  }
  .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; }
  .live-live { color: var(--ok); }
  .live-connecting { color: var(--muted); }
  .live-lost { color: var(--bad); border-color: var(--bad); }

  .invite { max-width: 26rem; }
  .org.member { flex-wrap: nowrap; align-items: flex-start; }
  .org.member .who { flex: 1 1 auto; }
  .member-invite { flex: none; margin-top: 0.35rem; }
  .qr-dialog button + button { margin-top: 0.5rem; }
  .invite-hint { font-size: 0.74rem; color: var(--muted); margin: 0.45rem 0 0; max-width: 24rem; }
  .ticket {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.4rem 0.45rem 0.4rem 0.85rem;
    background: color-mix(in srgb, var(--surface) 55%, var(--paper));
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  @media (max-width: 560px) {
    .invite { width: 100%; max-width: none; }
    .ticket { width: 100%; justify-content: space-between; }
  }
  .ticket-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .code { font-family: var(--font-mono); font-size: 1.2rem; letter-spacing: 0.14em; color: var(--ink); user-select: all; }
  .small { min-height: 44px; padding: 0.35rem 0.8rem; font-size: 0.9rem; }
  .icon { min-width: 44px; padding: 0.35rem; justify-content: center; }
  .present-link { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 44px; font-size: 0.85rem; color: var(--muted); text-decoration: none; }
  .present-link:hover { color: var(--accent); }
  .qr-dialog {
    width: min(22rem, calc(100vw - 32px));
    padding: 1.5rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
    text-align: center;
  }
  .qr-dialog::backdrop { background: rgb(0 0 0 / 0.45); }
  .qr-dialog h2 { margin: 0 0 1rem; font-size: 1.3rem; }
  .qr-code { display: flex; justify-content: center; align-items: baseline; gap: 0.6rem; margin: 1rem 0; }
  .qr-dialog button { width: 100%; }

  .stage { margin-top: 0; padding: clamp(1.25rem, 4vw, 2rem); border-top: 3px solid color-mix(in srgb, var(--stage-color) 65%, var(--line)); }
  .prompt { font-size: clamp(1.5rem, 3.6vw, 2rem); margin: 1.4rem 0 1.5rem; line-height: 1.3; }
  .eyebrow { margin: 0 0 0.25rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .no-limit { margin: 0; font-family: var(--font-display); font-size: clamp(1.4rem, 5vw, 1.8rem); font-weight: 600; color: var(--muted); }
  .reveal-bar { margin: 0 0 1.1rem; padding-bottom: 1.1rem; border-bottom: 1px solid var(--line); }
  .queue { margin-top: 1.5rem; }
  .queue h2 { font-family: var(--font-body); font-size: 0.9rem; color: var(--muted); margin-bottom: 0.6rem; }
  .queue-list { list-style: none; padding: 0; margin: 0 0 0.75rem; display: grid; gap: 0.5rem; }
  .queue-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.6rem 0.6rem 0.85rem; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
  .queue-list li.editing { display: block; padding: 1rem; }
  .q-num { flex: none; width: 1.7rem; height: 1.7rem; display: grid; place-items: center; border-radius: 999px; background: var(--paper); border: 1px solid var(--line-strong); font-size: 0.8rem; font-weight: 700; color: var(--muted); }
  .q-body { flex: 1; min-width: 0; display: grid; gap: 0.1rem; }
  .q-prompt { font-weight: 600; overflow-wrap: anywhere; }
  .q-meta { font-size: 0.8rem; color: var(--muted); }
  .q-actions { flex: none; display: flex; gap: 0.15rem; }
  .q-actions .danger { color: var(--bad); }
  .q-actions .danger:hover:not(:disabled) { background: var(--bad-soft); color: var(--bad); }
  .queue-add { padding: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
  .queue-add h3 { margin: 0 0 0.75rem; font-size: 1.05rem; }
  .add { width: 100%; border-style: dashed; }
  @media (max-width: 560px) {
    .queue-list li:not(.editing) { flex-wrap: wrap; }
    .q-actions { width: 100%; justify-content: flex-end; }
  }
  .preview-opts { margin: 0 0 1rem; padding-left: 1.4rem; }
  .preview-opts li { margin: 0.25rem 0; }
  .draft-note { color: var(--muted); font-size: 0.9rem; margin: 1.25rem 0; }
  .host-bar { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; margin-top: 1rem; }
  .host-bar.end { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--line); }

  .live-stats { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding-bottom: 1.1rem; margin-bottom: 1.1rem; border-bottom: 1px solid var(--line); }
  .answered { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; justify-content: flex-end; }
  .answered p { margin: 0; font-size: 0.85rem; }
  .bump { display: inline-block; animation: bump 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3); }
  @keyframes bump { 30% { transform: scale(1.3); color: var(--phase-collecting); } }
  .answered .big { font-weight: 700; color: var(--ink); margin-right: 0.2rem; }

  .waiting { text-align: center; padding: 2rem 1rem; }
  .pulse {
    width: 3rem; height: 3rem; margin: 0 auto 1rem;
    border-radius: 50%;
    background: var(--accent-soft);
    border: 2px solid var(--accent);
    animation: breathe 2.4s ease-in-out infinite;
  }
  @keyframes breathe { 50% { transform: scale(0.82); opacity: 0.6; } }

  .history { margin-top: 2rem; }
  .history ul { list-style: none; padding: 0; margin: 0.75rem 0 0; display: grid; gap: 0.5rem; }
  .history a {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: 0.8rem 1rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-s);
    color: var(--ink);
    text-decoration: none;
    transition: border-color 0.15s;
  }
  .history a:hover { border-color: var(--accent); }
  .history a:hover .h-meta { color: var(--accent); }
  .h-prompt { font-weight: 600; min-width: 0; flex: 1 1 15rem; overflow-wrap: anywhere; }
  .h-meta { display: inline-flex; align-items: center; gap: 0.8rem; color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
  .privacy-help { margin-top: 1.5rem; }
  .history h2 { font-family: var(--font-body); font-size: 0.9rem; color: var(--muted); }
  @media (max-width: 420px) {
    .ticket { gap: 0.5rem; padding-left: 0.7rem; }
    .ticket-label { font-size: 0.65rem; letter-spacing: 0.03em; }
    .code { font-size: 1.05rem; letter-spacing: 0.1em; }
    .small { padding: 0.35rem 0.6rem; font-size: 0.8rem; }
    .org { margin-bottom: 1rem; }
    .history { margin-top: 1.5rem; }
  }
</style>
