<script lang="ts">
  // One face-down card per submitted answer. The cards are identical and carry
  // nothing but the count, which every member can already see.
  let { count, size = "small" }: { count: number; size?: "small" | "large" } = $props();

  const max = $derived(size === "large" ? 24 : 12);
  const shown = $derived(Math.min(count, max));
  // A fixed scatter per position, so a new card never moves the old ones.
  const tilt = (i: number) => ((i * 37) % 13) - 6;
  const shift = (i: number) => ((i * 53) % 9) - 4;
</script>

<div class="pile {size}" aria-hidden="true">
  {#each { length: shown } as _, i (i)}
    <span class="card" style:--tilt="{tilt(i)}deg" style:--shift="{shift(i)}px" style:--tint="var(--note-{(i % 5) + 1})"></span>
  {/each}
  {#if count > max}<span class="more num">+{count - max}</span>{/if}
</div>

<style>
  /* Small: one overlapping row. Large: a loose spread on the shared screen. */
  .pile { display: flex; align-items: center; min-height: 1.6rem; padding-left: 0.45rem; }
  .small .card { margin-left: -0.45rem; }
  .card {
    width: 1.1rem; height: 1.45rem;
    border-radius: 3px;
    background:
      repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in srgb, var(--ink) 7%, transparent) 3px 4px),
      var(--tint);
    border: 1px solid color-mix(in srgb, var(--tint) 35%, var(--line-strong));
    box-shadow: var(--shadow-s);
    transform: translateY(var(--shift)) rotate(var(--tilt));
    animation: drop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
  }
  .large { flex-wrap: wrap; gap: 0.7rem; max-width: 34rem; padding-left: 0; }
  .large .card { width: 2.6rem; height: 3.4rem; border-radius: 6px; }
  .more { font-size: 0.9rem; font-weight: 700; color: var(--muted); margin-left: 0.3rem; }
  @keyframes drop {
    from { opacity: 0; transform: translateY(-1.4rem) rotate(calc(var(--tilt) * -3)) scale(1.15); }
  }
</style>
