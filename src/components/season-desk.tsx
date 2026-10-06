import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  VIDALIA_FALLBACK_NOTE,
  confirmSeasonShift,
  formatClock,
  type SeasonSuggestion,
} from "@/lib/daylight";
import { dismissSeasonSuggestion, listSeasonSuggestions, listWeatherHeadsUp } from "@/lib/daylight-server";
import { shiftLessonSeries } from "@/lib/schedule-server";

function refreshAfterShift(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["season-suggestions"] });
  void qc.invalidateQueries({ queryKey: ["weather-headsup"] });
  void qc.invalidateQueries({ queryKey: ["desk"] });
  void qc.invalidateQueries({ queryKey: ["my-lessons"] });
  void qc.invalidateQueries({ queryKey: ["home"] });
  void qc.invalidateQueries({ queryKey: ["notices"] });
  void qc.invalidateQueries({ queryKey: ["feed-lessons"] });
}

function clockLabel(hhmm: string): string {
  const [hour, minute] = hhmm.split(":").map(Number);
  return formatClock(hour! * 60 + minute!);
}

export function SeasonSuggestionsCard() {
  const qc = useQueryClient();
  const suggestions = useQuery({
    queryKey: ["season-suggestions"],
    queryFn: () => listSeasonSuggestions(),
  });
  const confirm = useMutation({
    mutationFn: (suggestion: SeasonSuggestion) => confirmSeasonShift(shiftLessonSeries, suggestion),
    onSuccess: (result) => {
      toast.success(`Series moved from that date (${result.moved}).`);
      refreshAfterShift(qc);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const dismiss = useMutation({
    mutationFn: (suggestion: SeasonSuggestion) =>
      dismissSeasonSuggestion({
        data: { series_id: suggestion.seriesId, from_date: suggestion.anchorDate },
      }),
    onSuccess: () => {
      toast.success("Suggestion hidden.");
      void qc.invalidateQueries({ queryKey: ["season-suggestions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = suggestions.data ?? [];
  if (suggestions.isPending || suggestions.isError || rows.length === 0) return null;

  return (
    <section className="mt-6" aria-label="Daylight suggestions">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">Daylight</p>
      <h2 className="mt-2 font-display text-2xl">Standing lessons and the sun</h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">
        When a series would start before sunrise or end after sunset, you can shift it. Nothing
        moves until you tap.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map((suggestion) => (
          <Card key={`${suggestion.seriesId}:${suggestion.fromDate}`}>
            <p className="text-sm">{suggestion.message}</p>
            {suggestion.playerName ? (
              <p className="mt-1 text-sm text-muted-foreground">With {suggestion.playerName}</p>
            ) : null}
            {suggestion.locationFallback ? (
              <p className="mt-2 text-xs text-muted-foreground">{VIDALIA_FALLBACK_NOTE}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={confirm.isPending || dismiss.isPending}
                onClick={() => confirm.mutate(suggestion)}
              >
                {confirm.isPending ? "Shifting…" : `Shift to ${clockLabel(suggestion.localTime)}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={confirm.isPending || dismiss.isPending}
                onClick={() => dismiss.mutate(suggestion)}
              >
                Dismiss
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function WeatherHeadsUp({ onPickDay }: { onPickDay: (day: string) => void }) {
  const weather = useQuery({
    queryKey: ["weather-headsup"],
    queryFn: () => listWeatherHeadsUp(),
  });
  const rows = weather.data ?? [];
  if (weather.isPending || weather.isError || rows.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3" aria-label="Weather heads-up">
      {rows.map((item) => (
        <Card key={item.lessonId} className="border-warn/40">
          <p className="text-xs tracking-widest text-warn uppercase">
            {item.flag === "thunder" ? "Thunderstorm" : "Rain likely"}
          </p>
          <p className="mt-2 text-sm">{item.message}</p>
          {item.courtName ? (
            <p className="mt-1 text-sm text-muted-foreground">{item.courtName}</p>
          ) : null}
          {item.locationFallback ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Forecast uses Vidalia, GA. This court has no map pin.
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => onPickDay(item.day)}
          >
            Cancel this day for weather
          </Button>
        </Card>
      ))}
    </div>
  );
}
