import type { Instrumentation } from "next";

/**
 * Server errors in one structured line, so they're easy to find and filter in
 * Vercel's runtime logs (Logs tab, filter by "[hrleaf:error]").
 * Never logs request bodies or cookies.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    "[hrleaf:error]",
    JSON.stringify({
      message: err.message,
      digest: err.digest,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      kind: context.routeType,
      stack: err.stack?.split("\n").slice(0, 6).join("\n"),
    }),
  );
};
