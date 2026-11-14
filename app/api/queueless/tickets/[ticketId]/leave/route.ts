import {
  authenticateQueueLessRequest,
  isQueueLessUuid,
  queueLessActionError,
  queueLessDatabaseError,
} from "@/lib/queueless/server";

type RouteContext = { params: Promise<{ ticketId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const result = await authenticateQueueLessRequest(request);
  if (!result.auth) return result.response;

  const { ticketId } = await context.params;
  if (!isQueueLessUuid(ticketId)) {
    return Response.json({ error: "Bonul nu a fost găsit." }, { status: 404 });
  }

  try {
    const { error } = await result.auth.client.rpc("queueless_leave_queue", {
      p_ticket_id: ticketId,
    });
    if (error) {
      return queueLessActionError(error, "Nu am putut ieși din coadă.");
    }
    return Response.json({ success: true });
  } catch (error) {
    return queueLessDatabaseError(error, "Nu am putut ieși din coadă.");
  }
}
