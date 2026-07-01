import { NextRequest, NextResponse } from "next/server";
import { getBusinessUserFromRequest } from "../../../../../../lib/serverAuth";
import { ensureHasAnyPermission } from "../../../../../../lib/serverPermissions";
import { syncCreativeDemandsToFeishuSheet } from "../../../../../../lib/creativeDemandSheetSync";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const permError = await ensureHasAnyPermission(authResult.user, [
      "settings.global.manage",
      "settings.webhooks.manage",
      "settings.departments.manage",
    ]);
    if (permError) {
      return permError;
    }

    const result = await syncCreativeDemandsToFeishuSheet({
      source: "manual",
    });

    if (result.skipped) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[api/integrations/feishu/creative-demands/sync] error", error);
    return NextResponse.json(
      {
        error: "failed_to_sync_creative_demands_to_feishu",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
