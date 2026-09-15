import { Badge } from "@/components/ui/badge";
import type { TradeState } from "@/lib/types";

const MAP: Record<TradeState, { label: string; variant: "default" | "steel" | "long" | "short" | "wait" | "outline" }> = {
  IDLE: { label: "Idle", variant: "outline" },
  WATCH: { label: "Watch", variant: "wait" },
  ARMED: { label: "Armed", variant: "steel" },
  ENTRY: { label: "Entry", variant: "long" },
  MANAGE: { label: "Manage", variant: "long" },
  FLAT: { label: "Flat", variant: "default" },
};

export function StateBadge({ state }: { state: TradeState }) {
  const m = MAP[state];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
