import { supabaseAdmin } from "./supabaseAdmin";


export type WebhookEventStatus = "pending" | "success" | "failed";

export interface WebhookPayloadEnvelope<T = any> {
  eventType: string;
  timestamp: string;
  requestId: string;
  data: T;
  version: string;
}

interface WebhookSubscriptionRow {
  id: number;
  url: string;
  secret: string | null;
}

interface WebhookEventRow {
  id: number;
  subscription_id: number;
  event_type: string;
  request_id: string;
  payload: WebhookPayloadEnvelope;
  status: string;
  attempt_count: number;
}

function generateRequestId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${timePart}-${randomPart}`;
}

function buildEnvelope<T>(eventType: string, payload: T): WebhookPayloadEnvelope<T> {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();
  return {
    eventType,
    timestamp,
    requestId,
    data: payload,
    version: "1.0",
  };
}

async function signBody(secret: string | null, body: string, timestamp: string): Promise<string | null> {
  if (!secret) {
    return null;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(`${timestamp}.${body}`);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
  const signatureBytes = new Uint8Array(signatureBuffer);

  let hex = "";
  for (const byte of signatureBytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex;
}


export async function enqueueAndDispatchWebhook<T>(
  eventType: string,
  payload: T,
): Promise<void> {
  const envelope = buildEnvelope(eventType, payload);
  const body = JSON.stringify(envelope);

  const { data: subs, error: subsError } = await supabaseAdmin
    .from("webhook_subscriptions")
    .select("id, url, secret, enabled")
    .eq("enabled", true)
    .eq("event_type", eventType);

  if (subsError) {
    console.error("[webhooks] load subscriptions error", subsError);
    return;
  }

  const activeSubs = (subs || []).filter((row: any) => !!row.url) as WebhookSubscriptionRow[];
  if (!activeSubs.length) {
    return;
  }

  const rowsToInsert = activeSubs.map((sub) => ({
    subscription_id: sub.id,
    event_type: eventType,
    request_id: envelope.requestId,
    payload: envelope,
    status: "pending",
    attempt_count: 0,
  }));

  const { data: events, error: insertError } = await supabaseAdmin
    .from("webhook_events")
    .insert(rowsToInsert)
    .select("id, subscription_id, event_type, request_id, payload, status, attempt_count");

  if (insertError) {
    console.error("[webhooks] insert events error", insertError);
    return;
  }

  const rows = (events || []) as WebhookEventRow[];
  await Promise.all(rows.map((row) => dispatchSingleEvent(row.id)));
}

export async function dispatchSingleEvent(eventId: number): Promise<void> {
  const { data: eventRow, error: eventError } = await supabaseAdmin
    .from("webhook_events")
    .select("id, subscription_id, event_type, request_id, payload, status, attempt_count")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !eventRow) {
    if (eventError) {
      console.error("[webhooks] load event error", eventError);
    }
    return;
  }

  const event = eventRow as WebhookEventRow;

  const { data: subRow, error: subError } = await supabaseAdmin
    .from("webhook_subscriptions")
    .select("id, url, secret, enabled")
    .eq("id", event.subscription_id)
    .maybeSingle();

  if (subError || !subRow) {
    if (subError) {
      console.error("[webhooks] load subscription for event error", subError);
    }
    await supabaseAdmin
      .from("webhook_events")
      .update({
        status: "failed",
        attempt_count: event.attempt_count + 1,
        last_error: subError?.message || "subscription not found",
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    return;
  }

  const sub = subRow as WebhookSubscriptionRow & { enabled?: boolean };
  if (sub.enabled === false) {
    await supabaseAdmin
      .from("webhook_events")
      .update({
        status: "failed",
        attempt_count: event.attempt_count + 1,
        last_error: "subscription disabled",
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    return;
  }

  const timestamp = new Date().toISOString();
  const body = JSON.stringify(event.payload);
  const signature = await signBody(sub.secret, body, timestamp);


  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event-Type": event.event_type,
    "X-Webhook-Request-Id": event.request_id,
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Version": "1.0",
  };

  if (signature) {
    headers["X-Webhook-Signature"] = signature;
    headers["X-Webhook-Signature-Alg"] = "HMAC-SHA256";
  }

  let nextStatus: WebhookEventStatus = "success";
  let lastError: string | null = null;

  try {
    const res = await fetch(sub.url, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      nextStatus = "failed";
      const text = await res.text();
      lastError = `HTTP ${res.status}: ${text}`;
    }
  } catch (e: any) {
    nextStatus = "failed";
    lastError = e?.message ? String(e.message) : String(e);
    console.error("[webhooks] dispatch error", e);
  }

  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("webhook_events")
    .update({
      status: nextStatus,
      attempt_count: event.attempt_count + 1,
      last_error: lastError,
      last_attempt_at: nowIso,
      delivered_at: nextStatus === "success" ? nowIso : null,
    })
    .eq("id", event.id);
}
