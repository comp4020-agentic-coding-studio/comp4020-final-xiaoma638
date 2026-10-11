<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { bubbleDiameters, compareByLikes, compareBySubmission, LIMITS } from "#lib/domain/rules.ts";
  import { api, ApiError } from "#lib/live.svelte.ts";
  import type { OpenResult, Results } from "#lib/types.ts";

  let {
    results,
    canLike,
    presenting = false,
    onchange = () => {},
  }: { results: Extract<Results, { kind: "open" }>; canLike: boolean; presenting?: boolean; onchange?: () => void } = $props();

  let order = $state<"original" | "likes">("original");
  let filter = $state<string | null>(null);
  let pending = $state<Record<string, boolean>>({});
  let error = $state("");
  let wallElement = $state<HTMLOListElement | null>(null);
  // Cards flip in once, at the reveal; answers shown again by a filter just appear.
  let settled = $state(false);
  // animate:flip runs through the Web Animations API, outside the global reduced-motion CSS.
  let reorderMs = $state(420);
  onMount(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) reorderMs = 0;
    const t = setTimeout(() => (settled = true), 1600);
    return () => clearTimeout(t);
  });

  // Keys preserve answer identity; moved DOM nodes also need explicit focus recovery.
  const sorted = $derived([...results.responses].sort(order === "likes" ? compareByLikes : compareBySubmission));
  const visible = $derived(filter ? sorted.filter((r) => r.tags.includes(filter!)) : sorted);
  const responseOrder = $derived(visible.map((response) => response.id).join(","));
  // each answer keeps its note colour whatever the order, so a reorder doesn't repaint the wall
  const tint = $derived(new Map(results.responses.map((r, i) => [r.id, (i % 5) + 1])));
  const topKeyword = $derived(Math.max(1, ...results.keywords.map((k) => k.count)));
  const likesLeft = $derived(LIMITS.likesPerQuestion - results.responses.filter((r) => r.likedByMe).length);
  const diameters = $derived(bubbleDiameters(results.keywords.map((k) => k.count)));

  $effect.pre(() => {
    if (!responseOrder) return;
    untrack(() => {
      const wall = wallElement;
      const doc = wall?.ownerDocument;
      const focused = doc?.activeElement;
      if (!wall || !doc || !(focused instanceof HTMLElement) || !wall.contains(focused)) return;
      const before = focused.getBoundingClientRect();
      const scrollY = window.scrollY;
      void tick().then(() => {
        if (!focused.isConnected) return;
        // A real move to another control wins over restoring a moved answer.
        if (doc.activeElement !== focused && doc.activeElement !== doc.body) return;
        if (doc.activeElement !== focused) focused.focus({ preventScroll: true });
        if (before.bottom > 0 && before.top < window.innerHeight && window.scrollY === scrollY) {
          const shift = focused.getBoundingClientRect().top - before.top;
          if (shift) window.scrollBy({ top: shift, behavior: "instant" });
        }
      });
    });
  });

  async function toggle(r: OpenResult) {
    if (pending[r.id] || !canLike || r.mine || (!r.likedByMe && likesLeft <= 0)) return;
    pending[r.id] = true;
    error = "";
    try {
      await api("PUT", `/api/responses/${r.id}/like`, { liked: !r.likedByMe });
      if (!r.likedByMe) navigator.vibrate?.(12);
      onchange();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Couldn't save that like.";
    } finally {
      pending[r.id] = false;
    }
  }
</script>

{#if results.total === 0}
  <div class="empty">
    <p>No answers were submitted.</p>
  </div>
{:else}
  <div class="toolbar">
    <p class="count">
      <span class="big num">{results.total}</span> {results.total === 1 ? "answer" : "answers"}
      {#if canLike}<span class="budget" class:spent={likesLeft <= 0}>· {likesLeft} of {LIMITS.likesPerQuestion} likes left</span>{/if}
    </p>
    {#if results.total > 1}
      <div class="segmented" role="group" aria-label="Order answers">
        <button class="ghost" aria-pressed={order === "original"} onclick={() => (order = "original")}>Original order</button>
        <button class="ghost" aria-pressed={order === "likes"} onclick={() => (order = "likes")}>Most liked</button>
      </div>
    {/if}
  </div>
  {#if filter}
    <p class="filtered">
      <span>{visible.length} of {results.total} tagged <strong>#{filter}</strong></span>
      <button class="ghost small" onclick={() => (filter = null)}>Show all</button>
    </p>
  {/if}
  <span class="visually-hidden" role="status">{filter ? `Showing ${visible.length} of ${results.total} answers tagged ${filter}.` : ""}</span>
  {#if error}<p class="status bad" role="alert">{error}</p>{/if}

  <ol class="wall" class:settled bind:this={wallElement}>
    {#each visible as r, i (r.id)}
      <li class="note" animate:flip={{ duration: reorderMs }} style:--tint="var(--note-{tint.get(r.id)})" style:--delay="{Math.min(i, 12) * 90}ms">
        <p class="text">{r.text}</p>
        <!-- Keywords share the like row, so a card is one line taller than its text, not two. -->
        <div class="foot">
          <div class="meta">
            {#if r.mine && !presenting}<span class="mine">Your answer</span>{/if}
            {#if r.tags.length > 0}
              <ul class="tags" aria-label="Keywords">
                {#each r.tags as t (t)}<li>#{t}</li>{/each}
              </ul>
            {/if}
          </div>
          {#if canLike && !r.mine}
            <button
              class="like"
              class:spent={!r.likedByMe && likesLeft <= 0}
              aria-pressed={r.likedByMe}
              aria-disabled={pending[r.id] ?? false}
              aria-busy={pending[r.id] ?? false}
              onclick={() => toggle(r)}
            >
              {#key r.likedByMe}<span class="heart" class:pop={r.likedByMe} aria-hidden="true">{r.likedByMe ? "♥" : "♡"}</span>{/key}
              {#key r.likeCount}<span class="num tick">{r.likeCount}</span>{/key}
              <span class="visually-hidden">{r.likedByMe ? "likes, liked by you. Unlike" : likesLeft > 0 ? "likes. Like" : "likes. No likes left to give"} this answer</span>
            </button>
          {:else}
            <span class="likes num"><span aria-hidden="true">♥</span> {#key r.likeCount}<span class="tick">{r.likeCount}</span>{/key}<span class="visually-hidden"> likes</span></span>
          {/if}
        </div>
      </li>
    {/each}
  </ol>

  <details class="disclosure keywords">
    <summary>Keywords{results.keywords.length ? ` (${results.keywords.length})` : ""}</summary>
    {#if results.keywords.length === 0}
      <p>No keywords added.</p>
    {:else}
      <p class="hint">Bubble area and number show how many answers used each keyword. Select one to filter the answers.</p>
      <ul class="bubbles" aria-label="Keyword bubbles">
        {#each results.keywords as k, i (k.keyword)}
          <li style:--d="{diameters[i]}px">
            <button
              class="bubble"
              aria-pressed={filter === k.keyword}
              onclick={() => (filter = filter === k.keyword ? null : k.keyword)}
            >
              <span class="disc num" aria-hidden="true">{k.count}</span>
              <span class="bubble-label">#{k.keyword}</span>
              <span class="visually-hidden">, {k.count} {k.count === 1 ? "answer" : "answers"}</span>
            </button>
          </li>
        {/each}
      </ul>
      <ul class="kw-list" aria-label="Keyword frequencies">
        {#each results.keywords as k (k.keyword)}
          <li>
            <span class="kw">#{k.keyword}</span>
            <span class="kw-bar" aria-hidden="true"><span style:width="{(k.count / topKeyword) * 100}%"></span></span>
            <span class="num kw-n">{k.count}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </details>

{/if}

<style>
  .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0.75rem 0 1rem; }
  .count { margin: 0; color: var(--muted); }
  .big { font-family: var(--font-display); font-size: 1.8rem; font-weight: 600; color: var(--ink); margin-right: 0.2rem; }
  .segmented { display: inline-flex; padding: 3px; gap: 2px; background: var(--paper-deep); border-radius: 10px; }
  .segmented button { min-height: 44px; padding: 0.35rem 0.85rem; font-size: 0.9rem; color: var(--ink-soft); border-radius: 8px; }
  .segmented button[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); box-shadow: var(--shadow-s); }

  .wall { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
  .note {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 1.05rem 1rem 0.75rem;
    background: color-mix(in srgb, var(--tint) 60%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--tint) 70%, var(--line-strong));
    border-radius: 12px;
    box-shadow: var(--shadow-s);
    animation: flip 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: var(--delay);
    backface-visibility: hidden;
  }
  .wall { perspective: 1200px; }
  .wall.settled .note { animation: none; }
  .note:only-child { grid-column: 1 / -1; }
  @keyframes flip {
    from { opacity: 0; transform: rotateY(-90deg) scale(0.96); }
    60% { opacity: 1; }
  }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 0.4rem; font-size: 1.02rem; line-height: 1.5; color: var(--ink); }
  .foot > .like, .foot > .likes { flex: none; white-space: nowrap; }
  .meta { flex: 1 1 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.75rem; min-width: 0; }
  .tags { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.25rem 0.6rem; min-width: 0; }
  .tags li { overflow-wrap: anywhere; }
  .tags li { font-size: 0.85rem; color: var(--ink-soft); font-weight: 600; opacity: 0.8; }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; min-height: 2.25rem; margin-top: auto; }
  .mine { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-soft); opacity: 0.75; }
  .like {
    min-height: 44px;
    padding: 0.25rem 0.75rem;
    background: color-mix(in srgb, var(--surface) 70%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
    color: var(--ink-soft);
    box-shadow: none;
    font-size: 0.95rem;
  }
  .like:hover:not([aria-disabled="true"]) { background: var(--surface); border-color: var(--bad); color: var(--bad); }
  .like[aria-pressed="true"] { background: var(--bad); border-color: var(--bad); color: var(--bad-contrast); }
  .like[aria-pressed="true"]:hover:not([aria-disabled="true"]) { background: var(--bad); color: var(--bad-contrast); filter: brightness(1.08); }
  .like[aria-disabled="true"] { cursor: progress; opacity: 0.65; }
  .heart, .tick { display: inline-block; }
  .heart.pop { animation: pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.5); }
  .tick { animation: tick 0.35s ease-out; }
  @keyframes pop { 0% { transform: scale(0.4); } 50% { transform: scale(1.45); } }
  @keyframes tick { from { transform: translateY(-0.4em); opacity: 0; } }
  .like.spent { cursor: not-allowed; border-style: dashed; }
  .like.spent:hover { background: color-mix(in srgb, var(--surface) 70%, transparent); border-color: color-mix(in srgb, var(--ink) 15%, transparent); color: var(--ink-soft); }
  .budget { font-size: 0.85rem; margin-left: 0.35rem; }
  .budget.spent { color: var(--ink-soft); font-weight: 600; }
  .likes { color: var(--ink-soft); font-size: 0.95rem; opacity: 0.8; }

  .keywords { margin-top: 1rem; border-top: 1px solid var(--line); padding-top: 0.5rem; }
  .filtered { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 0.85rem; padding: 0.25rem 0.25rem 0.25rem 0.85rem; background: var(--accent-soft); border-radius: var(--radius-s); color: var(--ink-soft); font-size: 0.9rem; }
  .filtered strong { color: var(--ink); overflow-wrap: anywhere; }
  .small { min-height: 44px; padding: 0.35rem 0.8rem; font-size: 0.9rem; }

  /* Flow layout: bubbles and their labels wrap instead of overlapping. */
  .bubbles { list-style: none; padding: 0; margin: 0.75rem 0 1.25rem; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.25rem; }
  .bubble {
    display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
    min-width: 44px; max-width: max(var(--d), 9rem);
    padding: 0.25rem; background: none; border: 0; box-shadow: none; color: var(--ink);
  }
  .disc {
    display: grid; place-items: center;
    width: var(--d); height: var(--d); min-width: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--phase-revealed) 22%, var(--surface));
    border: 1.5px solid color-mix(in srgb, var(--phase-revealed) 55%, var(--line));
    font-weight: 700; font-size: clamp(0.85rem, calc(var(--d) / 4), 1.6rem); color: var(--ink);
    transition: transform 0.15s;
  }
  .bubble:hover .disc { transform: scale(1.04); }
  .bubble[aria-pressed="true"] .disc { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
  .bubble-label { font-weight: 650; font-size: 0.85rem; line-height: 1.3; text-align: center; overflow-wrap: anywhere; }
  .bubble[aria-pressed="true"] .bubble-label { color: var(--accent); }

  .kw-list { list-style: none; padding: 0; margin: 0.5rem 0 0; display: grid; gap: 0.45rem; max-width: 30rem; }
  .kw-list li { display: grid; grid-template-columns: minmax(6rem, auto) 1fr 2rem; align-items: center; gap: 0.75rem; }
  .kw { font-weight: 650; overflow-wrap: anywhere; }
  .kw-bar { height: 0.6rem; background: var(--paper-deep); border-radius: 999px; overflow: hidden; }
  .kw-bar span { display: block; height: 100%; background: var(--phase-revealed); border-radius: inherit; }
  .kw-n { text-align: right; font-weight: 700; }
  .empty { text-align: center; padding: 1.5rem 1rem; border: 2px dashed var(--line); border-radius: var(--radius); }
  .empty p { margin: 0.2rem 0; }
  @media (max-width: 600px) {
    .wall { grid-template-columns: 1fr; }
    .segmented { width: 100%; }
    .segmented button { flex: 1; }
  }
</style>
