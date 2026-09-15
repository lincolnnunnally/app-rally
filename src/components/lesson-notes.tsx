import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  LESSON_NOTES_HELP,
  LESSON_NOTES_LABEL,
  LESSON_NOTES_MAX,
} from "@/lib/lesson-notes";
import { saveLessonNotes } from "@/lib/rally-server";

export function LessonNotesRead({ notes }: { notes: string | null }) {
  return (
    <div>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{LESSON_NOTES_LABEL}</p>
      {notes ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{notes}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No session notes or weekly practice cue yet.</p>
      )}
    </div>
  );
}

export function LessonNotesEditor({
  lessonId,
  notes,
  onSaved,
}: {
  lessonId: number;
  notes: string | null;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(notes ?? "");
  const save = useMutation({
    mutationFn: (next: string) => saveLessonNotes({ data: { id: lessonId, notes: next } }),
    onSuccess: () => {
      toast.success("Notes saved. Same field as the weekly practice cue.");
      void qc.invalidateQueries({ queryKey: ["desk"] });
      void qc.invalidateQueries({ queryKey: ["my-lessons"] });
      void qc.invalidateQueries({ queryKey: ["lesson-scan", lessonId] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(value);
      }}
    >
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{LESSON_NOTES_LABEL}</p>
      <p className="text-xs text-muted-foreground">{LESSON_NOTES_HELP}</p>
      <Textarea
        value={value}
        maxLength={LESSON_NOTES_MAX}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Third shot. Ten resets this week before Thursday."
      />
      <div>
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </form>
  );
}
