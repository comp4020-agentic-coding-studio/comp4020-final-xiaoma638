<script lang="ts">
  import ChoiceResults from "#lib/components/ChoiceResults.svelte";
  import OpenResults from "#lib/components/OpenResults.svelte";
  import PhaseBanner from "#lib/components/PhaseBanner.svelte";

  let { data } = $props();
  const q = $derived(data.question);
</script>

<svelte:head><title>{q.prompt} · Silent Review Wall</title></svelte:head>

<div class="review-shell">
  <a href="/o/{data.orgId}" class="back" aria-label="Back to the review space"><span aria-hidden="true">←</span> Review space</a>
  <section class="card stage" aria-labelledby="q-h">
    <PhaseBanner phase={q.phase} kind={q.kind} />
    <h1 id="q-h" class="prompt">{q.prompt}</h1>
    {#if q.results?.kind === "choice"}
      <ChoiceResults results={q.results} myOptionId={q.myResponse?.optionId ?? null} />
    {:else if q.results?.kind === "open"}
      <OpenResults results={q.results} canLike={false} />
    {:else}
      <p class="muted">No results yet. Follow this question in the review space.</p>
    {/if}
  </section>
</div>

<style>
  .review-shell { max-width: 52rem; margin: 0 auto; }
  .back { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; font-size: 0.85rem; text-decoration: none; color: var(--muted); margin-bottom: 0.7rem; }
  .back:hover { color: var(--accent); }
  .stage { margin-top: 0; padding: clamp(1.25rem, 4vw, 2rem); }
  .prompt { font-size: clamp(1.5rem, 3.6vw, 2rem); margin: 1.4rem 0 1.5rem; line-height: 1.3; }
</style>
