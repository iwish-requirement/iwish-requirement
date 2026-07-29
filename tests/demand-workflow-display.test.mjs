import assert from "node:assert/strict";
import test from "node:test";

import { applyDemandWorkflowDisplayFields } from "../lib/demandWorkflowDisplay.ts";

test("maps a freshly updated raw status to its configured Chinese label and color", () => {
  const updatedDemand = applyDemandWorkflowDisplayFields(
    {
      id: "REQ-1",
      status: "in_progress",
      priority: "medium",
    },
    {
      priorities: [
        { value: "medium", label: "中", color: "#2563eb", order: 1 },
      ],
      statuses: [
        { value: "in_progress", label: "进行中", color: "#f59e0b", order: 1 },
      ],
    },
  );

  assert.equal(updatedDemand.status, "in_progress");
  assert.equal(updatedDemand.statusLabel, "进行中");
  assert.equal(updatedDemand.statusColor, "#f59e0b");
  assert.equal(updatedDemand.priorityLabel, "中");
  assert.equal(updatedDemand.priorityColor, "#2563eb");
});

test("preserves raw values when the department has no matching display config", () => {
  const updatedDemand = applyDemandWorkflowDisplayFields(
    { id: "REQ-2", status: "custom_status", priority: "custom_priority" },
    { priorities: [], statuses: [] },
  );

  assert.equal(updatedDemand.statusLabel, "custom_status");
  assert.equal(updatedDemand.priorityLabel, "custom_priority");
  assert.equal(updatedDemand.statusColor, undefined);
  assert.equal(updatedDemand.priorityColor, undefined);
});

test("uses the legacy Chinese labels when workflow configuration is unavailable", () => {
  const updatedDemand = applyDemandWorkflowDisplayFields(
    { id: "REQ-3", status: "done", priority: "high" },
    null,
  );

  assert.equal(updatedDemand.statusLabel, "已完成");
  assert.equal(updatedDemand.priorityLabel, "高");
});
