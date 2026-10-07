import type { OptionCount, Phase, QuestionKind } from "./domain/rules.ts";

// What the server sends a viewer. Every shape here is already filtered for
// that viewer: before the reveal nothing in it carries anyone else's answer.

export type MyResponse = {
  optionId: string | null;
  text: string | null;
  tags: string[];
  version: number;
};

export type OpenResult = {
  id: string;
  text: string;
  tags: string[];
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  submittedAt: number;
};

export type Results =
  | { kind: "choice"; total: number; counts: OptionCount[] }
  | { kind: "open"; total: number; responses: OpenResult[]; keywords: { keyword: string; count: number }[] };

export type QuestionView = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  options: { id: string; label: string }[];
  durationSec: number;
  phase: Phase;
  deadline: number | null;
  revealedAt: number | null;
  closedAt: number | null;
  submittedCount: number;
  myResponse: MyResponse | null;
  /** Present only once the question is REVEALED or CLOSED. */
  results: Results | null;
};

export type HistoryItem = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  phase: Phase;
  createdAt: number;
  submittedCount: number;
};

export type Snapshot = {
  version: number;
  /** Server clock when the snapshot was taken, for the countdown's offset. */
  now: number;
  org: { id: string; name: string; joinCode: string; memberCount: number };
  me: { id: string; nickname: string; isHost: boolean };
  current: QuestionView | null;
  history: HistoryItem[];
};

export type MyOrg = { id: string; name: string; nickname: string; isHost: boolean };
