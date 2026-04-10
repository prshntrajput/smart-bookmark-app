import { serve }          from "inngest/next";
import { inngest }        from "@/inngest/client";
import { enrichBookmark } from "@/inngest/functions/enrich-bookmark";

/**
 * Inngest serve handler — exposes the /api/inngest endpoint.
 *
 * Inngest uses GET to discover functions,
 *             POST to execute them,
 *             PUT for sync operations. [web:106]
 *
 * In dev: the Inngest Dev Server (npx inngest-cli dev) calls this endpoint.
 * In prod: Inngest cloud calls this endpoint after you deploy.
 */
export const { GET, POST, PUT } = serve({
  client:    inngest,
  functions: [enrichBookmark],
});