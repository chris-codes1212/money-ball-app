// Lightweight liveness probe for the load balancer. Intentionally does NOT touch
// the database, so the service reports healthy even before migrations have run.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
