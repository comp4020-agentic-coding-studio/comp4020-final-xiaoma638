<script lang="ts">
  import { onMount } from "svelte";
  import { exportFileName, resultsCsv, resultsText } from "#lib/domain/export.ts";
  import type { Results } from "#lib/types.ts";

  // Takes revealed results out of the app: a summary for notes, a CSV for a sheet.
  let { prompt, results }: { prompt: string; results: Results } = $props();

  let copied = $state(false);
  let error = $state("");
  let timer: ReturnType<typeof setTimeout>;
  onMount(() => () => clearTimeout(timer));

  async function copy() {
    error = "";
    try {
      await navigator.clipboard.writeText(resultsText(prompt, results));
      clearTimeout(timer);
      copied = true;
      timer = setTimeout(() => (copied = false), 2000);
    } catch {
      error = "Couldn't copy. Download the CSV instead.";
    }
  }

  function download() {
    // The byte-order mark lets spreadsheet apps read non-English text as UTF-8.
    const blob = new Blob(["﻿" + resultsCsv(results)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(prompt);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
</script>

<div class="export" role="group" aria-label="Export results">
  <span class="hint">Export</span>
  <button class="ghost small" onclick={copy}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
    {copied ? "Copied ✓" : "Copy summary"}
  </button>
  <button class="ghost small" onclick={download}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14" /></svg>
    Download CSV
  </button>
  <span class="visually-hidden" role="status">{copied ? "Summary copied" : ""}</span>
  {#if error}<p class="status bad" role="alert">{error}</p>{/if}
</div>

<style>
  .export { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; margin-top: 1rem; }
  .export .hint { margin-right: 0.2rem; font-size: 0.82rem; }
  .export button { gap: 0.35rem; padding: 0.35rem 0.7rem; font-size: 0.88rem; }
  @media (max-width: 420px) { .export .hint { display: none; } .export button { padding-inline: 0.55rem; } }
  .export .status { flex-basis: 100%; margin: 0.25rem 0 0; }
</style>
