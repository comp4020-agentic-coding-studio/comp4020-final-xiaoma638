import { describe, expect, it } from "vitest";
import { draftFromResponse, draftMatchesResponse, hasDraftContent, reconcileSavedDraft } from "../../src/lib/response-draft.ts";
import type { MyResponse } from "../../src/lib/types.ts";

const saved: MyResponse = { optionId: null, text: "First answer", tags: ["layout"], version: 2 };

describe("response acknowledgement races", () => {
  it("keeps text typed while an earlier save was in flight", () => {
    const submitted = { optionId: null, text: "First answer", tagsInput: "layout" };
    const latest = { ...submitted, text: "A more complete answer" };
    const result = reconcileSavedDraft(latest, submitted, saved);
    expect(result.draft.text).toBe("A more complete answer");
    expect(result.hasNewEdits).toBe(true);
    expect(result.version).toBe(2);
    expect(draftMatchesResponse("open", result.draft, saved)).toBe(false);
  });

  it("also preserves keywords and a changed choice during the request", () => {
    const submitted = { optionId: "a", text: "", tagsInput: "" };
    const latest = { ...submitted, optionId: "b", tagsInput: "new" };
    const result = reconcileSavedDraft(latest, submitted, { ...saved, optionId: "a", text: null, tags: [] });
    expect(result.draft).toEqual(latest);
    expect(result.hasNewEdits).toBe(true);
  });

  it("uses confirmed server content when the user made no later changes", () => {
    const submitted = { optionId: null, text: "  First answer  ", tagsInput: "LAYOUT, layout" };
    const result = reconcileSavedDraft(submitted, submitted, saved);
    expect(result.draft).toEqual(draftFromResponse(saved));
    expect(result.hasNewEdits).toBe(false);
  });
});

describe("draft recovery after reveal", () => {
  it("keeps an unsubmitted answer recoverable when no response was saved", () => {
    const draft = { optionId: null, text: "Please keep this", tagsInput: "" };
    expect(hasDraftContent("open", draft)).toBe(true);
    expect(draftMatchesResponse("open", draft, null)).toBe(false);
  });

  it("recognizes a confirmed submission even when its acknowledgement was lost", () => {
    const draft = { optionId: null, text: " First answer ", tagsInput: "LAYOUT, layout" };
    expect(draftMatchesResponse("open", draft, saved)).toBe(true);
  });

  it("keeps a changed draft distinct from the earlier answer that is counted", () => {
    const draft = { optionId: null, text: "First answer", tagsInput: "contrast" };
    expect(draftMatchesResponse("open", draft, saved)).toBe(false);
    expect(draftMatchesResponse("choice", { ...draft, optionId: "b" }, { ...saved, optionId: "a" })).toBe(false);
  });

  it("does not invent a recovery draft for an untouched form", () => {
    expect(hasDraftContent("open", draftFromResponse(null))).toBe(false);
    expect(hasDraftContent("choice", draftFromResponse(null))).toBe(false);
  });
});
