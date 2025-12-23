import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../../lib/serverPermissions";
import { dispatchSingleEvent } from "../../../../lib/webhooks";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasAnyPermission(authResult.user, [
    "settings.webhooks.view",
    "settings.webhooks.manage",
    "admin.user_manage",
  ]);
  if (permError) {
    return permError;
  }

  const url = new URL(req.url);
  const subscriptionIdParam = url.searchParams.get("subscriptionId");
  const eventType = url.searchParams.get("eventType");
  const status = url.searchParams.get("status");
  const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSizeParam = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const basePageSize = Number.isNaN(pageSizeParam) || pageSizeParam < 1 ? 20 : pageSizeParam;
  const pageSize = Math.min(basePageSize, 100);

  let query = supabaseAdmin
    .from("webhook_events")
    .select("id, subscription_id, event_type, request_id, status, attempt_count, last_error, created_at, last_attempt_at, delivered_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (subscriptionIdParam) {
    const subIdNum = Number(subscriptionIdParam);
    if (!Number.isNaN(subIdNum) && subIdNum > 0) {
      query = query.eq("subscription_id", subIdNum);
    }
  }

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("[api/webhooks/events] list events error", error);
    return NextResponse.json(
      { error: "failed_to_load_webhook_events", detail: error.message },
      { status: 500 },
    );
  }

  const items = (data || []).map((row: any) => ({
    id: row.id as number,
    subscriptionId: row.subscription_id as number,
    eventType: (row.event_type as string) || "",
    requestId: (row.request_id as string) || "",
    status: (row.status as string) || "pending",
    attemptCount: (row.attempt_count as number) ?? 0,
    lastError: (row.last_error as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    lastAttemptAt: (row.last_attempt_at as string | null) ?? null,
    deliveredAt: (row.delivered_at as string | null) ?? null,
  }));

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: count ?? items.length,
  });
}

export async function POST(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasPermission(authResult.user, "settings.webhooks.manage");
  if (permError) {
    return permError;
  }

  const body = await req.json();
  const rawEventId = body.eventId as number | string | null | undefined;
  const eventId = rawEventId != null && rawEventId !== "" ? Number(rawEventId) : NaN;

  if (!eventId || Number.isNaN(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "invalid_event_id" }, { status: 400 });
  }

  await dispatchSingleEvent(eventId);

  return NextResponse.json({ success: true });
}
