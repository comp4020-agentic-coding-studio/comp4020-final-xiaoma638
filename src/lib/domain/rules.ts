// Pure rules shared by the server and the spec. Nothing here touches the
// database, the clock or the framework, so every rule can be checked with known
// inputs (spec/unit/rules.test.ts).

export const PHASES = ["DRAFT", "COLLECTING", "REVEALED", "CLOSED"] as const;
export type Phase = (typeof PHASES)[number];
export type QuestionKind = "choice" | "open";

export const LIMITS = {
  orgName: 60,
  nickname: 24,
  prompt: 200,
  option: 80,
  minOptions: 2,
  maxOptions: 8,
  openText: 500,
  maxTags: 3,
  tag: 24,
  minDurationSec: 5,
  maxDurationSec: 3600,
} as const;

/** A write is accepted only when the server decides strictly before the deadline. */
export function acceptsAt(decidedAt: number, deadline: number): boolean {
  return decidedAt < deadline;
}

/**
 * The phase a question is really in at `now`. Collection ends at the deadline
 * whether or not any timer fired, so a stored COLLECTING past its deadline
 * reads as REVEALED. CLOSED never changes.
 */
export function effectivePhase(stored: Phase, deadline: number | null, now: number): Phase {
  if (stored === "COLLECTING" && deadline !== null && !acceptsAt(now, deadline)) return "REVEALED";
  return stored;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Trims, then enforces non-empty and a maximum length. */
export function checkText(raw: unknown, label: string, max: number): Checked<string> {
  if (typeof raw !== "string") return { ok: false, error: `${label} is required.` };
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: `${label} can't be blank.` };
  if ([...value].length > max) return { ok: false, error: `${label} must be at most ${max} characters.` };
  return { ok: true, value };
}

/**
 * Up to three keywords per response: trimmed, case-folded, and counted once
 * however often a response repeats one. Empty entries are dropped.
 */
export function normaliseTags(raw: unknown): Checked<string[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Keywords must be a list." };
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") return { ok: false, error: "Each keyword must be text." };
    const tag = entry.trim().toLowerCase();
    if (tag.length === 0) continue;
    if ([...tag].length > LIMITS.tag) {
      return { ok: false, error: `Each keyword must be at most ${LIMITS.tag} characters.` };
    }
    seen.add(tag);
  }
  if (seen.size > LIMITS.maxTags) return { ok: false, error: `At most ${LIMITS.maxTags} keywords.` };
  return { ok: true, value: [...seen] };
}

export type OptionCount = { optionId: string; label: string; count: number; percent: number };

/**
 * One vote per valid response. Percentages use the number of responses as the
 * denominator (non-respondents are not counted) and are rounded to whole
 * numbers, so they may not sum to exactly 100.
 */
export function tallyChoices(
  options: { id: string; label: string }[],
  votes: string[],
): { total: number; counts: OptionCount[] } {
  const byOption = new Map(options.map((o) => [o.id, 0]));
  let total = 0;
  for (const optionId of votes) {
    const current = byOption.get(optionId);
    if (current === undefined) continue;
    byOption.set(optionId, current + 1);
    total++;
  }
  return {
    total,
    counts: options.map((o) => {
      const count = byOption.get(o.id) ?? 0;
      return { optionId: o.id, label: o.label, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) };
    }),
  };
}

/** A keyword's frequency is the number of responses that carry it. */
export function keywordFrequencies(tagsPerResponse: string[][]): { keyword: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const tags of tagsPerResponse) {
    for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || (a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0));
}

export type Rankable = { id: string; likeCount: number; submittedAt: number };

/** Most liked first; ties by earliest first submission, then by id, so every client agrees. */
export function compareByLikes(a: Rankable, b: Rankable): number {
  return b.likeCount - a.likeCount || a.submittedAt - b.submittedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Original order: first submission time, then id. */
export function compareBySubmission(a: Rankable, b: Rankable): number {
  return a.submittedAt - b.submittedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
