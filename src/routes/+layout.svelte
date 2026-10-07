<script lang="ts">
  import "@fontsource-variable/fraunces";
  import "../app.css";
  let { children } = $props();
</script>

<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="inner">
    <a href="/" class="brand">
      <svg class="brand-mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect x="3" y="7" width="15" height="15" rx="2.5" fill="var(--note-1)" stroke="currentColor" stroke-width="1.5" transform="rotate(-8 10 14)" />
        <rect x="13" y="5" width="15" height="15" rx="2.5" fill="var(--note-4)" stroke="currentColor" stroke-width="1.5" transform="rotate(6 20 12)" />
        <rect x="8" y="13" width="15" height="15" rx="2.5" fill="var(--note-3)" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span>Silent Review Wall</span>
    </a>
    <nav aria-label="Site">
      <a href="/readme/">About</a>
    </nav>
  </div>
</header>
<main id="main">
  {@render children()}
</main>

<style>
  .site {
    position: sticky;
    top: 0;
    z-index: 5;
    background: color-mix(in srgb, var(--paper) 90%, transparent);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }
  .inner {
    max-width: 68rem;
    margin: 0 auto;
    padding: 1rem 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--ink);
    text-decoration: none;
    font-family: var(--font-display);
    font-weight: 650;
    font-size: 1.1rem;
  }
  .brand-mark { flex: none; color: var(--accent); }
  nav a { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink-soft); font-weight: 500; font-size: 0.9rem; text-decoration: none; padding: 0.4rem 0.75rem; border-radius: 8px; }
  nav a:hover { background: var(--paper-deep); color: var(--ink); }
  @media (max-width: 600px) {
    .inner { padding: 0.45rem 16px; gap: 0.5rem; }
    .brand { font-size: 1rem; }
  }
</style>
