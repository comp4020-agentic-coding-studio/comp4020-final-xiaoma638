<script lang="ts">
  import { goto } from "$app/navigation";
  import { api, ApiError } from "#lib/live.svelte.ts";
  import ChoiceResults from "#lib/components/ChoiceResults.svelte";
  import ExportResults from "#lib/components/ExportResults.svelte";
  import OpenResults from "#lib/components/OpenResults.svelte";
  import PhaseBanner from "#lib/components/PhaseBanner.svelte";

  let { data } = $props();
  const q = $derived(data.question);

  let reusing = $state(false);
  let reuseError = $state("");

  // Copies a closed question into a new draft. The server refuses while
  // another question is open, and that message is shown as is.
  async function askAgain() {
    if (reusing) return;
    reusing = true;
    reuseError = "";
    try {
      await api("POST", `/api/orgs/${data.orgId}/questions`, {
        kind: q.kind,
        prompt: q.prompt,
        durationSec: q.durationSec,
        options: q.options.map((o) => o.label),
      });
      await goto(`/o/${data.orgId}`);
    } catch (err) {
      reuseError = err instanceof ApiError ? err.message : "Couldn't copy this question.";
    } finally {
      reusing = false;
    }
  }
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
    {/if}
    {#if q.results && q.results.total > 0}
      <ExportResults prompt={q.prompt} results={q.results} />
    {:else if !q.results}
      <p class="muted">No results yet. Follow this question in the review space.</p>
    {/if}
    {#if data.isHost && q.phase === "CLOSED"}
      <div class="reuse">
        <button class="secondary" onclick={askAgain} disabled={reusing}>{reusing ? "Copying…" : "Ask again"}</button>
        <span class="hint">Copies this question into a new draft. These results stay here.</span>
      </div>
      {#if reuseError}<p class="status bad" role="alert">{reuseError}</p>{/if}
    {/if}
  </section>
</div>

<style>
  .review-shell { max-width: 52rem; margin: 0 auto; }
  .back { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; font-size: 0.85rem; text-decoration: none; color: var(--muted); margin-bottom: 0.7rem; }
  .back:hover { color: var(--accent); }
  .stage { margin-top: 0; padding: clamp(1.25rem, 4vw, 2rem); }
  .prompt { font-size: clamp(1.5rem, 3.6vw, 2rem); margin: 1.4rem 0 1.5rem; line-height: 1.3; }
  .reuse { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; margin-top: 1.25rem; padding-top: 1.1rem; border-top: 1px solid var(--line); }
</style>
