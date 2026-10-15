import { lessonScanPath } from "@/lib/lesson-status";
import { rallyQrSrc } from "@/lib/pay-href";

/** Large lesson QR for the coach's screen. Same /scan route as LessonScanQr (check in, then check out). */
export function CheckInQr({ lessonId, label }: { lessonId: number; label: string }) {
  const path = lessonScanPath(lessonId);
  const url =
    typeof window === "undefined" ? `https://rally.unitedundergod.org${path}` : `${window.location.origin}${path}`;
  return (
    <div className="mt-3">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Check-in QR</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The player points their phone camera here to check in. Scan again at the end to check out.
      </p>
      <img
        src={rallyQrSrc(url)}
        alt={`Check-in QR for ${label}`}
        width={300}
        height={300}
        className="mt-2 w-full max-w-[300px] rounded-md border border-border bg-white p-3"
      />
      <p className="mt-2 break-all font-mono text-xs">{url}</p>
    </div>
  );
}
