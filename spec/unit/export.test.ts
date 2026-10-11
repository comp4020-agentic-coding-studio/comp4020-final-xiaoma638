import { describe, expect, it } from "vitest";
import { exportFileName, resultsCsv, resultsText } from "../../src/lib/domain/export.ts";
import type { Results } from "../../src/lib/types.ts";

// Exported results with known fixtures: same counts and ranking as the wall,
// spreadsheet-safe cells, and nothing that names an author.

const choice: Results = {
  kind: "choice",
  total: 3,
  counts: [
    { optionId: "a", label: "Yes, ship it", count: 2, percent: 67 },
    { optionId: "b", label: "Not yet", count: 1, percent: 33 },
  ],
};

const open: Results = {
  kind: "open",
  total: 3,
  responses: [
    { id: "r1", text: "Clearer\nbrief", tags: ["brief"], likeCount: 1, likedByMe: false, mine: true, submittedAt: 1000 },
    { id: "r2", text: 'Say "why", then what', tags: [], likeCount: 2, likedByMe: true, mine: false, submittedAt: 2000 },
    { id: "r3", text: "=HYPERLINK(1)", tags: ["brief", "ux"], likeCount: 1, likedByMe: false, mine: false, submittedAt: 3000 },
  ],
  keywords: [{ keyword: "brief", count: 2 }, { keyword: "ux", count: 1 }],
};

describe("text summary", () => {
  it("lists every option with its count and percentage", () => {
    expect(resultsText("Ready?", choice)).toBe("Ready?\n3 votes\n- Yes, ship it: 2 (67%)\n- Not yet: 1 (33%)");
  });

  it("ranks open answers by likes, then first submission, on one line each", () => {
    const lines = resultsText("Ideas", open).split("\n");
    expect(lines.slice(2, 5)).toEqual([
      '1. Say "why", then what (2 likes)',
      "2. Clearer brief (1 like) #brief",
      "3. =HYPERLINK(1) (1 like) #brief #ux",
    ]);
    expect(lines[5]).toBe("Keywords: brief ×2, ux ×1");
  });

  it("says when nobody answered", () => {
    expect(resultsText("Q", { kind: "open", total: 0, responses: [], keywords: [] })).toBe("Q\n0 answers, most liked first");
  });
});

describe("csv", () => {
  it("has a header and one row per option", () => {
    expect(resultsCsv(choice)).toBe('option,votes,percent\r\n"Yes, ship it",2,67\r\nNot yet,1,33\r\n');
  });

  it("quotes commas, quotes and newlines and defuses formulas", () => {
    const rows = resultsCsv(open).split("\r\n");
    expect(rows[0]).toBe("rank,answer,likes,keywords,submitted_at");
    expect(rows[1]).toBe(`1,"Say ""why"", then what",2,,${new Date(2000).toISOString()}`);
    expect(rows[2]).toBe(`2,"Clearer\nbrief",1,brief,${new Date(1000).toISOString()}`);
    expect(rows[3]).toBe(`3,'=HYPERLINK(1),1,brief ux,${new Date(3000).toISOString()}`);
  });

  it("never carries author fields", () => {
    expect(resultsCsv(open)).not.toMatch(/mine|likedByMe|r1|r2|r3/);
  });
});

describe("file name", () => {
  it("slugs the question and falls back for symbols only", () => {
    expect(exportFileName("What worked well, and why?")).toBe("what-worked-well-and-why.csv");
    expect(exportFileName("？？")).toBe("results.csv");
  });
});
