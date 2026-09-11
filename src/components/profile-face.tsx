import { cn } from "@/lib/utils";

export function ProfileFace({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-20" : size === "sm" ? "size-10" : "size-14";
  const letter = (name.trim()[0] || "?").toUpperCase();
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", dim)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary font-medium text-muted-foreground",
        dim,
        size === "lg" ? "text-2xl" : "text-sm",
      )}
    >
      {letter}
    </span>
  );
}

export async function compressProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photo (jpg, png, or heic).");
  }
  const bitmap = await createImageBitmap(file);
  const side = 512;
  const scale = Math.max(side / bitmap.width, side / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  ctx.drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h);
  if (typeof bitmap.close === "function") bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.72);
  if (data.length > 400_000) {
    throw new Error("That photo is still too large. Try a closer crop or a smaller file.");
  }
  return data;
}

export function PhotoPicker({
  name,
  photo,
  onChange,
}: {
  name: string;
  photo: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <ProfileFace name={name} photo={photo} size="lg" />
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Photo
          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-foreground"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void compressProfilePhoto(file)
                .then((data) => onChange(data))
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
          <p className="text-xs text-muted-foreground">A face photo helps people know who they are meeting at Ed Smith.</p>
        )}
      </div>
    </div>
  );
}
