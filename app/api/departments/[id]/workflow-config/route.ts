import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest, ensureActiveUser } from "../../../../../lib/serverAuth";
import { ensureHasAnyPermission } from "../../../../../lib/serverPermissions";
import type { DepartmentWorkflowConfig, PriorityConfig, StatusConfig } from "../../../../../types";
import { resolveDepartmentDemandRules } from "../../../../../lib/departmentDemandRules";


export const runtime = "edge";

/**
 * GET /api/departments/[id]/workflow-config
 * 获取部门的优先级和状态配置
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const activeError = ensureActiveUser(authResult.user);
  if (activeError) {
    return activeError;
  }

  // 说明：工作流配置不仅用于「系统设置 - 工作流配置」页面，
  // 还会在需求详情页等业务页面用于展示状态映射与状态流转。
  // 因此这里不再强制要求 settings.workflow.* 或 settings.* 权限，
  // 只要是已登录且处于有效状态的业务用户就可以读取部门的配置，
  // 以保证普通业务账号也能看到正确的优先级/状态映射与流转信息。

  const departmentId = parseInt(params.id, 10);


  if (Number.isNaN(departmentId) || departmentId <= 0) {
    return NextResponse.json({ error: "invalid department id" }, { status: 400 });
  }

  const { data: dept, error } = await supabaseAdmin
    .from("departments")
    .select("id, name, slug, config, priority_config, status_config")
    .eq("id", departmentId)
    .maybeSingle();

  if (error || !dept) {
    console.error("[api/departments/workflow-config] query error", error);
    return NextResponse.json(
      { error: "department not found", detail: error?.message },
      { status: 404 }
    );
  }

  const config: DepartmentWorkflowConfig = {
    priorities: (dept.priority_config as PriorityConfig[]) || [],
    statuses: (dept.status_config as StatusConfig[]) || [],
    rules: resolveDepartmentDemandRules((dept as any).config, (dept as any).slug),
  };

  return NextResponse.json(
    {
      departmentId: dept.id,
      departmentName: dept.name,
      config,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

/**
 * PUT /api/departments/[id]/workflow-config
 * 更新部门的优先级和状态配置
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await getBusinessUserFromRequest(req);
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const activeError = ensureActiveUser(authResult.user);
  if (activeError) {
    return activeError;
  }

  const permError = await ensureHasAnyPermission(authResult.user, [
    "settings.workflow.manage",
    "settings.departments.manage",
    "settings.global.manage",
  ]);
  if (permError) {
    return permError;
  }

  const departmentId = parseInt(params.id, 10);

  if (Number.isNaN(departmentId) || departmentId <= 0) {
    return NextResponse.json({ error: "invalid department id" }, { status: 400 });
  }

  const body = await req.json();
  const config = body.config as DepartmentWorkflowConfig | undefined;

  if (!config || !config.priorities || !config.statuses) {
    return NextResponse.json(
      { error: "config.priorities and config.statuses are required" },
      { status: 400 }
    );
  }

  // 验证配置格式
  for (const p of config.priorities) {
    if (!p.value || !p.label || !p.color || typeof p.order !== 'number') {
      return NextResponse.json(
        { error: "invalid priority config format" },
        { status: 400 }
      );
    }
  }

  for (const s of config.statuses) {
    if (!s.value || !s.label || !s.color || typeof s.order !== 'number') {
      return NextResponse.json(
        { error: "invalid status config format" },
        { status: 400 }
      );
    }
    // 验证 transitions 格式（如果存在）
    if (s.transitions !== undefined) {
      if (!Array.isArray(s.transitions)) {
        return NextResponse.json(
          { error: "invalid transitions format: must be an array" },
          { status: 400 }
        );
      }
      // 检查 transitions 中的每个值是否在 statuses 中存在
      const statusValues = config.statuses.map(st => st.value);
      for (const transValue of s.transitions) {
        if (!statusValues.includes(transValue)) {
          return NextResponse.json(
            { error: `invalid transition value: ${transValue} is not a valid status` },
            { status: 400 }
          );
        }
      }
    }
  }

  // 获取当前配置，检查是否删除了正在使用的状态或优先级
  const { data: currentDept, error: fetchError } = await supabaseAdmin
    .from("departments")
    .select("priority_config, status_config")
    .eq("id", departmentId)
    .maybeSingle();

  if (fetchError) {
    console.error("[api/departments/workflow-config] fetch current config error", fetchError);
    return NextResponse.json(
      { error: "failed to fetch current config", detail: fetchError.message },
      { status: 500 }
    );
  }

  if (currentDept) {
    const currentPriorities = (currentDept.priority_config as PriorityConfig[]) || [];
    const currentStatuses = (currentDept.status_config as StatusConfig[]) || [];

    const newPriorityValues = config.priorities.map(p => p.value);
    const newStatusValues = config.statuses.map(s => s.value);

    // 检查被删除的优先级
    const removedPriorities = currentPriorities
      .map(p => p.value)
      .filter(v => !newPriorityValues.includes(v));

    // 检查被删除的状态
    const removedStatuses = currentStatuses
      .map(s => s.value)
      .filter(v => !newStatusValues.includes(v));

    // 如果有被删除的优先级或状态，检查是否正在被使用
    if (removedPriorities.length > 0 || removedStatuses.length > 0) {
      const { data: demandsData, error: demandsError } = await supabaseAdmin
        .from("demands")
        .select("id, title, priority, status")
        .eq("department_id", departmentId);

      if (demandsError) {
        console.error("[api/departments/workflow-config] check demands usage error", demandsError);
        return NextResponse.json(
          { error: "failed to check usage", detail: demandsError.message },
          { status: 500 }
        );
      }

      const demands = demandsData || [];

      // 检查优先级使用情况
      if (removedPriorities.length > 0) {
        const usedPriorities = demands
          .filter(d => removedPriorities.includes(d.priority as string))
          .map(d => ({ id: d.id, title: d.title, priority: d.priority }));

        if (usedPriorities.length > 0) {
          const examples = usedPriorities.slice(0, 3).map(d => `${d.title} (${d.priority})`).join(', ');
          return NextResponse.json(
            {
              error: "cannot remove priority in use",
              message: `无法删除正在使用的优先级。以下需求正在使用这些优先级：${examples}${usedPriorities.length > 3 ? ` 等 ${usedPriorities.length} 条需求` : ''}`,
              affectedDemands: usedPriorities.length,
            },
            { status: 400 }
          );
        }
      }

      // 检查状态使用情况
      if (removedStatuses.length > 0) {
        const usedStatuses = demands
          .filter(d => removedStatuses.includes(d.status as string))
          .map(d => ({ id: d.id, title: d.title, status: d.status }));

        if (usedStatuses.length > 0) {
          const examples = usedStatuses.slice(0, 3).map(d => `${d.title} (${d.status})`).join(', ');
          return NextResponse.json(
            {
              error: "cannot remove status in use",
              message: `无法删除正在使用的状态。以下需求正在使用这些状态：${examples}${usedStatuses.length > 3 ? ` 等 ${usedStatuses.length} 条需求` : ''}`,
              affectedDemands: usedStatuses.length,
            },
            { status: 400 }
          );
        }
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from("departments")
    .update({
      priority_config: config.priorities,
      status_config: config.statuses,
    })
    .eq("id", departmentId)
    .select("id, name, priority_config, status_config")
    .maybeSingle();

  if (error || !data) {
    console.error("[api/departments/workflow-config] update error", error);
    return NextResponse.json(
      { error: "failed to update config", detail: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    departmentId: data.id,
    departmentName: data.name,
    config: {
      priorities: data.priority_config as PriorityConfig[],
      statuses: data.status_config as StatusConfig[],
    },
  });
}
