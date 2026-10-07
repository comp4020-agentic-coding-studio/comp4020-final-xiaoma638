<script lang="ts">
  import { LIMITS, normaliseTags } from "#lib/domain/rules.ts";
  import { api, ApiError } from "#lib/live.svelte.ts";
  import { draftFromResponse, draftMatchesResponse, hasDraftContent, reconcileSavedDraft } from "#lib/response-draft.ts";
  import type { MyResponse, QuestionView } from "#lib/types.ts";

  let { question, archived = false, onchange = () => {} }: { question: QuestionView; archived?: boolean; onchange?: () => void } = $props();

  let optionId = $state<string | null>(null);
  let text = $state("");
  let tagsInput = $state("");
  // the version this draft is based on; only moves when we load a saved answer
  let baseVersion = $state(0);
  let dirty = $state(false);
  let saving = $state(false);
  let status = $state<{ kind: "ok" | "warn" | "bad"; message: string } | null>(null);
  let conflict = $state<MyResponse | null>(null);
  let confirmed = $state<MyResponse | null>(null);
  let copyStatus = $state("");
  let dismissed = $state(false);

  const collecting = $derived(question.phase === "COLLECTING");
  const draft = $derived({ optionId, text, tagsInput });
  const savedResponse = $derived(
    confirmed && confirmed.version > (question.myResponse?.version ?? 0) ? confirmed : question.myResponse,
  );
  const matchesSaved = $derived(draftMatchesResponse(question.kind, draft, savedResponse));
  const recoverable = $derived(hasDraftContent(question.kind, draft) && !matchesSaved);

  function load(r: MyResponse | null) {
    const next = draftFromResponse(r);
    optionId = next.optionId;
    text = next.text;
    tagsInput = next.tagsInput;
    baseVersion = r?.version ?? 0;
    confirmed = r;
    dirty = false;
  }

  // follow the saved answer (e.g. edited in another tab) until the user starts typing
  $effect(() => {
    const saved = question.myResponse;
    if (!dirty && !saving && (saved?.version ?? 0) >= baseVersion) load(saved);
  });

  const tags = $derived(
    tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== ""),
  );
  const checkedTags = $derived(normaliseTags(tags));

  function markEdited() {
    dirty = true;
    if (status?.kind === "ok") status = null;
  }

  async function save(e?: SubmitEvent) {
    e?.preventDefault();
    if (saving || !collecting) return;
    if (question.kind === "choice" && !optionId) {
      status = { kind: "bad", message: "Pick an option first." };
      return;
    }
    if (question.kind === "open" && text.trim() === "") {
      status = { kind: "bad", message: "Your answer can't be blank." };
      return;
    }
    if (!checkedTags.ok) {
      status = { kind: "bad", message: checkedTags.error };
      return;
    }
    saving = true;
    status = { kind: "warn", message: "Saving…" };
    const submitted = { optionId, text, tagsInput };
    try {
      const body = question.kind === "choice" ? { optionId, baseVersion } : { text, tags: checkedTags.value, baseVersion };
      const saved = await api<MyResponse>("PUT", `/api/questions/${question.id}/response`, body);
      const acknowledgement = reconcileSavedDraft({ optionId, text, tagsInput }, submitted, saved);
      confirmed = saved;
      baseVersion = acknowledgement.version;
      if (!acknowledgement.hasNewEdits) load(saved);
      else dirty = true;
      conflict = null;
      status = acknowledgement.hasNewEdits
        ? { kind: "warn", message: "Your previous answer was saved. Your latest changes still need to be submitted." }
        : { kind: "ok", message: "Saved. You can change it until the time runs out." };
      onchange();
    } catch (err) {
      if (err instanceof ApiError && err.code === "stale_version") {
        conflict = (err.body.current as MyResponse | null) ?? null;
        status = { kind: "bad", message: err.message };
      } else if (err instanceof ApiError && err.code === "deadline_passed") {
        status = { kind: "bad", message: "Time ran out before this was saved, so it wasn't recorded." };
        onchange();
      } else {
        status = {
          kind: "bad",
          message: `Not saved. ${err instanceof ApiError ? err.message : "Something went wrong."} Your answer is still here.`,
        };
      }
    } finally {
      saving = false;
    }
  }

  function useSaved() {
    load(conflict);
    conflict = null;
    status = { kind: "ok", message: "Loaded the saved answer." };
  }

  function keepMine() {
    baseVersion = conflict?.version ?? 0;
    conflict = null;
    void save();
  }

  async function copyDraft() {
    const content = question.kind === "choice"
      ? question.options.find((option) => option.id === optionId)?.label ?? ""
      : `${text}${tagsInput.trim() ? `\n\nKeywords: ${tagsInput}` : ""}`;
    try {
      await navigator.clipboard.writeText(content);
      copyStatus = "Draft copied.";
    } catch {
      copyStatus = "Couldn't copy automatically. You can select and copy the draft below.";
    }
  }

  const savedLabel = $derived(savedResponse ? "Update answer" : "Submit answer");
</script>

{#if collecting}
<form onsubmit={save} oninput={markEdited} aria-describedby="privacy-note" aria-busy={saving}>
  <p id="privacy-note" class="visually-hidden">Your answer is private until the reveal, including from the host.</p>
  {#if question.kind === "choice"}
    <fieldset>
      <legend>Choose one</legend>
      <div class="tiles">
        {#each question.options as o, i (o.id)}
          <label class="tile" class:selected={optionId === o.id}>
            <input type="radio" name="option" value={o.id} bind:group={optionId} onchange={markEdited} />
            <span class="letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
            <span class="tile-text">{o.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
  {:else}
    <div class="label-row">
      <label for="answer">Your answer</label>
      <span class="hint num" class:over={[...text].length > LIMITS.openText - 50}>{[...text].length} / {LIMITS.openText}</span>
    </div>
    <textarea id="answer" bind:value={text} maxlength={LIMITS.openText} placeholder="Write what you think…" required></textarea>
    <details class="disclosure tag-editor">
      <summary>Keywords {tags.length ? `(${checkedTags.ok ? checkedTags.value.length : tags.length})` : "(optional)"}</summary>
      <label class="visually-hidden" for="tags">Keywords</label>
      <input id="tags" type="text" bind:value={tagsInput} autocomplete="off" placeholder="e.g. layout, speed" aria-describedby="tags-hint" />
      <p id="tags-hint" class="hint">Up to {LIMITS.maxTags}, separated by commas.</p>
      {#if tags.length > 0}
        <ul class="chips" aria-label="Keywords you've entered">
          {#each checkedTags.ok ? checkedTags.value : tags as t, i (i)}<li class:extra={!checkedTags.ok}>#{t.toLowerCase()}</li>{/each}
        </ul>
      {/if}
    </details>
  {/if}

  {#if status && !matchesSaved && (status.kind === "bad" || (status.kind === "warn" && !saving))}<p class="status {status.kind}" role={status.kind === "bad" ? "alert" : "status"}>{status.message}</p>{/if}

  {#if conflict && !matchesSaved}
    <div class="conflict">
      <p><strong>The saved answer is now:</strong></p>
      <p class="saved">
        {#if question.kind === "choice"}
          {question.options.find((o) => o.id === conflict?.optionId)?.label ?? "(none)"}
        {:else}
          {conflict.text}
        {/if}
      </p>
      <div class="row">
        <button type="button" class="secondary" onclick={useSaved}>Use the saved answer</button>
        <button type="button" onclick={keepMine}>Replace it with mine</button>
      </div>
    </div>
  {/if}

  <div class="actions">
    <button type="submit" class="big" disabled={saving || matchesSaved}>{saving ? "Saving…" : savedLabel}</button>
    {#if saving}
      <span class="visually-hidden" role="status">Saving your answer…</span>
    {:else if matchesSaved}
      <span class="saved-badge" role="status">✓ Saved</span>
    {:else if dirty}
      <span class="muted">Unsaved changes</span>
    {/if}
  </div>
</form>
{:else if (recoverable || saving) && !dismissed}
  <aside class="recovery" aria-labelledby="recovery-title-{question.id}">
    <div class="recovery-header">
      <h3 id="recovery-title-{question.id}">{saving ? "Confirming your submission" : "Your unsaved draft"}</h3>
      <div class="row">
        <button type="button" class="secondary" onclick={copyDraft}>Copy draft</button>
        {#if !saving}<button type="button" class="ghost" onclick={() => (dismissed = true)}>Dismiss</button>{/if}
      </div>
    </div>
    {#if archived}<p class="hint">From: {question.prompt}</p>{/if}
    <p class="recovery-message" role="status">
      {#if saving}
        Waiting for confirmation. Your draft is safe here.
      {:else}
        Not submitted. {#if savedResponse}Your earlier answer is counted.{:else}No answer was recorded.{/if} Copy before leaving.
      {/if}
    </p>
    <div class="recovery-content">
      {#if question.kind === "choice"}
        <p>{question.options.find((option) => option.id === optionId)?.label ?? "No option selected"}</p>
      {:else}
        <p>{text}</p>
        {#if tagsInput.trim()}<p class="hint">Keywords: {tagsInput}</p>{/if}
      {/if}
    </div>
    {#if copyStatus}<p class="hint" role="status">{copyStatus}</p>{/if}
  </aside>
{/if}

<style>
  .tag-editor { margin-top: 0.5rem; }
  .tiles { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); }
  .tile {
    position: relative;
    display: flex; align-items: center; gap: 0.75rem;
    margin: 0;
    padding: 0.8rem 0.9rem;
    border: 2px solid var(--line);
    border-radius: var(--radius-s);
    background: var(--paper);
    font-weight: 500;
    color: var(--ink);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .tile:hover { border-color: var(--line-strong); background: var(--surface); }
  .tile input { position: absolute; opacity: 0; pointer-events: none; }
  .tile:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .tile.selected { border-color: var(--accent); background: var(--accent-soft); }
  .letter {
    flex: none;
    width: 1.9rem; height: 1.9rem;
    display: grid; place-items: center;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .selected .letter { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
  .tile-text { overflow-wrap: anywhere; }
  .label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
  .label-row label { margin-bottom: 0.35rem; }
  .over { color: var(--warn); font-weight: 600; }
  .chips { list-style: none; padding: 0; margin: 0.5rem 0 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .chips li { padding: 0.15rem 0.6rem; border-radius: 999px; background: var(--note-3); font-size: 0.85rem; font-weight: 600; }
  .chips li.extra { background: var(--bad-soft); color: var(--bad); text-decoration: line-through; }
  .conflict { margin: 1rem 0; padding: 1rem; border: 1px solid var(--bad); border-radius: var(--radius-s); background: var(--bad-soft); }
  .conflict p { margin: 0 0 0.5rem; }
  .saved { white-space: pre-wrap; }
  .actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 1.25rem; }
  .saved-badge { color: var(--ok); font-weight: 600; font-size: 0.95rem; }
  .recovery { margin: 1.25rem 0; padding: 1rem; background: var(--paper); border: 1px solid var(--line-strong); border-left: 4px solid var(--warn); border-radius: var(--radius-s); }
  .recovery-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
  .recovery-header h3 { margin: 0; }
  .recovery-message { color: var(--ink-soft); }
  .recovery-content { padding: 0.75rem; background: var(--surface); border-radius: var(--radius-s); user-select: text; }
  .recovery-content p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
  .recovery-content .hint { margin-top: 0.5rem; }
</style>
