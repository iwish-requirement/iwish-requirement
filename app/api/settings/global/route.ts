import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../lib/serverAuth";
import { ensureHasAnyPermission, ensureHasPermission } from "../../../../lib/serverPermissions";



export const runtime = "edge";

type AppSettingsRow = {
  id: number;
  system_name: string | null;
  registration_enabled: boolean | null;
};

function toResponsePayload(row: AppSettingsRow | null) {
  const systemName = (row?.system_name || "Nexus - 内部需求管理系统").toString();
  const registrationEnabled = !!row?.registration_enabled;

  return {
    systemName,
    registrationEnabled,
  };
}

async function loadSettingsRow(): Promise<AppSettingsRow | null> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("id, system_name, registration_enabled")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[api/settings/global] load settings error", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as number,
    system_name: (data.system_name as string | null) ?? null,
    registration_enabled: (data.registration_enabled as boolean | null) ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const authResult = await getBusinessUserFromRequest(req);
      if (authResult.errorResponse) {
        return authResult.errorResponse;
      }

      const permError = await ensureHasAnyPermission(authResult.user, [
        "settings.global.view",
        "settings.global.manage",
      ]);
      if (permError) {
        return permError;
      }
    }

    const row = await loadSettingsRow();
    const payload = toResponsePayload(row);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[api/settings/global] GET error", error);
    return NextResponse.json(
      {
        error: "failed to load global settings",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}


export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "settings.global.manage");

    if (permError) {
      return permError;
    }


    const body = await req.json();
    const systemNameRaw = body.systemName as string | null | undefined;
    const registrationEnabledRaw = body.registrationEnabled as boolean | null | undefined;

    const update: Record<string, any> = {};

    if (typeof systemNameRaw === "string") {
      const trimmed = systemNameRaw.trim();
      update.system_name = trimmed.length > 0 ? trimmed : null;
    }

    if (typeof registrationEnabledRaw === "boolean") {
      update.registration_enabled = registrationEnabledRaw;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "nothing to update" },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    update.updated_at = nowIso;

    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        id: 1,
        ...update,
      }, { onConflict: "id" })
      .select("id, system_name, registration_enabled")
      .maybeSingle();

    if (error || !data) {
      console.error("[api/settings/global] PATCH upsert error", error);
      return NextResponse.json(
        {
          error: "failed to update global settings",
          detail: error?.message ?? "upsert failed",
        },
        { status: 500 },
      );
    }

    const row: AppSettingsRow = {
      id: data.id as number,
      system_name: (data.system_name as string | null) ?? null,
      registration_enabled: (data.registration_enabled as boolean | null) ?? null,
    };

    return NextResponse.json(toResponsePayload(row));
  } catch (error: any) {
    console.error("[api/settings/global] PATCH error", error);
    return NextResponse.json(
      {
        error: "failed to update global settings",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
