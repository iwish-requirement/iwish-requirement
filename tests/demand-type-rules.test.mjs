import assert from "node:assert/strict";
import test from "node:test";

import {
  isDepartmentDemandTypeRequired,
  normalizeDemandDeliveryCategory,
  resolveDemandTypeDeliveryCategory,
} from "../lib/demandTypeRules.ts";

test("normalizes only supported delivery categories", () => {
  assert.equal(normalizeDemandDeliveryCategory("material"), "material");
  assert.equal(normalizeDemandDeliveryCategory("video"), "video");
  assert.equal(normalizeDemandDeliveryCategory("other"), null);
  assert.equal(normalizeDemandDeliveryCategory(null), null);
});

test("uses explicit delivery configuration and retains compatibility fallbacks", () => {
  assert.equal(
    resolveDemandTypeDeliveryCategory({
      code: "graphic",
      config: { deliveryCategory: "video" },
    }),
    "video",
  );
  assert.equal(resolveDemandTypeDeliveryCategory({ name: "视频剪辑" }), "video");
  assert.equal(resolveDemandTypeDeliveryCategory({ code: "campaign_visual" }), "material");
});

test("requires a type when configured and protects Creative as a compatibility fallback", () => {
  assert.equal(
    isDepartmentDemandTypeRequired({ demandTypes: { required: true } }, "other"),
    true,
  );
  assert.equal(
    isDepartmentDemandTypeRequired({ demandTypes: { required: false } }, "creative"),
    false,
  );
  assert.equal(isDepartmentDemandTypeRequired({}, "creative"), true);
  assert.equal(isDepartmentDemandTypeRequired({}, "tech"), false);
});
