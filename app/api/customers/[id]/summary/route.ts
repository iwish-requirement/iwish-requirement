import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";

export const runtime = "edge";

function avgHours(rows: any[], startKey: string, endKey: string) {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const start = row[startKey] ? new Date(row[startKey]).getTime() : NaN;
    const end = row[endKey] ? new Date(row[endKey]).getTime() : NaN;
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      total += (end - start) / (1000 * 60 * 60);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    const activeError = ensureActiveUser(authResult.user);
    if (activeError) return activeError;

    const customerId = Number.parseInt(context.params.id, 10);
    if (Number.isNaN(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "invalid customer id" }, { status: 400 });
    }

    const [customerResult, projectsResult, demandsResult, departmentsResult] = await Promise.all([
      supabaseAdmin.from("customers").select("id, name, level, owner_user_id, status, remark").eq("id", customerId).maybeSingle(),
      supabaseAdmin.from("projects").select("id, name, type, url, status").eq("customer_id", customerId).order("id", { ascending: true }),
      supabaseAdmin
        .from("demands")
        .select("id, department_id, title, status, priority, fields, created_at, assigned_at, started_at, finished_at, delayed_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("departments").select("id, name"),
    ]);

    if (customerResult.error || !customerResult.data) {
      return NextResponse.json({ error: "customer not found", detail: customerResult.error?.message }, { status: 404 });
    }
    if (projectsResult.error || demandsResult.error || departmentsResult.error) {
      console.error("[api/customers/:id/summary] query error", projectsResult.error || demandsResult.error || departmentsResult.error);
      return NextResponse.json({ error: "failed_to_load_customer_summary" }, { status: 500 });
    }

    const demands = (demandsResult.data || []) as any[];
    const completed = demands.filter((row) => ["done", "closed"].includes(((row.status as string) || "").toLowerCase()));
    const delayed = demands.filter((row) => row.delayed_at || ((row.status as string) || "").toLowerCase() === "delayed");
    const deptMap = new Map((departmentsResult.data || []).map((row: any) => [row.id as number, (row.name as string) || "未命名部门"]));
    const involvedDepartments = Array.from(new Set(demands.map((row) => row.department_id).filter(Boolean)))
      .map((id) => ({ id, name: deptMap.get(id) || "未命名部门" }));

    const items = demands.slice(0, 50).map((row) => ({
      id: ((row.fields as any)?.code as string) || `REQ-${String(row.id).padStart(4, "0")}`,
      title: row.title,
      status: row.status,
      departmentId: row.department_id,
      departmentName: deptMap.get(row.department_id) || "未命名部门",
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      customer: customerResult.data,
      projects: projectsResult.data || [],
      metrics: {
        totalDemands: demands.length,
        completedDemands: completed.length,
        pendingDemands: demands.length - completed.length,
        delayRate: demands.length ? delayed.length / demands.length : 0,
        avgResponseHours: avgHours(completed, "created_at", "started_at"),
        avgProcessingHours: avgHours(completed, "started_at", "finished_at"),
        avgDeliveryHours: avgHours(completed, "created_at", "finished_at"),
        involvedDepartments,
      },
      demands: items,
    });
  } catch (error: any) {
    console.error("[api/customers/:id/summary] unexpected error", error);
    return NextResponse.json({ error: "failed_to_load_customer_summary", detail: error?.message ?? String(error) }, { status: 500 });
  }
}
