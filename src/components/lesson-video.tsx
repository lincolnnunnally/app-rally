import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isLessonVideoData,
  LESSON_VIDEO_HELP,
  LESSON_VIDEO_LABEL,
  readLessonVideo,
} from "@/lib/lesson-video";
import { getLessonVideo, saveLessonVideo } from "@/lib/rally-server";

function LessonVideoPlayer({ video }: { video: string }) {
  return (
    <video
      className="mt-2 aspect-video w-full rounded-lg border border-border bg-black"
      src={video}
      controls
      playsInline
      preload="metadata"
    />
  );
}

export function LessonVideoRead({
  video,
  hasVideo,
}: {
  video?: string | null;
  hasVideo?: boolean;
}) {
  const playable = isLessonVideoData(video);
  return (
    <div>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{LESSON_VIDEO_LABEL}</p>
      {playable ? (
        <LessonVideoPlayer video={video!} />
      ) : hasVideo ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Practice / stroke video is on this lesson — open the lesson to play it.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No practice or stroke video yet.</p>
      )}
    </div>
  );
}

export function LessonVideoEditor({
  lessonId,
  video,
  hasVideo,
  onSaved,
}: {
  lessonId: number;
  video?: string | null;
  hasVideo?: boolean;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const needFetch = video === undefined && Boolean(hasVideo);
  const loaded = useQuery({
    queryKey: ["lesson-video", lessonId],
    queryFn: () => getLessonVideo({ data: { id: lessonId } }),
    enabled: needFetch,
  });
  const current = video !== undefined ? video : (loaded.data?.video_data ?? null);
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const shown = local !== undefined ? local : current;

  const save = useMutation({
    mutationFn: (next: string) => saveLessonVideo({ data: { id: lessonId, video_data: next } }),
    onSuccess: (_, next) => {
      setLocal(next || null);
      toast.success(next ? "Practice video saved on this lesson." : "Practice video removed.");
      void qc.invalidateQueries({ queryKey: ["desk"] });
      void qc.invalidateQueries({ queryKey: ["my-lessons"] });
      void qc.invalidateQueries({ queryKey: ["lesson-scan", lessonId] });
      void qc.invalidateQueries({ queryKey: ["lesson-video", lessonId] });
      void qc.invalidateQueries({ queryKey: ["home"] });
      void qc.invalidateQueries({ queryKey: ["notices"] });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-2">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{LESSON_VIDEO_LABEL}</p>
      <p className="text-xs text-muted-foreground">{LESSON_VIDEO_HELP}</p>
      {isLessonVideoData(shown) ? <LessonVideoPlayer video={shown!} /> : null}
      <label className="text-sm font-medium">
        {isLessonVideoData(shown) ? "Replace clip" : "Upload clip"}
        <input
          type="file"
          accept="video/*"
          className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground"
          disabled={save.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void readLessonVideo(file)
              .then((data) => save.mutate(data))
              .catch((err: unknown) => {
                toast.error(err instanceof Error ? err.message : "Could not use that video.");
              });
          }}
        />
      </label>
      {isLessonVideoData(shown) ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate("")}
          >
            Remove video
          </Button>
        </div>
      ) : null}
    </div>
  );
}
