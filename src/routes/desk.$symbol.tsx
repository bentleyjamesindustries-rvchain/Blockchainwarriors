import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/desk/$symbol")({
  component: function DeskRedirect() {
    const { symbol: raw } = Route.useParams();
    const symbol = raw === "DOGE-USD" ? "DOGE-USD" : "BTC-USD";
    return <Navigate to="/" search={{ symbol }} />;
  },
});
