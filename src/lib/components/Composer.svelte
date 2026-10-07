<script lang="ts">
  import { tick } from "svelte";
  import { LIMITS, type QuestionKind } from "#lib/domain/rules.ts";
  import { api, ApiError } from "#lib/live.svelte.ts";
  import type { QuestionView } from "#lib/types.ts";

  // Creates a draft question, or edits the current draft when one is given.
  let {
    orgId,
    draft = null,
    onchange = () => {},
    oncancel,
  }: {
    orgId: string;
    draft?: QuestionView | null;
    onchange?: () => void;
    oncancel?: () => void;
  } = $props();

  const DURATIONS = [
    { sec: 30, label: "30 seconds" },
    { sec: 60, label: "1 minute" },
    { sec: 120, label: "2 minutes" },
    { sec: 180, label: "3 minutes" },
    { sec: 300, label: "5 minutes" },
    { sec: 600, label: "10 minutes" },
  ];

  // svelte-ignore state_referenced_locally
  let kind = $state<QuestionKind>(draft?.kind ?? "open");
  // svelte-ignore state_referenced_locally
  let prompt = $state(draft?.prompt ?? "");
  // svelte-ignore state_referenced_locally
  let optionLabels = $state<string[]>(draft && draft.options.length > 0 ? draft.options.map((o) => o.label) : ["", ""]);
  // svelte-ignore state_referenced_locally
  let durationSec = $state(draft?.durationSec ?? 120);
  let error = $state("");
  let saving = $state(false);
  let optionInputs = $state<HTMLInputElement[]>([]);

  async function addOption() {
    optionLabels.push("");
    await tick();
    optionInputs[optionLabels.length - 1]?.focus();
  }

  async function removeOption(index: number) {
    optionLabels.splice(index, 1);
    await tick();
    optionInputs[Math.min(index, optionLabels.length - 1)]?.focus();
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (saving) return;
    saving = true;
    error = "";
    const body = { kind, prompt, durationSec: Number(durationSec), options: kind === "choice" ? optionLabels : [] };
    try {
      if (draft) await api("PUT", `/api/questions/${draft.id}`, body);
      else await api("POST", `/api/orgs/${orgId}/questions`, body);
      onchange();
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Couldn't save the question.";
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={save} aria-busy={saving}>
  <fieldset disabled={saving}>
    <legend>Question type</legend>
    <div class="types">
      <label class="type" class:selected={kind === "open"}>
        <input type="radio" name="question-type" bind:group={kind} value="open" />
        <span>Open answer</span>
      </label>
      <label class="type" class:selected={kind === "choice"}>
        <input type="radio" name="question-type" bind:group={kind} value="choice" />
        <span>Single choice</span>
      </label>
    </div>
  </fieldset>

  <label for="prompt">Question</label>
  <textarea id="prompt" class="prompt" bind:value={prompt} maxlength={LIMITS.prompt} placeholder="What do you want the group to answer?" required disabled={saving}></textarea>

  {#if kind === "choice"}
    <fieldset disabled={saving}>
      <legend>Options <span class="hint">{LIMITS.minOptions}–{LIMITS.maxOptions}</span></legend>
      {#each optionLabels as _, i (i)}
        <div class="opt">
          <span class="letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
          <label class="visually-hidden" for="opt-{i}">Option {i + 1}</label>
          <input id="opt-{i}" type="text" bind:this={optionInputs[i]} bind:value={optionLabels[i]} maxlength={LIMITS.option} placeholder="Option {i + 1}" required />
          {#if optionLabels.length > LIMITS.minOptions}
            <button type="button" class="ghost remove" onclick={() => removeOption(i)}>
              <span aria-hidden="true">✕</span><span class="visually-hidden">Remove option {i + 1}</span>
            </button>
          {/if}
        </div>
      {/each}
      {#if optionLabels.length < LIMITS.maxOptions}
        <button type="button" class="ghost" onclick={addOption}>+ Add option</button>
      {/if}
    </fieldset>
  {/if}

  <label for="duration">Answering time</label>
  <select id="duration" bind:value={durationSec} disabled={saving}>
    {#each DURATIONS as d (d.sec)}
      <option value={d.sec}>{d.label}</option>
    {/each}
    {#if !DURATIONS.some((d) => d.sec === Number(durationSec))}
      <option value={durationSec}>{durationSec} seconds</option>
    {/if}
  </select>

  {#if error}<p class="status bad" role="alert">{error}</p>{/if}
  <span class="visually-hidden" role="status">{saving ? "Saving draft…" : ""}</span>
  <div class="actions">
    <button type="submit" disabled={saving}>{saving ? "Saving…" : draft ? "Save draft" : "Create draft"}</button>
    {#if draft && oncancel}
      <button type="button" class="secondary" onclick={oncancel} disabled={saving}>Cancel</button>
    {/if}
  </div>
</form>

<style>
  .types {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.25rem;
    width: min(100%, 26rem);
    border: 1px solid var(--line);
    border-radius: var(--radius-s);
    background: var(--paper);
  }
  .type {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    min-width: 0;
    min-height: 44px;
    margin: 0;
    padding: 0.55rem 0.75rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    font-weight: 600;
    font-size: 0.94rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .type:hover:not(:has(input:disabled)) { background: var(--surface); }
  .type.selected { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); box-shadow: var(--shadow-s); }
  .type:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .type input { position: absolute; opacity: 0; pointer-events: none; }
  .prompt { font-family: var(--font-display); font-size: 1.15rem; min-height: 5rem; }
  .opt { display: flex; align-items: center; gap: 0.5rem; margin: 0.45rem 0; }
  .opt input { flex: 1; min-width: 0; }
  .letter {
    flex: none; width: 1.9rem; height: 1.9rem; display: grid; place-items: center;
    border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface);
    font-weight: 700; font-size: 0.9rem; color: var(--muted);
  }
  .remove { min-width: 44px; padding: 0.4rem; color: var(--muted); }
  select { width: min(100%, 14rem); min-height: 44px; }
  .type:has(input:disabled) { cursor: wait; opacity: 0.65; }
  .actions { display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; margin-top: 1.25rem; }
</style>
