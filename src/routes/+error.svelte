<script lang="ts">
  import { page } from "$app/state";

  const unavailable = $derived(page.status === 404);
  const message = $derived(unavailable
    ? "Check the link, or enter a join code to open your review."
    : page.status < 500 && page.error?.message
      ? page.error.message
      : "We couldn't load this page. Please try opening your space again.");
</script>

<svelte:head><title>{page.status} · Silent Review Wall</title></svelte:head>

<section class="card error-card" aria-labelledby="error-h">
  <span class="page-icon" aria-hidden="true">
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 5H9a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z" />
      <path d="M20 5v5h5M12 16h8M12 21h5" />
    </svg>
  </span>
  <h1 id="error-h">{unavailable ? "This page is unavailable" : "Couldn't open this page"}</h1>
  <p>{message}</p>
  <a class="button" href="/">{unavailable ? "Join a review" : "Back to spaces"}<span aria-hidden="true">→</span></a>
</section>

<style>
  .error-card { max-width: 36rem; margin: clamp(2rem, 10vh, 6rem) auto; padding: clamp(1.5rem, 5vw, 3rem); text-align: center; }
  .page-icon { display: grid; place-items: center; width: 4rem; height: 4rem; margin: 0 auto 1.5rem; color: var(--accent); background: var(--accent-soft); border-radius: var(--radius); }
  h1 { font-size: clamp(1.7rem, 4vw, 2.25rem); }
  p { max-width: 27rem; margin: 1rem auto 1.75rem; color: var(--ink-soft); }
  .button { gap: 1rem; }
</style>
