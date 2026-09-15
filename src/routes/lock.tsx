import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/lock")({
  component: () => <Navigate to="/" />,
});
