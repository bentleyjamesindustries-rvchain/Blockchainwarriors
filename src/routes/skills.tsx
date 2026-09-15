import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/skills")({
  component: () => <Navigate to="/" />,
});
