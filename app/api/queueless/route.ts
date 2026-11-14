import {
  authenticateQueueLessRequest,
  isQueueLessRecord,
  isQueueLessUuid,
  queueLessActionError,
  queueLessDatabaseError,
  readQueueLessJson,
} from "@/lib/queueless/server";

const activeStatuses = ["WAITING", "DELAYED", "NOTIFIED", "SERVING"];

export async function GET(request: Request) {
  const result = await authenticateQueueLessRequest(request);
  if (!result.auth) return result.response;

  try {
    const { client, userId } = result.auth;
    const [locationsResult, statsResult, ticketResult] = await Promise.all([
      client
        .from("queueless_locations")
        .select("id,code,name,category,description,address,average_service_minutes,required_documents")
        .eq("is_active", true)
        .order("category")
        .order("name"),
      client
        .from("queueless_queue_stats")
        .select("location_id,waiting_count,estimated_wait_minutes"),
      client
        .from("queueless_tickets")
        .select("id,location_id,user_id,ticket_number,ticket_code,queue_position,status,delay_used,counter_name,called_at,created_at,updated_at")
        .eq("user_id", userId)
        .in("status", activeStatuses)
        .maybeSingle(),
    ]);
    const error = locationsResult.error ?? statsResult.error ?? ticketResult.error;
    if (error) return queueLessDatabaseError(error, "Nu am putut încărca datele QueueLess.");

    const statsByLocation = new Map(
      (statsResult.data ?? []).map((stats) => [stats.location_id, stats]),
    );
    const locations = (locationsResult.data ?? []).map((location) => {
      const stats = statsByLocation.get(location.id);
      return {
        ...location,
        waiting_count: stats?.waiting_count ?? 0,
        estimated_wait_minutes: stats?.estimated_wait_minutes ?? 0,
      };
    });

    return Response.json(
      { locations, activeTicket: ticketResult.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return queueLessDatabaseError(error, "Nu am putut încărca datele QueueLess.");
  }
}

export async function POST(request: Request) {
  const result = await authenticateQueueLessRequest(request);
  if (!result.auth) return result.response;

  const body: unknown = await readQueueLessJson(request);
  if (!isQueueLessRecord(body) || !isQueueLessUuid(body.locationId)) {
    return Response.json({ error: "Alege o locație QueueLess validă." }, { status: 400 });
  }
  const confirmedDocuments = body.confirmedDocuments;
  if (!Array.isArray(confirmedDocuments) ||
    !confirmedDocuments.every((document) =>
      typeof document === "string" && document.length <= 160
    )) {
    return Response.json({ error: "Verificarea documentelor nu este validă." }, {
      status: 400,
    });
  }

  try {
    const { data: ticket, error } = await result.auth.client.rpc(
      "queueless_join_queue",
      {
        p_location_id: body.locationId,
        p_confirmed_documents: confirmedDocuments,
      },
    );
    if (error) {
      return queueLessActionError(error, "Nu am putut emite bonul virtual.");
    }
    return Response.json({ ticket }, { status: 201 });
  } catch (error) {
    return queueLessDatabaseError(error, "Nu am putut emite bonul virtual.");
  }
}
