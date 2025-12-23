import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../lib/serverPermissions";

export const runtime = "edge";

type WebhookSubscriptionDto = {
  id: number;
  eventType: string;
  url: string;
  secret?: string | null;
  provider?: string | null;
  enabled: boolean;
  createdByUserId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function shapeSubscription(row: any): WebhookSubscriptionDto {
  return {
    id: row.id as number,
    eventType: (row.event_type as string) || "",
    url: (row.url as string) || "",
    secret: (row.secret as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    enabled: !!row.enabled,
    createdByUserId: (row.created_by_user_id as number | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

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
  const eventType = url.searchParams.get("eventType");
  const enabledParam = url.searchParams.get("enabled");

  let query = supabaseAdmin
    .from("webhook_subscriptions")
    .select("id, event_type, url, secret, provider, enabled, created_by_user_id, created_at, updated_at")
    .order("id", { ascending: true });

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  if (enabledParam === "true") {
    query = query.eq("enabled", true);
  } else if (enabledParam === "false") {
    query = query.eq("enabled", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/webhooks] list subscriptions error", error);
    return NextResponse.json(
      { error: "failed_to_load_webhooks", detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data || []) as any[];
  const items = rows.map((row) => shapeSubscription(row));

  return NextResponse.json({ items });
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

  const rawId = body.id as number | string | null | undefined;
  const rawEventType = body.eventType as string | null | undefined;
  const rawUrl = body.url as string | null | undefined;
  const rawSecret = body.secret as string | null | undefined;
  const rawProvider = body.provider as string | null | undefined;
  const rawEnabled = body.enabled as boolean | null | undefined;

  const eventType = (rawEventType ?? "").toString().trim();
  const url = (rawUrl ?? "").toString().trim();

  if (!eventType || !url) {
    return NextResponse.json(
      { error: "eventType_and_url_required" },
      { status: 400 },
    );
  }

  const provider = rawProvider == null ? null : rawProvider.toString().trim();
  const secret = rawSecret == null ? null : rawSecret.toString();
  const enabled = rawEnabled == null ? true : !!rawEnabled;

  const nowIso = new Date().toISOString();
  const idNumber = rawId != null && rawId !== "" ? Number(rawId) : null;

  if (idNumber != null && !Number.isNaN(idNumber) && idNumber > 0) {
    const { data, error } = await supabaseAdmin
      .from("webhook_subscriptions")
      .update({
        event_type: eventType,
        url,
        secret,
        provider,
        enabled,
        updated_at: nowIso,
      })
      .eq("id", idNumber)
      .select("id, event_type, url, secret, provider, enabled, created_by_user_id, created_at, updated_at")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/webhooks] update subscription error", error);
      return NextResponse.json(
        {
          error: "failed_to_update_webhook",
          detail: error?.message ?? "update failed",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ subscription: shapeSubscription(data) });
  }

  const { data, error } = await supabaseAdmin
    .from("webhook_subscriptions")
    .insert({
      event_type: eventType,
      url,
      secret,
      provider,
      enabled,
      created_by_user_id: authResult.user?.id ?? null,
      created_at: nowIso,
    })
    .select("id, event_type, url, secret, provider, enabled, created_by_user_id, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    console.error("[api/webhooks] create subscription error", error);
    return NextResponse.json(
      {
        error: "failed_to_create_webhook",
        detail: error?.message ?? "insert failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ subscription: shapeSubscription(data) });
}

export async function DELETE(req: NextRequest) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const permError = await ensureHasPermission(authResult.user, "settings.webhooks.manage");
  if (permError) {
    return permError;
  }

  const body = await req.json();
  const rawId = body.id as number | string | null | undefined;
  const id = rawId != null && rawId !== "" ? Number(rawId) : NaN;

  if (!id || Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "invalid_webhook_id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("webhook_subscriptions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[api/webhooks] delete subscription error", error);
    return NextResponse.json(
      { error: "failed_to_delete_webhook", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
