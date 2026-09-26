import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  assertLessonVideoChoice,
  isLessonVideoSrc,
  LESSON_VIDEO_ERRORS,
  LESSON_VIDEO_HELP,
  LESSON_VIDEO_LABEL,
  lessonVideoUiMessage,
  readLessonVideoDuration,
  uploadLessonVideoFile,
} from "@/lib/lesson-video";
import {
  commitLessonVideo,
  getLessonVideo,
  getLessonVideoSetup,
  prepareLessonVideoUpload,
  removeLessonVideo,
} from "@/lib/rally-server";

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

function useLessonVideoSrc(lessonId: number | undefined, video: string | null | undefined, hasVideo?: boolean) {
  const needFetch = Boolean(lessonId) && video === undefined && Boolean(hasVideo);
  const loaded = useQuery({
    queryKey: ["lesson-video", lessonId],
    queryFn: () => getLessonVideo({ data: { id: lessonId! } }),
    enabled: needFetch,
  });
  const current = video !== undefined ? video : (loaded.data?.src ?? null);
  const [local, setLocal] = useState<string | null | undefined>(undefined);
  const shown = local !== undefined ? local : current;
  return { shown, setLocal };
}

export function LessonVideoRead({
  video,
  hasVideo,
  lessonId,
}: {
  video?: string | null;
  hasVideo?: boolean;
  lessonId?: number;
}) {
  const { shown } = useLessonVideoSrc(lessonId, video, hasVideo);
  const playable = isLessonVideoSrc(shown);
  return (
    <div>
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{LESSON_VIDEO_LABEL}</p>
      {playable ? (
        <LessonVideoPlayer video={shown!} />
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
  const { shown, setLocal } = useLessonVideoSrc(lessonId, video, hasVideo);
  const setup = useQuery({
    queryKey: ["lesson-video-setup"],
    queryFn: () => getLessonVideoSetup(),
  });
  const [uploadBlocked, setUploadBlocked] = useState(false);
  const notSetUp = uploadBlocked || setup.data?.ready === false;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["desk"] });
    void qc.invalidateQueries({ queryKey: ["my-lessons"] });
    void qc.invalidateQueries({ queryKey: ["lesson-scan", lessonId] });
    void qc.invalidateQueries({ queryKey: ["lesson-video", lessonId] });
    void qc.invalidateQueries({ queryKey: ["home"] });
    void qc.invalidateQueries({ queryKey: ["notices"] });
    onSaved?.();
  };

  const save = useMutation({
    mutationFn: async (file: File) => {
      const durationSec = await readLessonVideoDuration(file);
      const choice = assertLessonVideoChoice({
        contentType: file.type,
        fileName: file.name,
        byteSize: file.size,
        durationSec,
      });
      const prepared = await prepareLessonVideoUpload({
        data: {
          id: lessonId,
          content_type: choice.contentType,
          byte_size: file.size,
          duration_sec: durationSec,
        },
      });
      try {
        await uploadLessonVideoFile(prepared.signedUrl, file);
      } catch (err) {
        throw new Error(lessonVideoUiMessage(err));
      }
      return commitLessonVideo({ data: { id: lessonId, video_path: prepared.path } });
    },
    onSuccess: (result) => {
      setLocal(result.src);
      toast.success("Practice video saved on this lesson.");
      refresh();
    },
    onError: (e: Error) => {
      const message = lessonVideoUiMessage(e);
      if (message === LESSON_VIDEO_ERRORS.notSetUp) setUploadBlocked(true);
      toast.error(message);
    },
  });

  const remove = useMutation({
    mutationFn: () => removeLessonVideo({ data: { id: lessonId } }),
    onSuccess: () => {
      setLocal(null);
      toast.success("Practice video removed.");
      refresh();
    },
    onError: (e: Error) => toast.error(lessonVideoUiMessage(e)),
  });

  const busy = save.isPending || remove.isPending;
  const playable = isLessonVideoSrc(shown);

  return (
    <div className="grid gap-2">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{LESSON_VIDEO_LABEL}</p>
      <p className="text-xs text-muted-foreground">{LESSON_VIDEO_HELP}</p>
      {playable ? <LessonVideoPlayer video={shown!} /> : null}
      {notSetUp ? (
        <p className="text-sm text-muted-foreground">{LESSON_VIDEO_ERRORS.notSetUp}</p>
      ) : (
        <label className="text-sm font-medium">
          {playable ? "Replace clip" : "Upload clip"}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground"
            disabled={busy || setup.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              save.mutate(file);
            }}
          />
        </label>
      )}
      {playable ? (
        <div>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove.mutate()}>
            Remove video
          </Button>
        </div>
      ) : null}
    </div>
  );
}
