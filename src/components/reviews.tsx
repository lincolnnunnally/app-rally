import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listReviews, submitReview, type ReviewRow } from "@/lib/rally-server";

export function ReviewBlock({
  subjectType,
  subjectId,
  noun,
}: {
  subjectType: "player" | "coach" | "facility";
  subjectId: string;
  noun: string;
}) {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const key = ["reviews", subjectType, subjectId];
  const reviews = useQuery({
    queryKey: key,
    queryFn: () => listReviews({ data: { subject_type: subjectType, subject_id: subjectId } }),
  });
  const mine = (reviews.data ?? []).find((r) => user && r.reviewer_user_id === user.id);

  return (
    <div className="mt-8">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Reviews</p>
      <div className="mt-3 flex flex-col gap-3">
        {reviews.isSuccess && (reviews.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet. Empty stays empty until someone who actually played here writes one.
          </p>
        ) : null}
        {(reviews.data ?? []).map((r) => (
          <ReviewLine key={r.id} review={r} />
        ))}
      </div>
      {isPending ? null : user ? (
        <ReviewForm
          subjectType={subjectType}
          subjectId={subjectId}
          noun={noun}
          existing={mine}
          onSaved={() => void qc.invalidateQueries({ queryKey: key })}
        />
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/login" search={{ ref: undefined, coach: undefined, mode: "up" }} className="underline">
            Sign in
          </Link>{" "}
          to review {noun}.
        </p>
      )}
    </div>
  );
}

function ReviewLine({ review }: { review: ReviewRow }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-sm">
        <span className="font-medium">{review.reviewer_name}</span>
        <span className="ml-2 tabular-nums text-muted-foreground">{review.rating}/5</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed">{review.body}</p>
    </div>
  );
}

function ReviewForm({
  subjectType,
  subjectId,
  noun,
  existing,
  onSaved,
}: {
  subjectType: "player" | "coach" | "facility";
  subjectId: string;
  noun: string;
  existing?: ReviewRow;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [body, setBody] = useState(existing?.body ?? "");
  const save = useMutation({
    mutationFn: () =>
      submitReview({
        data: {
          subject_type: subjectType,
          subject_id: subjectId,
          rating,
          body,
        },
      }),
    onSuccess: () => {
      toast.success(existing ? "Review updated." : "Review posted.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <Label htmlFor={`review-${subjectId}`}>
        {existing ? `Your review of ${noun}` : `Review ${noun}`}
      </Label>
      <select
        className="h-11 rounded-md border border-border bg-background px-3 text-sm"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        aria-label="Rating"
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} / 5
          </option>
        ))}
      </select>
      <Textarea
        id={`review-${subjectId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        minLength={8}
        maxLength={600}
        required
        placeholder="What actually happened on court."
      />
      <Button type="submit" variant="outline" disabled={save.isPending}>
        {save.isPending ? "Saving…" : existing ? "Update review" : "Post review"}
      </Button>
    </form>
  );
}
