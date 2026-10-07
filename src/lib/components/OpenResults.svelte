<script lang="ts">
  import { tick, untrack } from "svelte";
  import { compareByLikes, compareBySubmission } from "#lib/domain/rules.ts";
  import { api, ApiError } from "#lib/live.svelte.ts";
  import type { OpenResult, Results } from "#lib/types.ts";

  let {
    results,
    canLike,
    onchange = () => {},
  }: { results: Extract<Results, { kind: "open" }>; canLike: boolean; onchange?: () => void } = $props();

  let order = $state<"original" | "likes">("original");
  let pending = $state<Record<string, boolean>>({});
  let error = $state("");
  let wallElement = $state<HTMLOListElement | null>(null);

  // Keys preserve answer identity; moved DOM nodes also need explicit focus recovery.
  const sorted = $derived([...results.responses].sort(order === "likes" ? compareByLikes : compareBySubmission));
  const responseOrder = $derived(sorted.map((response) => response.id).join(","));
  // each answer keeps its note colour whatever the order, so a reorder doesn't repaint the wall
  const tint = $derived(new Map(results.responses.map((r, i) => [r.id, (i % 5) + 1])));
  const topKeyword = $derived(Math.max(1, ...results.keywords.map((k) => k.count)));

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
    if (pending[r.id] || !canLike || r.mine) return;
    pending[r.id] = true;
    error = "";
    try {
      await api("PUT", `/api/responses/${r.id}/like`, { liked: !r.likedByMe });
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
    <p class="count"><span class="big num">{results.total}</span> {results.total === 1 ? "answer" : "answers"}</p>
    {#if results.total > 1}
      <div class="segmented" role="group" aria-label="Order answers">
        <button class="ghost" aria-pressed={order === "original"} onclick={() => (order = "original")}>Original order</button>
        <button class="ghost" aria-pressed={order === "likes"} onclick={() => (order = "likes")}>Most liked</button>
      </div>
    {/if}
  </div>
  {#if error}<p class="status bad" role="alert">{error}</p>{/if}

  <ol class="wall" bind:this={wallElement}>
    {#each sorted as r, i (r.id)}
      <li class="note" style:--tint="var(--note-{tint.get(r.id)})" style:--delay="{Math.min(i, 6) * 35}ms">
        <p class="text">{r.text}</p>
        {#if r.tags.length > 0}
          <ul class="tags" aria-label="Keywords">
            {#each r.tags as t (t)}<li>#{t}</li>{/each}
          </ul>
        {/if}
        <div class="foot">
          {#if r.mine}
            <span class="mine">Your answer</span>
          {:else}
            <span></span>
          {/if}
          {#if canLike && !r.mine}
            <button
              class="like"
              aria-pressed={r.likedByMe}
              aria-disabled={pending[r.id] ?? false}
              aria-busy={pending[r.id] ?? false}
              onclick={() => toggle(r)}
            >
              <span aria-hidden="true">{r.likedByMe ? "♥" : "♡"}</span>
              <span class="num">{r.likeCount}</span>
              <span class="visually-hidden">{r.likedByMe ? "likes, liked by you. Unlike" : "likes. Like"} this answer</span>
            </button>
          {:else}
            <span class="likes num"><span aria-hidden="true">♥</span> {r.likeCount}<span class="visually-hidden"> likes</span></span>
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
      <p class="hint">Number of answers using each keyword.</p>
      <ul class="kw-list">
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
    animation: pin 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: var(--delay);
  }
  .note:only-child { grid-column: 1 / -1; }
  @keyframes pin {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
  }
  .text { white-space: pre-wrap; margin: 0 0 0.6rem; font-size: 1.02rem; line-height: 1.5; color: var(--ink); }
  .tags { list-style: none; padding: 0; margin: 0 0 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem 0.6rem; }
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
  .likes { color: var(--ink-soft); font-size: 0.95rem; opacity: 0.8; }

  .keywords { margin-top: 1rem; border-top: 1px solid var(--line); padding-top: 0.5rem; }
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
