import assert from "node:assert/strict";
import test from "node:test";

import {
  inferDemandDeliveryCounts,
  inferDemandDeliveryDemandCounts,
} from "../lib/demandDeliveryStats.ts";

test("counts one material demand separately from its material quantity", () => {
  const deliveryCounts = inferDemandDeliveryCounts({ material_count: 6 });
  assert.deepEqual(deliveryCounts, {
    materialCount: 6,
    imageMaterialCount: 6,
    videoMaterialCount: 0,
    pageCount: 0,
  });
  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, { code: "graphic" }), {
    imageDemandCount: 1,
    videoDemandCount: 0,
  });
});

test("counts one video demand separately from its video quantity", () => {
  const deliveryCounts = inferDemandDeliveryCounts({ video_count: 3 });
  assert.deepEqual(deliveryCounts, {
    materialCount: 3,
    imageMaterialCount: 0,
    videoMaterialCount: 3,
    pageCount: 0,
  });
  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, { code: "video_editing" }), {
    imageDemandCount: 0,
    videoDemandCount: 1,
  });
});

test("uses demand type as the primary request category", () => {
  const deliveryCounts = inferDemandDeliveryCounts({
    material_count: 4,
    video_count: 2,
    page_count: 5,
  });

  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, { code: "video_editing" }), {
    imageDemandCount: 0,
    videoDemandCount: 1,
  });
  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, { code: "campaign_visual" }), {
    imageDemandCount: 1,
    videoDemandCount: 0,
  });
});

test("uses attachments as a material-demand fallback for historical rows", () => {
  const deliveryCounts = inferDemandDeliveryCounts({}, 2);
  assert.deepEqual(deliveryCounts, {
    materialCount: 2,
    imageMaterialCount: 2,
    videoMaterialCount: 0,
    pageCount: 0,
  });
  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, null), {
    imageDemandCount: 1,
    videoDemandCount: 0,
  });
});

test("classifies typed historical requests even when their quantity is missing", () => {
  const deliveryCounts = inferDemandDeliveryCounts({});

  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, { name: "美工素材" }), {
    imageDemandCount: 1,
    videoDemandCount: 0,
  });
  assert.deepEqual(inferDemandDeliveryDemandCounts(deliveryCounts, { name: "视频剪辑" }), {
    imageDemandCount: 0,
    videoDemandCount: 1,
  });
});
