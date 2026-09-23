import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatWall } from "@/lib/rally";
import {
  SESSION_CLOSE,
  SESSION_FIELD_MAX,
  SESSION_FIELDS,
  SESSION_TYPES,
  composeSessionBody,
  emptyAnswers,
  parseSessionBody,
  sessionListLead,
  todayISO,
  type SessionAnswers,
  type SessionFieldKey,
  type SessionType,
} from "@/lib/session-journal";

export type JournalRow = {
  id: number;
  kind: string;
  title: string | null;
  body: string;
  created_at: string;
};

export function SessionJournalPanel({
  entries,
  pending,
  saved,
  onSave,
  onWriteAnother,
}: {
  entries: JournalRow[];
  pending: boolean;
  saved: boolean;
  onSave: (data: { title?: string; body: string }) => void;
  onWriteAnother: () => void;
}) {
  const sessions = entries.filter((entry) => entry.kind === "journal");
  const others = entries.filter((entry) => entry.kind !== "journal");

  return (
    <div id="after-court" className="flex flex-col gap-4">
      {saved ? (
        <Card>
          <p className="font-display text-3xl leading-tight">{SESSION_CLOSE}</p>
          <Button className="mt-6" type="button" variant="secondary" onClick={onWriteAnother}>
            Write another
          </Button>
        </Card>
      ) : (
        <SessionForm pending={pending} onSave={onSave} />
      )}

      <section>
        <h2 className="font-display text-2xl">Past sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each note starts with what worked. Read them back when you want to see the thread.
        </p>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Your sessions will gather here. Each one starts with what you did well.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {sessions.map((entry) => (
              <SessionRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 ? (
        <section>
          <h2 className="font-display text-lg">Other notes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {others.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {entry.kind} · {formatWall(entry.created_at)}
                </p>
                {entry.title ? <p className="mt-1 text-sm font-medium">{entry.title}</p> : null}
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{entry.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SessionForm({
  pending,
  onSave,
}: {
  pending: boolean;
  onSave: (data: { title?: string; body: string }) => void;
}) {
  const [sessionType, setSessionType] = useState<SessionType>("Play");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<SessionAnswers>(emptyAnswers);

  useEffect(() => {
    setDate((current) => current || todayISO());
  }, []);

  function setAnswer(key: SessionFieldKey, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  const ready = answers.didWell.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || pending) return;
        const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
        const body = composeSessionBody({
          sessionType,
          date: sessionDate,
          answers,
        });
        const trimmedTitle = title.trim().slice(0, 80);
        onSave(trimmedTitle ? { title: trimmedTitle, body } : { body });
      }}
    >
      <div>
        <h2 className="font-display text-2xl">After court</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          A few lines after you play or take a lesson. What went well stays. The rest is a target
          for next time.
        </p>
      </div>

      <div className="grid gap-4">
        <div>
          <p id="session-type-label" className="text-sm text-muted-foreground">
            Play or lesson
          </p>
          <div className="mt-2 flex gap-2" role="group" aria-labelledby="session-type-label">
            {SESSION_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                variant={sessionType === type ? "default" : "secondary"}
                aria-pressed={sessionType === type}
                onClick={() => setSessionType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="session-date" className="text-sm text-muted-foreground">
              Date
            </label>
            <Input
              id="session-date"
              className="mt-2"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="session-title" className="text-sm text-muted-foreground">
              Title
            </label>
            <Input
              id="session-title"
              className="mt-2"
              value={title}
              maxLength={80}
              placeholder="A few words, if you want"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        </div>
      </div>

      {SESSION_FIELDS.map((field) => (
        <Card key={field.key} className={field.primary ? "border-primary/40" : undefined}>
          <label
            htmlFor={`session-${field.key}`}
            className={
              field.primary ? "font-display text-3xl leading-tight" : "font-display text-2xl"
            }
          >
            {field.label}
          </label>
          <p id={`session-${field.key}-help`} className="mt-2 text-sm text-muted-foreground">
            {field.helper}
          </p>
          <Textarea
            id={`session-${field.key}`}
            className={field.primary ? "mt-3 min-h-36 text-base" : "mt-3"}
            aria-describedby={`session-${field.key}-help`}
            maxLength={SESSION_FIELD_MAX}
            value={answers[field.key]}
            onChange={(event) => setAnswer(field.key, event.target.value)}
          />
        </Card>
      ))}

      <Button type="submit" disabled={!ready || pending}>
        {pending ? "Saving…" : "Save session"}
      </Button>
    </form>
  );
}

function SessionRow({ entry }: { entry: JournalRow }) {
  const [open, setOpen] = useState(false);
  const parsed = parseSessionBody(entry.body);
  const lead = sessionListLead(entry.body);
  const when =
    parsed.kind === "session" && parsed.date
      ? formatWall(parsed.date)
      : formatWall(entry.created_at);
  const didWell =
    parsed.kind === "session"
      ? (parsed.sections.find((section) => section.key === "didWell")?.text ?? "")
      : "";
  const rest =
    parsed.kind === "session" ? parsed.sections.filter((section) => section.key !== "didWell") : [];
  const legacy = parsed.kind === "legacy" ? entry.body.trim() : "";
  const fullLead = parsed.kind === "session" ? didWell : legacy;
  const canOpen = rest.length > 0 || fullLead.replace(/\s+/g, " ").trim() !== lead.text;

  return (
    <li className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {parsed.kind === "session" && parsed.sessionType
          ? `${parsed.sessionType} · ${when}`
          : `journal · ${when}`}
      </p>
      {entry.title ? <p className="mt-1 text-sm font-medium">{entry.title}</p> : null}
      {lead.fromDidWell ? (
        <p className="mt-3 text-xs tracking-wide text-muted-foreground uppercase">
          What I did well
        </p>
      ) : null}
      <p
        className={
          lead.fromDidWell
            ? "mt-1 whitespace-pre-wrap text-base leading-relaxed"
            : "mt-1 whitespace-pre-wrap text-sm leading-relaxed"
        }
      >
        {parsed.kind === "legacy"
          ? open
            ? entry.body
            : lead.text
          : open && didWell
            ? didWell
            : lead.text}
      </p>
      {open && parsed.kind === "session"
        ? rest.map((section) => (
            <div key={section.key} className="mt-4">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{section.text}</p>
            </div>
          ))
        : null}
      {canOpen ? (
        <button
          type="button"
          className="mt-3 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : "Full session"}
        </button>
      ) : null}
    </li>
  );
}
