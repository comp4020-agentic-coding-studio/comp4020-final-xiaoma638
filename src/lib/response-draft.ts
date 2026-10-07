import { normaliseTags, type QuestionKind } from "./domain/rules.ts";
import type { MyResponse } from "./types.ts";

export type ResponseDraft = { optionId: string | null; text: string; tagsInput: string };

export function draftFromResponse(response: MyResponse | null): ResponseDraft {
  return {
    optionId: response?.optionId ?? null,
    text: response?.text ?? "",
    tagsInput: response?.tags.join(", ") ?? "",
  };
}

/** An acknowledgement owns the submitted fields, never edits made while it travelled. */
export function reconcileSavedDraft(current: ResponseDraft, submitted: ResponseDraft, saved: MyResponse) {
  const hasNewEdits = current.optionId !== submitted.optionId || current.text !== submitted.text || current.tagsInput !== submitted.tagsInput;
  return { draft: hasNewEdits ? current : draftFromResponse(saved), hasNewEdits, version: saved.version };
}

export function hasDraftContent(kind: QuestionKind, draft: ResponseDraft): boolean {
  return kind === "choice" ? draft.optionId !== null : draft.text.trim() !== "" || draft.tagsInput.trim() !== "";
}

/** Compare the same trimmed text and normalized keywords that the server stores. */
export function draftMatchesResponse(kind: QuestionKind, draft: ResponseDraft, response: MyResponse | null): boolean {
  if (!response) return false;
  if (kind === "choice") return draft.optionId === response.optionId;
  const tags = normaliseTags(draft.tagsInput.split(","));
  return tags.ok && draft.text.trim() === response.text &&
    [...tags.value].sort().join("\n") === [...response.tags].sort().join("\n");
}
