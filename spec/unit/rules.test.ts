import { describe, expect, it } from "vitest";
import {
  acceptsAt,
  compareByLikes,
  compareBySubmission,
  effectivePhase,
  keywordFrequencies,
  normaliseTags,
  tallyChoices,
} from "../../src/lib/domain/rules.ts";

// The counting and deadline rules with known fixtures, no server involved.

describe("deadline", () => {
  const deadline = 1_000_000;
  it("accepts strictly before, refuses at and after", () => {
    expect(acceptsAt(deadline - 1, deadline)).toBe(true);
    expect(acceptsAt(deadline, deadline)).toBe(false);
    expect(acceptsAt(deadline + 1, deadline)).toBe(false);
  });

  it("reads an expired COLLECTING as REVEALED and never reopens CLOSED", () => {
    expect(effectivePhase("COLLECTING", deadline, deadline - 1)).toBe("COLLECTING");
    expect(effectivePhase("COLLECTING", deadline, deadline)).toBe("REVEALED");
    expect(effectivePhase("CLOSED", deadline, deadline - 1)).toBe("CLOSED");
    expect(effectivePhase("DRAFT", null, deadline)).toBe("DRAFT");
  });
});

describe("choice tally", () => {
  const options = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ];

  it("counts one vote per response and uses responses as the denominator", () => {
    const { total, counts } = tallyChoices(options, ["a", "a", "b"]);
    expect(total).toBe(3);
    expect(counts.map((c) => [c.optionId, c.count, c.percent])).toEqual([
      ["a", 2, 67],
      ["b", 1, 33],
      ["c", 0, 0],
    ]);
  });

  it("handles zero responses without dividing by zero", () => {
    const { total, counts } = tallyChoices(options, []);
    expect(total).toBe(0);
    expect(counts.every((c) => c.count === 0 && c.percent === 0)).toBe(true);
  });

  it("ignores votes for options that aren't on the question", () => {
    expect(tallyChoices(options, ["a", "zzz"]).total).toBe(1);
  });
});

describe("keywords", () => {
  it("trims, folds case, drops blanks and dedupes within a response", () => {
    expect(normaliseTags(["  Design ", "design", "", "UX"])).toEqual({ ok: true, value: ["design", "ux"] });
  });

  it("allows at most three distinct keywords", () => {
    expect(normaliseTags(["a", "b", "c", "d"]).ok).toBe(false);
    expect(normaliseTags(["a", "A", "b", "c"]).ok).toBe(true);
  });

  it("treats a missing list as no keywords", () => {
    expect(normaliseTags(undefined)).toEqual({ ok: true, value: [] });
  });

  it("counts a keyword's frequency as the number of responses carrying it", () => {
    expect(keywordFrequencies([["x", "y"], ["x", "x"], [], ["y", "z"]])).toEqual([
      { keyword: "x", count: 2 },
      { keyword: "y", count: 2 },
      { keyword: "z", count: 1 },
    ]);
    expect(keywordFrequencies([])).toEqual([]);
  });
});

describe("ordering", () => {
  const rows = [
    { id: "r3", likeCount: 2, submittedAt: 30 },
    { id: "r1", likeCount: 2, submittedAt: 10 },
    { id: "r2", likeCount: 5, submittedAt: 20 },
    { id: "r0", likeCount: 2, submittedAt: 10 },
  ];

  it("ranks by likes, then earliest submission, then id", () => {
    expect([...rows].sort(compareByLikes).map((r) => r.id)).toEqual(["r2", "r0", "r1", "r3"]);
  });

  it("keeps original order by submission time, then id", () => {
    expect([...rows].sort(compareBySubmission).map((r) => r.id)).toEqual(["r0", "r1", "r2", "r3"]);
  });
});
