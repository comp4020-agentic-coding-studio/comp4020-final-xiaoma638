<script lang="ts">
  import type { Results } from "#lib/types.ts";
  let { results, myOptionId }: { results: Extract<Results, { kind: "choice" }>; myOptionId: string | null } = $props();
  const top = $derived(Math.max(0, ...results.counts.map((c) => c.count)));
</script>

{#if results.total === 0}
  <div class="empty">
    <p>No votes were submitted.</p>
  </div>
{:else}
  <p class="summary"><span class="big num">{results.total}</span> {results.total === 1 ? "vote" : "votes"}</p>
  <ul class="bars">
    {#each results.counts as c, i (c.optionId)}
      <li class:lead={c.count === top && top > 0} style:--delay="{i * 80}ms">
        <div class="label">
          <span class="text">
            {c.label}
            {#if c.optionId === myOptionId}<span class="pill accent">your choice</span>{/if}
          </span>
          <span class="num figures"><strong>{c.count}</strong> · {c.percent}%</span>
        </div>
        <div class="track" aria-hidden="true"><div class="fill" style:width="{c.percent}%"></div></div>
      </li>
    {/each}
  </ul>
  <details class="disclosure"><summary>How votes are counted</summary><p>One vote per answer. Percentages are based on submitted answers and may not total 100% due to rounding.</p></details>
{/if}

<style>
  .summary { color: var(--muted); margin: 0.5rem 0 1rem; }
  .big { font-family: var(--font-display); font-size: 1.8rem; font-weight: 600; color: var(--ink); margin-right: 0.2rem; }
  .bars { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.9rem; }
  .label { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin-bottom: 0.35rem; }
  .text { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-weight: 600; }
  .figures { white-space: nowrap; color: var(--muted); }
  .figures strong { color: var(--ink); }
  .track { height: 1.1rem; border-radius: 6px; background: var(--paper-deep); overflow: hidden; }
  .fill {
    height: 100%;
    border-radius: inherit;
    background: color-mix(in srgb, var(--accent) 55%, var(--paper-deep));
    transform-origin: left;
    animation: grow 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
    animation-delay: var(--delay);
  }
  .lead .fill { background: var(--accent); }
  @keyframes grow { from { transform: scaleX(0); } }
  .empty { text-align: center; padding: 1.5rem 1rem; border: 2px dashed var(--line); border-radius: var(--radius); }
  .empty p { margin: 0.2rem 0; }
</style>
