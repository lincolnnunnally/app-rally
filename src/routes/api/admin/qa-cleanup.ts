import { createFileRoute } from "@tanstack/react-router";
import { handleQaCleanup } from "@/lib/qa-cleanup";

export const Route = createFileRoute("/api/admin/qa-cleanup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }
        const result = await handleQaCleanup({
          vercelEnv: process.env.VERCEL_ENV,
          token: process.env.QA_CLEANUP_TOKEN,
          authorization: request.headers.get("authorization"),
          body,
        });
        return Response.json(result.body, {
          status: result.status,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
