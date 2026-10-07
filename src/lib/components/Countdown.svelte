<script lang="ts">
  // Display only: the server enforces the deadline and reveals on its own.
  let {
    deadline,
    durationSec,
    serverNow,
  }: { deadline: number; durationSec: number; serverNow: () => number } = $props();

  let now = $state(Date.now());
  $effect(() => {
    now = serverNow();
    const t = setInterval(() => (now = serverNow()), 250);
    return () => clearInterval(t);
  });

  const left = $derived(Math.max(0, Math.ceil((deadline - now) / 1000)));
  const text = $derived(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
  const urgent = $derived(left > 0 && left <= Math.min(10, durationSec / 4));
</script>

<div class="countdown" class:urgent role="timer" aria-label="Time remaining">
  {#if left > 0}
    <span class="time num" aria-hidden="true">{text}</span>
    <span class="visually-hidden">{left} seconds remaining.</span>
    <span class="muted" aria-hidden="true">remaining</span>
  {:else}
    <span class="revealing">Revealing…</span>
  {/if}
</div>

<style>
  .countdown { display: flex; align-items: baseline; gap: 0.55rem; flex-wrap: wrap; }
  .time {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 6vw, 2.4rem);
    font-weight: 600;
    line-height: 1;
    color: var(--phase-collecting);
  }
  .urgent .time { color: var(--bad); }
  .muted { font-size: 0.9rem; }
  .revealing { font-weight: 600; color: var(--phase-collecting); }
</style>
