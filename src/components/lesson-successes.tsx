import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  LESSON_SUCCESSES_MAX,
  getLessonSuccesses,
  saveLessonSuccesses,
} from "@/lib/lesson-extras-server";

/** Coach writes what went right; player and guardian see it. Not the private notes. */
export function LessonSuccesses({ lessonId }: { lessonId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["lesson-successes", lessonId],
    queryFn: () => getLessonSuccesses({ data: { id: lessonId } }),
  });
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (successes: string) => saveLessonSuccesses({ data: { id: lessonId, successes } }),
    onSuccess: () => {
      toast.success("Successes saved. The player sees them.");
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ["lesson-successes", lessonId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!q.data) return null;
  const { successes, canEdit } = q.data;
  if (!canEdit && !successes) return null;
  const value = draft ?? successes ?? "";
  return (
    <Card className="mt-6">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Successes</p>
      {canEdit ? (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(value);
          }}
        >
          <Textarea
            name="successes"
            value={value}
            maxLength={LESSON_SUCCESSES_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="First clean second serve. Kept the split step all set."
          />
          <p className="text-xs text-muted-foreground">
            What went right. The player and parent see this. Private notes stay private.
          </p>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save successes"}
          </Button>
        </form>
      ) : (
        <p className="mt-2 text-sm whitespace-pre-wrap">{successes}</p>
      )}
    </Card>
  );
}
