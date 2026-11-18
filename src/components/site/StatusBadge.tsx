import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/labels";

export function StatusBadge<T extends string>({
  options,
  value,
  className,
}: {
  options: { value: T; label: string; tone?: Tone }[];
  value: T | null | undefined;
  className?: string;
}) {
  const opt = options.find((o) => o.value === value);
  if (!opt) return <Badge variant="muted" className={className}>—</Badge>;
  const tone = opt.tone ?? "default";
  return (
    <Badge variant={tone} className={className}>
      {opt.label}
    </Badge>
  );
}
