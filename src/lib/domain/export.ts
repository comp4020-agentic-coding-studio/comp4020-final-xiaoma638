import type { Results } from "../types.ts";
import { compareByLikes } from "./rules.ts";

// Revealed results as plain text for notes and as CSV for spreadsheets.
// Built only from what the viewer already sees: no nicknames, no author ids.

/** A summary to paste into meeting notes or a chat. Open answers rank by likes. */
export function resultsText(prompt: string, results: Results): string {
  const lines = [prompt];
  if (results.kind === "choice") {
    lines.push(`${results.total} ${results.total === 1 ? "vote" : "votes"}`);
    for (const c of results.counts) lines.push(`- ${c.label}: ${c.count} (${c.percent}%)`);
  } else {
    lines.push(`${results.total} ${results.total === 1 ? "answer" : "answers"}, most liked first`);
    [...results.responses].sort(compareByLikes).forEach((r, i) => {
      const tags = r.tags.length ? ` ${r.tags.map((t) => `#${t}`).join(" ")}` : "";
      lines.push(`${i + 1}. ${oneLine(r.text)} (${r.likeCount} ${r.likeCount === 1 ? "like" : "likes"})${tags}`);
    });
    if (results.keywords.length) {
      lines.push(`Keywords: ${results.keywords.map((k) => `${k.keyword} ×${k.count}`).join(", ")}`);
    }
  }
  return lines.join("\n");
}

export function resultsCsv(results: Results): string {
  const rows: (string | number)[][] =
    results.kind === "choice"
      ? [["option", "votes", "percent"], ...results.counts.map((c) => [c.label, c.count, c.percent])]
      : [
          ["rank", "answer", "likes", "keywords", "submitted_at"],
          ...[...results.responses]
            .sort(compareByLikes)
            .map((r, i) => [i + 1, r.text, r.likeCount, r.tags.join(" "), new Date(r.submittedAt).toISOString()]),
        ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** A short, filesystem-safe name taken from the question. */
export function exportFileName(prompt: string): string {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return `${slug || "results"}.csv`;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  // A leading = + - @ would run as a formula when the file opens in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
