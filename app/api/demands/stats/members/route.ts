import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getBusinessUserFromRequest } from "../../../../../lib/serverAuth";
import { ensureHasPermission } from "../../../../../lib/serverPermissions";
import { buildDemandStatusGroups } from "../../../../../lib/demandStatusGroups";
import {
  inferDemandDeliveryCounts,
  inferDemandDeliveryDemandCounts,
} from "../../../../../lib/demandDeliveryStats";
import { resolveStatsScopeForUser } from "../../../../../lib/statScope";
import {
  getStatsMonthBasisLabel,
  isDemandInMonthRange,
  resolveDepartmentStatsMonthConfig,
  type StatsMonthBasis,
} from "../../../../../lib/statMonthBasis";
import { getBusinessMonthRange, getCurrentBusinessPeriod } from "../../../../../lib/businessDateRange";


export const runtime = "edge";

interface DepartmentMemberStat {
  userId: number;
  userName: string;
  userEmail: string | null;
  role: string | null;
  demandsAssignee: number;
  demandsCompleted: number;
  materialCount: number;
  completedMaterialCount: number;
  imageMaterialCount: number;
  completedImageDemandCount: number;
  completedImageMaterialCount: number;
  videoMaterialCount: number;
  completedVideoDemandCount: number;
  completedVideoMaterialCount: number;
  pageCount: number;
  avgCycleDays: number;
  scoreAvg: number;
  scoreCount: number;
}

interface MemberStatsMeta {
  scoringEnabled: boolean;
  monthBasis: StatsMonthBasis;
  monthBasisLabel: string;
  scheduledDateFieldKey: string | null;
  scheduledEnabled: boolean;
  creativeUnifiedDelivery: boolean;
  deliveryColumns: {
    materialCount: boolean;
    completedMaterialCount: boolean;
    imageMaterialCount: boolean;
    completedImageDemandCount: boolean;
    completedImageMaterialCount: boolean;
    videoMaterialCount: boolean;
    completedVideoDemandCount: boolean;
    completedVideoMaterialCount: boolean;
    pageCount: boolean;
  };
}

function isCreativeDepartment(department: { name?: string | null; slug?: string | null } | null): boolean {
  const slug = (department?.slug || "").trim().toLowerCase();
  const name = (department?.name || "").trim().toLowerCase();
  return slug === "design" || slug.includes("creative") || name.includes("创意") || name.includes("设计");
}

function hasValidScoreItems(rawItems: unknown): boolean {
  if (!Array.isArray(rawItems)) {
    return false;
  }
  return rawItems.some((item) => {
    const label = (item as any)?.label;
    return typeof label === "string" && label.trim().length > 0;
  });
}

function hasAnyFieldKey(fieldKeys: Set<string>, candidates: string[]): boolean {
  return candidates.some((key) => fieldKeys.has(key.toLowerCase()));
}

function buildMemberStatsMeta(
  fieldRows: { key: string | null }[],
  scoreTemplate: { items?: unknown } | null,
  monthConfig: {
    defaultMemberMonthBasis: StatsMonthBasis;
    scheduledDateFieldKey: string | null;
    scheduledEnabled: boolean;
  },
  creativeUnifiedDelivery: boolean,
): MemberStatsMeta {
  const fieldKeys = new Set(
    fieldRows
      .map((field) => (field.key || "").toString().trim().toLowerCase())
      .filter(Boolean),
  );

  const hasImageMaterialCount = hasAnyFieldKey(fieldKeys, [
    "material_count",
    "materialcount",
    "materials_count",
    "asset_count",
    "assetcount",
    "image_count",
    "imagecount",
    "source_materials",
    "sourcematerials",
    "assets",
    "materials",
  ]);
  const hasVideoMaterialCount = hasAnyFieldKey(fieldKeys, ["video_count", "videocount"]);
  const hasPageCount = hasAnyFieldKey(fieldKeys, ["page_count", "pagecount"]);

  return {
    scoringEnabled: hasValidScoreItems(scoreTemplate?.items),
    monthBasis: monthConfig.defaultMemberMonthBasis,
    monthBasisLabel: getStatsMonthBasisLabel(monthConfig.defaultMemberMonthBasis),
    scheduledDateFieldKey: monthConfig.scheduledDateFieldKey,
    scheduledEnabled: monthConfig.scheduledEnabled,
    creativeUnifiedDelivery,
    deliveryColumns: {
      materialCount: creativeUnifiedDelivery ? false : hasImageMaterialCount || hasVideoMaterialCount,
      completedMaterialCount: creativeUnifiedDelivery ? false : hasImageMaterialCount || hasVideoMaterialCount,
      imageMaterialCount: creativeUnifiedDelivery ? false : hasImageMaterialCount,
      completedImageDemandCount: creativeUnifiedDelivery,
      completedImageMaterialCount: creativeUnifiedDelivery,
      videoMaterialCount: creativeUnifiedDelivery ? false : hasVideoMaterialCount,
      completedVideoDemandCount: creativeUnifiedDelivery,
      completedVideoMaterialCount: creativeUnifiedDelivery,
      pageCount: creativeUnifiedDelivery ? false : hasPageCount,
    },
  };
}

function getPeriodFromQuery(url: URL): string {
  const periodParam = url.searchParams.get("period");
  if (periodParam && /^\d{4}-\d{2}$/.test(periodParam.trim())) {
    return periodParam.trim();
  }
  return getCurrentBusinessPeriod();
}

function getPeriodRange(period: string): { start: string; end: string } {
  return getBusinessMonthRange(period);
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getBusinessUserFromRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const permError = await ensureHasPermission(authResult.user, "stats.department_members");
    if (permError) {
      return permError;
    }


    const url = new URL(req.url);
    const period = getPeriodFromQuery(url);
    const { start, end } = getPeriodRange(period);

    const scopeResult = resolveStatsScopeForUser(authResult.user, url.searchParams.get("departmentId"), {
      requireDepartment: true,
    });
    if (scopeResult.errorResponse) {
      return scopeResult.errorResponse;
    }
    const departmentId = scopeResult.scope!.departmentId!;

    const [
      usersResult,
      scoreRecordsResult,
      departmentResult,
      activeFieldTemplatesResult,
      demandTypesResult,
      scoreTemplateResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, name, email, role, status")
        .eq("department_id", departmentId),
      supabaseAdmin
        .from("score_records")
        .select("target_user_id, scores, period, department_id")
        .eq("period", period)
        .eq("department_id", departmentId),
      supabaseAdmin
        .from("departments")
        .select("name, slug, config, status_config")
        .eq("id", departmentId)
        .maybeSingle(),
      supabaseAdmin
        .from("department_field_templates")
        .select("id")
        .eq("department_id", departmentId)
        .eq("is_active", true),
      supabaseAdmin
        .from("demand_types")
        .select("id, name, code, field_template_id, is_active")
        .eq("department_id", departmentId),
      supabaseAdmin
        .from("score_templates")
        .select("id, items")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ] as const);

    if (usersResult.error) {
      console.error("[api/demands/stats/members] users query error", usersResult.error);
      return NextResponse.json(
        { error: "failed_to_load_users", detail: usersResult.error.message },
        { status: 500 },
      );
    }

    if (scoreRecordsResult.error) {
      console.error("[api/demands/stats/members] score_records query error", scoreRecordsResult.error);
      return NextResponse.json(
        { error: "failed_to_load_scores", detail: scoreRecordsResult.error.message },
        { status: 500 },
      );
    }

    if (departmentResult.error) {
      console.error("[api/demands/stats/members] department query error", departmentResult.error);
      return NextResponse.json(
        { error: "failed_to_load_department", detail: departmentResult.error.message },
        { status: 500 },
      );
    }

    if (activeFieldTemplatesResult.error) {
      console.error("[api/demands/stats/members] field templates query error", activeFieldTemplatesResult.error);
      return NextResponse.json(
        { error: "failed_to_load_department_fields", detail: activeFieldTemplatesResult.error.message },
        { status: 500 },
      );
    }

    if (demandTypesResult.error) {
      console.error("[api/demands/stats/members] demand types query error", demandTypesResult.error);
      return NextResponse.json(
        { error: "failed_to_load_demand_types", detail: demandTypesResult.error.message },
        { status: 500 },
      );
    }

    if (scoreTemplateResult.error) {
      console.error("[api/demands/stats/members] score template query error", scoreTemplateResult.error);
      return NextResponse.json(
        { error: "failed_to_load_score_template", detail: scoreTemplateResult.error.message },
        { status: 500 },
      );
    }

    const configuredTemplateIds = new Set<number>();
    for (const template of (activeFieldTemplatesResult.data || []) as { id: number | null }[]) {
      if (typeof template.id === "number" && template.id > 0) {
        configuredTemplateIds.add(template.id);
      }
    }
    const demandTypeRows = (demandTypesResult.data || []) as {
      id: number;
      name: string | null;
      code: string | null;
      field_template_id: number | null;
      is_active: boolean | null;
    }[];
    for (const demandType of demandTypeRows) {
      if (
        demandType.is_active !== false &&
        typeof demandType.field_template_id === "number" &&
        demandType.field_template_id > 0
      ) {
        configuredTemplateIds.add(demandType.field_template_id);
      }
    }

    let fieldRows: { key: string | null }[] = [];
    if (configuredTemplateIds.size > 0) {
      const { data: departmentFields, error: fieldsError } = await supabaseAdmin
        .from("department_fields")
        .select("key")
        .eq("department_id", departmentId)
        .in("template_id", Array.from(configuredTemplateIds));

      if (fieldsError) {
        console.error("[api/demands/stats/members] department fields query error", fieldsError);
        return NextResponse.json(
          { error: "failed_to_load_department_fields", detail: fieldsError.message },
          { status: 500 },
        );
      }

      fieldRows = (departmentFields || []) as { key: string | null }[];
    }

    const creativeUnifiedDelivery = isCreativeDepartment(
      (departmentResult.data || null) as { name?: string | null; slug?: string | null } | null,
    );
    const meta = buildMemberStatsMeta(
      fieldRows,
      (scoreTemplateResult.data || null) as { items?: unknown } | null,
      resolveDepartmentStatsMonthConfig(
        (departmentResult.data || null) as {
          name?: string | null;
          slug?: string | null;
          config?: unknown;
        } | null,
        fieldRows.map((field) => field.key || ""),
      ),
      creativeUnifiedDelivery,
    );

    let demandsQuery = supabaseAdmin
      .from("demands")
      .select("id, assignee_id, demand_type_id, status, created_at, finished_at, fields")
      .eq("department_id", departmentId);

    if (meta.monthBasis === "created") {
      demandsQuery = demandsQuery.gte("created_at", start).lt("created_at", end);
    } else if (meta.monthBasis === "finished") {
      demandsQuery = demandsQuery.gte("finished_at", start).lt("finished_at", end);
    }

    const demandsResult = await demandsQuery;

    if (demandsResult.error) {
      console.error("[api/demands/stats/members] demands query error", demandsResult.error);
      return NextResponse.json(
        { error: "failed_to_load_demands", detail: demandsResult.error.message },
        { status: 500 },
      );
    }

    const demandRows = ((demandsResult.data || []) as {
      id: number;
      assignee_id: number | null;
      demand_type_id: number | null;
      status: string;
      created_at: string | null;
      finished_at: string | null;
      fields: unknown;
    }[]).filter((row) => {
      return isDemandInMonthRange(row, meta.monthBasis, meta.scheduledDateFieldKey, start, end);
    });

    const demandIds = demandRows
      .map((row) => row.id)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);

    const attachmentCountByDemand = new Map<number, number>();
    if (demandIds.length) {
      const { data: attachmentRows, error: attachmentError } = await supabaseAdmin
        .from("demand_attachments")
        .select("demand_id")
        .in("demand_id", demandIds);

      if (attachmentError) {
        console.error("[api/demands/stats/members] attachments query error", attachmentError);
        return NextResponse.json(
          { error: "failed_to_load_attachments", detail: attachmentError.message },
          { status: 500 },
        );
      }

      for (const attachment of (attachmentRows || []) as { demand_id: number | null }[]) {
        if (typeof attachment.demand_id !== "number") {
          continue;
        }
        attachmentCountByDemand.set(
          attachment.demand_id,
          (attachmentCountByDemand.get(attachment.demand_id) || 0) + 1,
        );
      }
    }

    const userRows = (usersResult.data || []) as {
      id: number;
      name: string | null;
      email: string | null;
      role: string | null;
      status: string | null;
    }[];

    const scoreRows = (meta.scoringEnabled ? scoreRecordsResult.data || [] : []) as {
      target_user_id: number;
      scores: any;
      period: string;
      department_id: number | null;
    }[];
    const statusGroups = buildDemandStatusGroups(
      departmentResult.data ? [departmentResult.data as { status_config?: unknown }] : [],
    );
    const demandTypeMap = new Map(
      demandTypeRows.map((demandType) => [
        demandType.id,
        { name: demandType.name, code: demandType.code },
      ]),
    );

    type MemberAccumulator = {
      demandsAssignee: number;
      demandsCompleted: number;
      materialCount: number;
      completedMaterialCount: number;
      imageMaterialCount: number;
      completedImageDemandCount: number;
      completedImageMaterialCount: number;
      videoMaterialCount: number;
      completedVideoDemandCount: number;
      completedVideoMaterialCount: number;
      pageCount: number;
      cycleDurations: number[];
      scoreValues: number[];
    };

    const acc = new Map<number, MemberAccumulator>();
    const createAccumulator = (): MemberAccumulator => ({
      demandsAssignee: 0,
      demandsCompleted: 0,
      materialCount: 0,
      completedMaterialCount: 0,
      imageMaterialCount: 0,
      completedImageDemandCount: 0,
      completedImageMaterialCount: 0,
      videoMaterialCount: 0,
      completedVideoDemandCount: 0,
      completedVideoMaterialCount: 0,
      pageCount: 0,
      cycleDurations: [],
      scoreValues: [],
    });

    if (creativeUnifiedDelivery) {
      for (const user of userRows) {
        if (typeof user.id === "number" && (user.status || "").toLowerCase() === "active") {
          acc.set(user.id, createAccumulator());
        }
      }
    }

    for (const row of demandRows) {
      if (!row.assignee_id) continue;
      const userId = row.assignee_id;
      let bucket = acc.get(userId);
      if (!bucket) {
        bucket = createAccumulator();
        acc.set(userId, bucket);
      }

      bucket.demandsAssignee += 1;
      const deliveryCounts = inferDemandDeliveryCounts(row.fields, attachmentCountByDemand.get(row.id) ?? 0);
      bucket.materialCount += deliveryCounts.materialCount;
      bucket.imageMaterialCount += deliveryCounts.imageMaterialCount;
      bucket.videoMaterialCount += deliveryCounts.videoMaterialCount;
      bucket.pageCount += deliveryCounts.pageCount;

      const status = (row.status || "").toLowerCase();
      if (statusGroups.completed.includes(status)) {
        const deliveryDemandCounts = inferDemandDeliveryDemandCounts(
          deliveryCounts,
          row.demand_type_id ? demandTypeMap.get(row.demand_type_id) : null,
        );
        bucket.demandsCompleted += 1;
        bucket.completedMaterialCount += deliveryCounts.materialCount;
        bucket.completedImageDemandCount += deliveryDemandCounts.imageDemandCount;
        bucket.completedImageMaterialCount += deliveryCounts.imageMaterialCount;
        bucket.completedVideoDemandCount += deliveryDemandCounts.videoDemandCount;
        bucket.completedVideoMaterialCount += deliveryCounts.videoMaterialCount;
      }

      if (row.created_at && row.finished_at) {
        const createdAt = new Date(row.created_at).getTime();
        const finishedAt = new Date(row.finished_at).getTime();
        if (Number.isFinite(createdAt) && Number.isFinite(finishedAt) && finishedAt >= createdAt) {
          const days = (finishedAt - createdAt) / (1000 * 60 * 60 * 24);
          bucket.cycleDurations.push(days);
        }
      }
    }

    for (const record of scoreRows) {
      const userId = record.target_user_id;
      let bucket = acc.get(userId);
      if (!bucket) {
        bucket = createAccumulator();
        acc.set(userId, bucket);
      }

      const payload = record.scores as any;
      if (!payload || typeof payload !== "object") {
        continue;
      }
      for (const value of Object.values(payload)) {
        const num = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(num)) {
          bucket.scoreValues.push(num);
        }
      }
    }

    const userMap = new Map<
      number,
      { id: number; name: string | null; email: string | null; role: string | null; status: string | null }
    >();
    for (const user of userRows) {
      if (typeof user.id === "number") {
        userMap.set(user.id, user);
      }
    }

    const items: DepartmentMemberStat[] = [];

    for (const [userId, bucket] of acc.entries()) {
      const user = userMap.get(userId) ?? null;
      const avgCycleDays = bucket.cycleDurations.length
        ? bucket.cycleDurations.reduce((sum, v) => sum + v, 0) / bucket.cycleDurations.length
        : 0;
      const scoreAvg = bucket.scoreValues.length
        ? bucket.scoreValues.reduce((sum, v) => sum + v, 0) / bucket.scoreValues.length
        : 0;

      const userName = (user?.name || user?.email || "未命名用户").toString();

      items.push({
        userId,
        userName,
        userEmail: (user?.email ?? null) as string | null,
        role: (user?.role ?? null) as string | null,
        demandsAssignee: bucket.demandsAssignee,
        demandsCompleted: bucket.demandsCompleted,
        materialCount: bucket.materialCount,
        completedMaterialCount: bucket.completedMaterialCount,
        imageMaterialCount: bucket.imageMaterialCount,
        completedImageDemandCount: bucket.completedImageDemandCount,
        completedImageMaterialCount: bucket.completedImageMaterialCount,
        videoMaterialCount: bucket.videoMaterialCount,
        completedVideoDemandCount: bucket.completedVideoDemandCount,
        completedVideoMaterialCount: bucket.completedVideoMaterialCount,
        pageCount: bucket.pageCount,
        avgCycleDays,
        scoreAvg,
        scoreCount: bucket.scoreValues.length,
      });
    }

    items.sort((a, b) => {
      if (creativeUnifiedDelivery) {
        const completedDeliveryDemandDiff =
          b.completedImageDemandCount +
          b.completedVideoDemandCount -
          (a.completedImageDemandCount + a.completedVideoDemandCount);
        if (completedDeliveryDemandDiff !== 0) {
          return completedDeliveryDemandDiff;
        }
      }
      return b.demandsCompleted - a.demandsCompleted;
    });

    return NextResponse.json({ items, meta });
  } catch (error: any) {
    console.error("[api/demands/stats/members] unexpected error", error);
    return NextResponse.json(
      {
        error: "failed_to_load_member_stats",
        detail: error?.message ?? String(error),
      },
      { status: 500 },
    );
  }
}
