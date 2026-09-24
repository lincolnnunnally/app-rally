import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_BODY_MAX,
  SESSION_CLOSE,
  SESSION_FIELDS,
  composeSessionBody,
  emptyAnswers,
  parseSessionBody,
  sessionListLead,
  todayISO,
} from "./session-journal.ts";

const legacy =
  "What broke down at 10–8. What I will do the next time the ball sits up. I still want to remember the deep returns.";

describe("composeSessionBody", () => {
  it("writes labeled sections in prompt order and skips blanks", () => {
    const answers = emptyAnswers();
    answers.didWell = "  Kept the toss still.  ";
    answers.learned = "The short ball wants a target.";
    answers.helpNext = "Cue: see it early.";

    const body = composeSessionBody({
      sessionType: "Lesson",
      date: "2026-09-22",
      answers,
    });

    assert.match(
      body,
      /^Session: Lesson\nDate: 2026-09-22\n\nWhat I did well\nKept the toss still\./,
    );
    assert.equal(body.includes("What I improved"), false);
    assert.equal(body.includes("What I want to grow next"), false);
    const order = SESSION_FIELDS.map((field) => body.indexOf(field.label)).filter(
      (index) => index >= 0,
    );
    const sorted = [...order].sort((a, b) => a - b);
    assert.deepEqual(order, sorted);
    assert.ok(body.length <= SESSION_BODY_MAX);
  });

  it("keeps a full set of answers inside the body cap", () => {
    const answers = emptyAnswers();
    for (const field of SESSION_FIELDS) answers[field.key] = "word ".repeat(200);
    const body = composeSessionBody({
      sessionType: "Play",
      date: "2026-09-22",
      answers,
    });
    assert.ok(body.length <= SESSION_BODY_MAX);
    const parsed = parseSessionBody(body);
    assert.equal(parsed.kind, "session");
    if (parsed.kind === "session") assert.equal(parsed.sections.length, SESSION_FIELDS.length);
  });
});

describe("parseSessionBody", () => {
  it("round-trips a guided session and leads with what went well", () => {
    const answers = emptyAnswers();
    answers.didWell = "I split early and took the ball in front.";
    answers.improved = "The return was a little deeper than last week.";
    answers.learned = "Soft hands show up when I exhale first.";
    answers.growNext = "One more ball on the third shot.";
    answers.helpNext = "A partner who feeds short balls, and the cue: see it early.";

    const body = composeSessionBody({ sessionType: "Play", date: "2026-09-22", answers });
    const parsed = parseSessionBody(body);
    assert.equal(parsed.kind, "session");
    if (parsed.kind !== "session") return;
    assert.equal(parsed.sessionType, "Play");
    assert.equal(parsed.date, "2026-09-22");
    assert.deepEqual(
      parsed.sections.map((section) => section.label),
      SESSION_FIELDS.map((field) => field.label),
    );
    assert.equal(parsed.sections[0]?.text, answers.didWell);

    const lead = sessionListLead(body);
    assert.equal(lead.fromDidWell, true);
    assert.equal(lead.text, answers.didWell);
  });

  it("shows legacy free text unchanged, without inventing a did-well section", () => {
    const parsed = parseSessionBody(legacy);
    assert.deepEqual(parsed, { kind: "legacy", text: legacy });
    const lead = sessionListLead(legacy, 48);
    assert.equal(lead.fromDidWell, false);
    assert.equal(lead.text.endsWith("…"), true);
    assert.equal(lead.text.includes("What I did well"), false);
    assert.equal(parseSessionBody(legacy).kind === "legacy" ? legacy : "", legacy);
  });

  it("keeps prose that merely mentions a heading as legacy", () => {
    const mixed = "Good day overall.\nWhat I learned\nKeep the toss still.";
    assert.equal(parseSessionBody(mixed).kind, "legacy");
  });

  it("still reads a labeled body that has no session header", () => {
    const body = "What I did well\nI stayed on the kitchen line.";
    const parsed = parseSessionBody(body);
    assert.equal(parsed.kind, "session");
    if (parsed.kind !== "session") return;
    assert.equal(parsed.sessionType, null);
    assert.equal(parsed.sections[0]?.text, "I stayed on the kitchen line.");
    assert.equal(sessionListLead(body).text, "I stayed on the kitchen line.");
  });
});

describe("session journal copy", () => {
  it("uses the close line and the five helpers in order", () => {
    assert.equal(SESSION_CLOSE, "You showed up. That counts. See you on the court.");
    assert.deepEqual(
      SESSION_FIELDS.map((field) => field.label),
      [
        "What I did well",
        "What I improved",
        "What I learned",
        "What I want to grow next",
        "What would help next time",
      ],
    );
    assert.equal(SESSION_FIELDS[0]?.primary, true);
  });

  it("defaults the date to the local calendar day", () => {
    assert.equal(todayISO(new Date(2026, 8, 22, 23, 30)), "2026-09-22");
  });
});
