<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>About · Silent Review Wall</title></svelte:head>

<!-- README.md is repository content, not user input -->
<article class="card readme">{@html data.html}</article>

<style>
  .readme { max-width: 46rem; margin: 1rem auto; font-size: 1.05rem; line-height: 1.7; }
  .readme :global(h1) { margin-top: 0; }
  .readme :global(h2) { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--line); }
  .readme :global(img) { max-width: 100%; height: auto; border-radius: var(--radius-s); }
  .readme :global(pre) { overflow-x: auto; padding: 1rem; background: var(--paper); border-radius: var(--radius-s); }
  .readme :global(code) { font-family: var(--font-mono); font-size: 0.92em; }
  .readme :global(blockquote) { margin: 1rem 0; padding: 0.25rem 1rem; border-left: 4px solid var(--line-strong); color: var(--ink-soft); }
</style>
