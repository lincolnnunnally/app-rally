import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CONTROLS: unknown[] = ["input", "select", "textarea", Input, Select, Textarea];

/**
 * Label + control with the label tied to the control (htmlFor/id), so tapping the
 * label focuses the field and screen readers announce it. Only the first child is
 * wired, and only when it is a real form control.
 */
export function FormField({
  label,
  hint,
  className = "flex flex-col gap-1.5",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const items = Children.toArray(children);
  const first = items[0];
  let id: string | undefined;
  if (isValidElement(first) && CONTROLS.includes(first.type)) {
    const el = first as ReactElement<{ id?: string; "aria-describedby"?: string }>;
    id = el.props.id ?? autoId;
    items[0] = cloneElement(el, {
      id,
      "aria-describedby": hint ? `${id}-hint` : el.props["aria-describedby"],
    });
  }
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {items}
      {hint ? (
        <p id={id ? `${id}-hint` : undefined} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
