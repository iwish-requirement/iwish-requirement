import assert from "node:assert/strict";
import test from "node:test";

import { buildDemandStateChangedFields } from "../lib/demandStateAudit.ts";

test("records status, assignee and completion timestamp changes", () => {
  assert.deepEqual(
    buildDemandStateChangedFields(
      {
        status: "in_progress",
        assignee_id: 12,
        assigned_at: "2026-07-01T08:00:00.000Z",
        finished_at: null,
      },
      {
        status: "done",
        assignee_id: 12,
        assigned_at: "2026-07-01T08:00:00.000Z",
        finished_at: "2026-07-21T08:00:00.000Z",
      },
    ),
    {
      status: { before: "in_progress", after: "done" },
      finished_at: { before: null, after: "2026-07-21T08:00:00.000Z" },
    },
  );
});

test("records reopening and assignment changes, normalizing undefined to null", () => {
  assert.deepEqual(
    buildDemandStateChangedFields(
      { status: "done", assignee_id: 12, finished_at: "2026-07-01T08:00:00.000Z" },
      { status: "pending", assignee_id: undefined, finished_at: undefined },
    ),
    {
      status: { before: "done", after: "pending" },
      assignee_id: { before: 12, after: null },
      finished_at: { before: "2026-07-01T08:00:00.000Z", after: null },
    },
  );
});

test("does not create an audit payload when tracked state is unchanged", () => {
  assert.deepEqual(
    buildDemandStateChangedFields(
      { status: "pending", assignee_id: null, finished_at: null },
      { status: "pending", assignee_id: null, finished_at: null },
    ),
    {},
  );
});
