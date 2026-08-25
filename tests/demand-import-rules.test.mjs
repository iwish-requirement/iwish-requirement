import assert from "node:assert/strict";
import test from "node:test";

import {
  findDemandTypeImportColumn,
  resolveImportDemandType,
} from "../lib/demandImportRules.ts";

const demandTypes = [
  {
    id: 6,
    code: "graphic",
    name: "美工素材",
    fieldTemplateId: 12,
    isActive: true,
  },
  {
    id: 7,
    code: "video_editing",
    name: "视频剪辑",
    fieldTemplateId: 13,
    isActive: true,
  },
  {
    id: 99,
    code: "retired",
    name: "停用类型",
    fieldTemplateId: null,
    isActive: false,
  },
];

test("accepts both demand type code and display name", () => {
  assert.equal(resolveImportDemandType("graphic", demandTypes)?.id, 6);
  assert.equal(resolveImportDemandType(" 美工素材 ", demandTypes)?.id, 6);
  assert.equal(resolveImportDemandType("VIDEO_EDITING", demandTypes)?.id, 7);
});

test("does not resolve missing, unknown, or inactive demand types", () => {
  assert.equal(resolveImportDemandType("", demandTypes), null);
  assert.equal(resolveImportDemandType("unknown", demandTypes), null);
  assert.equal(resolveImportDemandType("retired", demandTypes), null);
});

test("prefers the explicit code header while retaining legacy aliases", () => {
  assert.equal(findDemandTypeImportColumn({ 需求类型编码: 3, 需求类型: 4 }), 3);
  assert.equal(findDemandTypeImportColumn({ demandType: 8 }), 8);
  assert.equal(findDemandTypeImportColumn({ 标题: 0 }), undefined);
});
