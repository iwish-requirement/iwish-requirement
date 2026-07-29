export interface DemandDeliveryCounts {
  materialCount: number;
  imageMaterialCount: number;
  videoMaterialCount: number;
  pageCount: number;
}

export interface DemandDeliveryDemandCounts {
  imageDemandCount: number;
  videoDemandCount: number;
}

export interface DemandTypeIdentity {
  code?: string | null;
  name?: string | null;
}

function normalizeNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const exact = Number(trimmed);
  if (Number.isFinite(exact)) {
    return Math.max(0, exact);
  }

  const match = trimmed.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function countCollectionLikeValue(raw: unknown): number | null {
  if (Array.isArray(raw)) {
    return raw.length;
  }

  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      return 1;
    }
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  for (const key of ["count", "length", "total", "quantity", "数量"]) {
    const value = normalizeNumber(candidate[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstCountFromKeys(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      continue;
    }

    const value = normalizeNumber(payload[key]) ?? countCollectionLikeValue(payload[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function inferDemandDeliveryCounts(
  fields: unknown,
  fallbackAttachmentCount = 0,
): DemandDeliveryCounts {
  if (!fields || typeof fields !== "object") {
    return {
      materialCount: fallbackAttachmentCount,
      imageMaterialCount: fallbackAttachmentCount,
      videoMaterialCount: 0,
      pageCount: 0,
    };
  }

  const payload = fields as Record<string, unknown>;
  const imageMaterialCount =
    firstCountFromKeys(payload, [
      "material_count",
      "materialCount",
      "materials_count",
      "asset_count",
      "assetCount",
      "image_count",
      "imageCount",
      "素材数量",
      "图片数量",
    ]) ?? 0;
  const videoMaterialCount =
    firstCountFromKeys(payload, ["video_count", "videoCount", "视频数量"]) ?? 0;
  const pageCount =
    firstCountFromKeys(payload, ["page_count", "pageCount", "页面数量", "网页数量"]) ?? 0;

  let referenceMaterialCount = 0;
  if (imageMaterialCount === 0 && videoMaterialCount === 0) {
    referenceMaterialCount =
      firstCountFromKeys(payload, [
        "source_materials",
        "sourceMaterials",
        "assetUrl",
        "asset_url",
        "assets",
        "materials",
        "原素材",
      ]) ?? fallbackAttachmentCount;
  }

  const materialCount = imageMaterialCount + videoMaterialCount + referenceMaterialCount;

  return {
    materialCount,
    imageMaterialCount: imageMaterialCount + referenceMaterialCount,
    videoMaterialCount,
    pageCount,
  };
}

export function inferDemandDeliveryDemandCounts(
  deliveryCounts: DemandDeliveryCounts,
  demandType?: DemandTypeIdentity | null,
): DemandDeliveryDemandCounts {
  const identity = `${demandType?.code || ""} ${demandType?.name || ""}`.trim().toLowerCase();

  if (
    identity.includes("video") ||
    identity.includes("\u89c6\u9891") ||
    identity.includes("\u526a\u8f91")
  ) {
    return { imageDemandCount: 0, videoDemandCount: 1 };
  }

  if (
    identity.includes("graphic") ||
    identity.includes("campaign") ||
    identity.includes("ui_design") ||
    identity.includes("\u7d20\u6750") ||
    identity.includes("banner") ||
    identity.includes("\u8bbe\u8ba1")
  ) {
    return { imageDemandCount: 1, videoDemandCount: 0 };
  }

  return {
    imageDemandCount: deliveryCounts.imageMaterialCount > 0 ? 1 : 0,
    videoDemandCount: deliveryCounts.videoMaterialCount > 0 ? 1 : 0,
  };
}
