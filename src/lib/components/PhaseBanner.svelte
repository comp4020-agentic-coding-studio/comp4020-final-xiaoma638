<script lang="ts">
  import type { Phase, QuestionKind } from "#lib/domain/rules.ts";
  let { phase, kind = "open" }: { phase: Phase; kind?: QuestionKind } = $props();

  const TEXT: Record<Phase, { name: string; what: string }> = {
    DRAFT: { name: "Draft", what: "Review hasn't started." },
    COLLECTING: { name: "Answering", what: "Answers stay hidden until time is up." },
    REVEALED: { name: "Revealed", what: "Like answers you want to discuss." },
    CLOSED: { name: "Closed", what: "Results are read-only." },
  };
  const guidance = $derived(phase === "REVEALED" && kind === "choice"
    ? "Compare the votes."
    : TEXT[phase].what);
</script>

<p class="banner" style:--phase="var(--phase-{phase.toLowerCase()})" role="status" aria-atomic="true">
  <span class="badge">{TEXT[phase].name}</span>
  <span class="guidance">{guidance}</span>
</p>

<style>
  .banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.7rem;
    margin: 0;
    font-size: 0.88rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--phase) 10%, var(--surface));
    color: var(--ink-soft);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .badge::before { content: ""; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--phase); }
  .guidance { color: var(--muted); }
</style>
