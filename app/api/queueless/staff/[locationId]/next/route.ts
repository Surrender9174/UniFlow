import {
  authenticateQueueLessRequest,
  isQueueLessUuid,
  queueLessActionError,
  queueLessDatabaseError,
} from "@/lib/queueless/server";

type RouteContext = { params: Promise<{ locationId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const result = await authenticateQueueLessRequest(request);
  if (!result.auth) return result.response;

  const { locationId } = await context.params;
  if (!isQueueLessUuid(locationId)) {
    return Response.json({ error: "Locația nu a fost găsită." }, { status: 404 });
  }

  try {
    const { data, error } = await result.auth.client.rpc(
      "queueless_staff_next",
      { p_location_id: locationId },
    );
    if (error) {
      return queueLessActionError(error, "Nu am putut avansa coada.");
    }
    return Response.json(data);
  } catch (error) {
    return queueLessDatabaseError(error, "Nu am putut avansa coada.");
  }
}
