import {
  authenticateQueueLessRequest,
  queueLessDatabaseError,
} from "@/lib/queueless/server";

const activeStatuses = ["WAITING", "DELAYED", "NOTIFIED", "SERVING"];

export async function GET(request: Request) {
  const result = await authenticateQueueLessRequest(request);
  if (!result.auth) return result.response;

  try {
    const { client, userId } = result.auth;
    const { data: assignments, error: assignmentError } = await client
      .from("queueless_staff")
      .select("location_id")
      .eq("user_id", userId);
    if (assignmentError) {
      return queueLessDatabaseError(assignmentError, "Nu am putut verifica accesul de personal.");
    }

    const locationIds = (assignments ?? []).map((assignment) => assignment.location_id);
    if (!locationIds.length) return Response.json({ locations: [] });

    const [locationsResult, statsResult, ticketsResult] = await Promise.all([
      client
        .from("queueless_locations")
        .select("id,name,category")
        .in("id", locationIds)
        .eq("is_active", true)
        .order("name"),
      client
        .from("queueless_queue_stats")
        .select("location_id,waiting_count,estimated_wait_minutes")
        .in("location_id", locationIds),
      client
        .from("queueless_tickets")
        .select("id,location_id,ticket_code,queue_position,status,delay_used,counter_name")
        .in("location_id", locationIds)
        .in("status", activeStatuses)
        .order("queue_position")
        .limit(200),
    ]);
    const error = locationsResult.error ?? statsResult.error ?? ticketsResult.error;
    if (error) {
      return queueLessDatabaseError(error, "Nu am putut încărca cozile atribuite.");
    }

    const statsByLocation = new Map(
      (statsResult.data ?? []).map((stats) => [stats.location_id, stats]),
    );
    const ticketsByLocation = new Map<string, Array<NonNullable<typeof ticketsResult.data>[number]>>();
    for (const ticket of ticketsResult.data ?? []) {
      const current = ticketsByLocation.get(ticket.location_id) ?? [];
      current.push(ticket);
      ticketsByLocation.set(ticket.location_id, current);
    }

    return Response.json({
      locations: (locationsResult.data ?? []).map((location) => {
        const stats = statsByLocation.get(location.id);
        return {
          ...location,
          waiting_count: stats?.waiting_count ?? 0,
          estimated_wait_minutes: stats?.estimated_wait_minutes ?? 0,
          tickets: ticketsByLocation.get(location.id) ?? [],
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return queueLessDatabaseError(error, "Nu am putut încărca cozile atribuite.");
  }
}
