import { createFileRoute } from "@tanstack/react-router";
import { handleAuthPost } from "@/lib/auth/owner-sign-in.server";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => handleAuthPost(request),
    },
  },
});
