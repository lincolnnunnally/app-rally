import { type ReactNode, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  appleMapsHref,
  googleDirectionsHref,
  osmEmbedSrc,
  osmTileUrl,
  preferAppleMaps,
  type Court,
  type CourtPlace,
} from "@/lib/rally";
import { cn } from "@/lib/utils";

export function DirectionsLink({
  court,
  className,
  children,
}: {
  court: CourtPlace;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={googleDirectionsHref(court)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        if (preferAppleMaps()) {
          e.preventDefault();
          window.location.href = appleMapsHref(court);
        }
      }}
    >
      {children ?? "Get directions"}
    </a>
  );
}

export function DirectionsButton({
  court,
  variant = "outline",
  size = "default",
}: {
  court: CourtPlace;
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm";
}) {
  return (
    <Button asChild variant={variant} size={size}>
      <DirectionsLink court={court}>
        <MapPin />
        Get directions
      </DirectionsLink>
    </Button>
  );
}

export async function compressFacilityPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photo of the courts (jpg, png, or heic).");
  }
  const bitmap = await createImageBitmap(file);
  const width = 960;
  const height = 540;
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h);
  if (typeof bitmap.close === "function") bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.72);
  if (data.length > 400_000) {
    throw new Error("That photo is still too large. Try a closer crop or a smaller file.");
  }
  return data;
}

export function FacilityPhotoPicker({
  photo,
  onChange,
}: {
  photo: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {photo ? (
        <img src={photo} alt="" className="aspect-[16/9] w-full rounded-lg border border-border object-cover" />
      ) : null}
      <label className="text-sm font-medium">
        Photo of the courts
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void compressFacilityPhoto(file)
              .then(onChange)
              .catch((err: unknown) => {
                window.alert(err instanceof Error ? err.message : "Could not use that photo.");
              });
          }}
        />
      </label>
      {photo ? (
        <button
          type="button"
          className="text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange(null)}
        >
          Remove photo
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          A picture of the actual courts helps people know they found the right gate. The map still
          gives directions.
        </p>
      )}
    </div>
  );
}

export function FacilityThumb({
  court,
  className,
}: {
  court: Pick<Court, "name" | "address" | "city" | "lat" | "lng"> & { photo_data?: string | null };
  className?: string;
}) {
  const photo = court.photo_data;
  const tile = osmTileUrl(court);
  return (
    <DirectionsLink
      court={court}
      className={cn(
        "relative block overflow-hidden rounded-lg border border-border bg-secondary",
        className ?? "aspect-[16/9] w-full",
      )}
    >
      {photo ? (
        <img src={photo} alt={court.name} className="size-full object-cover" />
      ) : tile ? (
        <img
          src={tile}
          alt={`Map of ${court.name}`}
          className="size-full scale-150 object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-xs text-muted-foreground">
          Open maps for directions
        </span>
      )}
      {!photo && tile ? (
        <span className="absolute bottom-2 left-2 text-[9px] text-background/90">© OpenStreetMap</span>
      ) : null}
      <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium">
        <MapPin className="size-3" />
        Directions
      </span>
    </DirectionsLink>
  );
}

export function FacilityMap({ court }: { court: CourtPlace }) {
  const src = osmEmbedSrc(court);
  if (!src) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          No map pin yet. Directions still use the street address.
        </p>
        <div className="mt-3">
          <DirectionsButton court={court} />
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <iframe
        title={`Map of ${court.name}`}
        src={src}
        className="h-64 w-full border-0 md:h-80"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Map ©{" "}
          <a
            className="underline decoration-border underline-offset-4"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap
          </a>
        </p>
        <DirectionsButton court={court} size="sm" />
      </div>
    </div>
  );
}

export function FacilityHero({
  court,
  onPhoto,
}: {
  court: Court;
  onPhoto?: (next: string | null) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {court.photo_data ? (
        <img
          src={court.photo_data}
          alt={court.name}
          className="aspect-[16/9] w-full rounded-xl border border-border object-cover"
        />
      ) : null}
      <FacilityMap court={court} />
      {onPhoto ? <CourtPhotoField photo={court.photo_data} onChange={onPhoto} /> : null}
    </div>
  );
}

function CourtPhotoField({
  photo,
  onChange,
}: {
  photo: string | null;
  onChange: (next: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <p className="text-xs text-muted-foreground">
      {photo ? "Replace the court photo: " : "Add a photo of these courts: "}
      <label className="cursor-pointer underline decoration-border underline-offset-4 hover:text-foreground">
        {busy ? "Reading…" : "choose a picture"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            void compressFacilityPhoto(file)
              .then(onChange)
              .catch((err: unknown) => {
                window.alert(err instanceof Error ? err.message : "Could not use that photo.");
              })
              .finally(() => setBusy(false));
          }}
        />
      </label>
    </p>
  );
}
