import { Badge } from "@/components/ui/badge";
/** Marks features that are UI-only until a backend is connected. */
export function NotConnected({ label = "Not connected yet" }: { label?: string }) {
  return <Badge variant="outline" className="border-warning-foreground/30 bg-warning font-semibold text-warning-foreground">{label}</Badge>;
}
