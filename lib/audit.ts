import { supabaseAdmin } from "./supabaseAdmin";

export async function writeAuditLog(input: {
  userId?: number | null;
  entityType: string;
  entityId?: number | null;
  action: string;
  changedFields?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: input.userId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      changed_fields: input.changedFields ?? null,
      metadata: input.metadata ?? null,
    });
    if (error) {
      console.error("[audit] write audit log error", error);
    }
  } catch (error) {
    console.error("[audit] write audit log unexpected error", error);
  }
}
