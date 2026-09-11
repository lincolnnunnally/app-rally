import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  HONOR_KINDS,
  honorKindLabel,
  type CertItem,
  type HonorItem,
} from "@/lib/rally";

export function CertEditor({
  items,
  onChange,
}: {
  items: CertItem[];
  onChange: (next: CertItem[]) => void;
}) {
  return (
    <div>
      <Label>Certifications</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        USPTA, PPR, PTR, USTA, first aid — whatever you actually hold.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]">
            <Input
              value={item.title}
              placeholder="USPTA"
              onChange={(e) => {
                const next = items.slice();
                next[i] = { ...item, title: e.target.value };
                onChange(next);
              }}
            />
            <Input
              value={item.issuer}
              placeholder="Issuer"
              onChange={(e) => {
                const next = items.slice();
                next[i] = { ...item, issuer: e.target.value };
                onChange(next);
              }}
            />
            <Input
              value={item.year}
              placeholder="Year"
              onChange={(e) => {
                const next = items.slice();
                next[i] = { ...item, year: e.target.value };
                onChange(next);
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => onChange([...items, { title: "", issuer: "", year: "" }])}
      >
        Add certification
      </Button>
    </div>
  );
}

export function HonorEditor({
  items,
  onChange,
}: {
  items: HonorItem[];
  onChange: (next: HonorItem[]) => void;
}) {
  return (
    <div>
      <Label>Titles, trophies, competitions</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        What you have won or played. Leave blank if you are just getting started — empty stays empty.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr_5rem_auto]">
            <Select
              value={item.kind}
              onChange={(e) => {
                const kind = e.target.value as HonorItem["kind"];
                const next = items.slice();
                next[i] = { ...item, kind };
                onChange(next);
              }}
            >
              {HONOR_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <Input
              value={item.title}
              placeholder="Champion / finalist / participant"
              onChange={(e) => {
                const next = items.slice();
                next[i] = { ...item, title: e.target.value };
                onChange(next);
              }}
            />
            <Input
              value={item.event}
              placeholder="Event or league"
              onChange={(e) => {
                const next = items.slice();
                next[i] = { ...item, event: e.target.value };
                onChange(next);
              }}
            />
            <Input
              value={item.year}
              placeholder="Year"
              onChange={(e) => {
                const next = items.slice();
                next[i] = { ...item, year: e.target.value };
                onChange(next);
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => onChange([...items, { title: "", event: "", year: "", kind: "title" }])}
      >
        Add title or result
      </Button>
    </div>
  );
}

export function ProofDisplay({
  certs,
  honors,
}: {
  certs: CertItem[];
  honors: HonorItem[];
}) {
  if (certs.length === 0 && honors.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 text-sm">
      {certs.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Certifications
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {certs.map((c, i) => (
              <li key={i}>
                {c.title}
                {c.issuer ? ` · ${c.issuer}` : ""}
                {c.year ? ` · ${c.year}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {honors.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Titles and results
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {honors.map((h, i) => (
              <li key={i}>
                {honorKindLabel(h.kind)} · {h.title}
                {h.event ? ` · ${h.event}` : ""}
                {h.year ? ` · ${h.year}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
