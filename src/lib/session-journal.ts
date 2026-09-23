/**
 * Session journal stays on `journal_entries.body`.
 * Structured answers are labeled sections so older free-text rows still render.
 *
 * Body shape:
 *   Session: Play | Lesson
 *   Date: YYYY-MM-DD
 *
 *   What I did well
 *   ...
 *
 *   What I improved
 *   ...
 *
 * Blank optional sections are left out. A body with no exact section label,
 * or with prose before the first label, is a legacy free-text entry.
 */

export const SESSION_FIELD_MAX = 500;
export const SESSION_BODY_MAX = 4000;
export const SESSION_CLOSE = "You showed up. That counts. See you on the court.";

export const SESSION_TYPES = ["Play", "Lesson"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_FIELDS = [
  {
    key: "didWell",
    label: "What I did well",
    helper: "Start here. Name one thing that worked today.",
    primary: true,
  },
  {
    key: "improved",
    label: "What I improved",
    helper: "Something that is better than last time — even a little.",
    primary: false,
  },
  {
    key: "learned",
    label: "What I learned",
    helper: "One thing that clicked.",
    primary: false,
  },
  {
    key: "growNext",
    label: "What I want to grow next",
    helper: "One focus for next time. This is a target, not a grade.",
    primary: false,
  },
  {
    key: "helpNext",
    label: "What would help next time",
    helper: "A cue, drill, rest, partner, or reminder that would make the next session easier.",
    primary: false,
  },
] as const;

export type SessionFieldKey = (typeof SESSION_FIELDS)[number]["key"];
export type SessionAnswers = Record<SessionFieldKey, string>;

const LABEL_TO_KEY = new Map<string, SessionFieldKey>(
  SESSION_FIELDS.map((field) => [field.label, field.key]),
);

export function emptyAnswers(): SessionAnswers {
  return {
    didWell: "",
    improved: "",
    learned: "",
    growNext: "",
    helpNext: "",
  };
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clip(value: string): string {
  return value.trim().slice(0, SESSION_FIELD_MAX);
}

export function composeSessionBody(input: {
  sessionType: SessionType;
  date: string;
  answers: SessionAnswers;
}): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : "";
  const lines: string[] = [`Session: ${input.sessionType}`];
  if (date) lines.push(`Date: ${date}`);
  lines.push("");

  let wrote = false;
  for (const field of SESSION_FIELDS) {
    const text = clip(input.answers[field.key] ?? "");
    if (!text) continue;
    if (wrote) lines.push("");
    lines.push(field.label);
    lines.push(text);
    wrote = true;
  }

  return lines.join("\n").trim();
}

export type SessionSection = {
  key: SessionFieldKey;
  label: string;
  text: string;
};

export type ParsedSession =
  | {
      kind: "session";
      sessionType: SessionType | null;
      date: string | null;
      sections: SessionSection[];
    }
  | { kind: "legacy"; text: string };

export function parseSessionBody(body: string): ParsedSession {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const labelAt: number[] = [];
  lines.forEach((line, index) => {
    if (LABEL_TO_KEY.has(line.trim())) labelAt.push(index);
  });
  if (labelAt.length === 0) return { kind: "legacy", text: body };

  const first = labelAt[0] ?? 0;
  let sessionType: SessionType | null = null;
  let date: string | null = null;
  for (let i = 0; i < first; i++) {
    const trimmed = lines[i]?.trim() ?? "";
    if (!trimmed) continue;
    const session = /^Session:\s*(Play|Lesson)\s*$/.exec(trimmed);
    if (session) {
      sessionType = session[1] as SessionType;
      continue;
    }
    const dated = /^Date:\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(trimmed);
    if (dated?.[1]) {
      date = dated[1];
      continue;
    }
    return { kind: "legacy", text: body };
  }

  const sections: SessionSection[] = [];
  for (let n = 0; n < labelAt.length; n++) {
    const start = labelAt[n] ?? 0;
    const end = labelAt[n + 1] ?? lines.length;
    const label = lines[start]?.trim() ?? "";
    const key = LABEL_TO_KEY.get(label);
    if (!key || sections.some((section) => section.key === key)) continue;
    const text = lines
      .slice(start + 1, end)
      .join("\n")
      .trim();
    if (!text) continue;
    sections.push({ key, label, text });
  }

  if (sections.length === 0) return { kind: "legacy", text: body };
  return { kind: "session", sessionType, date, sections };
}

export function truncateNote(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

export function sessionListLead(body: string, max = 180): { text: string; fromDidWell: boolean } {
  const parsed = parseSessionBody(body);
  if (parsed.kind === "session") {
    const didWell = parsed.sections.find((section) => section.key === "didWell")?.text;
    if (didWell) return { text: truncateNote(didWell, max), fromDidWell: true };
  }
  return { text: truncateNote(body, max), fromDidWell: false };
}
