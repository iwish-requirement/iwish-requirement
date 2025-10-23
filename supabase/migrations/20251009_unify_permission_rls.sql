-- ================================================
-- Unify permission-driven RLS and compatibility (v2)
-- Date: 2025-10-09
-- ================================================

-- 1) Enum compatibility: add missing statuses used by frontend
DO $$
BEGIN
  -- add 'not_started' if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'requirement_status' AND e.enumlabel = 'not_started'
  ) THEN
    ALTER TYPE requirement_status ADD VALUE 'not_started';
  END IF;

  -- add 'delayed' if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'requirement_status' AND e.enumlabel = 'delayed'
  ) THEN
    ALTER TYPE requirement_status ADD VALUE 'delayed';
  END IF;
END$$;

-- 2) Schema compatibility and alignment
-- 2.1 ensure submitter_id exists (used by unified RLS)
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS submitter_id UUID;

-- 2.2 ensure created_by exists for backward compatibility
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- 2.3 backfill both ways to align legacy and new data
-- prefer keeping submitter_id as source of truth going forward
UPDATE requirements
SET submitter_id = created_by
WHERE submitter_id IS NULL AND created_by IS NOT NULL;

UPDATE requirements
SET created_by = submitter_id
WHERE created_by IS NULL AND submitter_id IS NOT NULL;

-- 2.4 keep columns in sync via trigger (submitter_id -> created_by)
CREATE OR REPLACE FUNCTION sync_created_by_with_submitter_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitter_id IS NOT NULL THEN
    NEW.created_by := NEW.submitter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_created_by_with_submitter_id ON requirements;
CREATE TRIGGER trg_sync_created_by_with_submitter_id
BEFORE INSERT OR UPDATE ON requirements
FOR EACH ROW
EXECUTE FUNCTION sync_created_by_with_submitter_id();

-- optional display/compat column for frontend
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS department TEXT;

-- 3) Permission check function: has_permission(uid, code)
CREATE OR REPLACE FUNCTION has_permission(p_uid UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_uid
      AND p.code = p_code
  );
$func$;

-- 4) Related-to-me helper: user is submitter/assignee or in requirement_assignees
CREATE OR REPLACE FUNCTION related_to_me(p_uid UUID, p_requirement_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM requirements req
    WHERE req.id = p_requirement_id
      AND (
        req.submitter_id = p_uid
        OR req.created_by = p_uid
        OR req.assignee_id = p_uid
        OR EXISTS (
          SELECT 1 FROM requirement_assignees ra
          WHERE ra.requirement_id = req.id AND ra.user_id = p_uid
        )
      )
  );
$func$;

-- 5) Rebuild RLS policies on requirements based on permission codes
-- enable RLS if not yet
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;

-- Drop existing requirement policies if present (defensive)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'requirements'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON requirements', rec.policyname);
  END LOOP;
END$$;

-- SELECT: view all via permission; otherwise only related records
CREATE POLICY req_select_by_permission
ON requirements
FOR SELECT
USING (
  has_permission(auth.uid(), 'requirement.view_all')
  OR related_to_me(auth.uid(), id)
);

-- INSERT: require create permission; and ensure the submitter is current user
CREATE POLICY req_insert_by_permission
ON requirements
FOR INSERT
WITH CHECK (
  has_permission(auth.uid(), 'requirement.create')
  AND submitter_id = auth.uid()
);

-- UPDATE: unified rules
-- Global: status_update OR edit_all
-- Own: status_update_own AND related_to_me
-- Compatible: edit_own AND submitter is current user
CREATE POLICY req_update_by_permission
ON requirements
FOR UPDATE
USING (
  has_permission(auth.uid(), 'requirement.status_update')
  OR has_permission(auth.uid(), 'requirement.edit_all')
  OR (has_permission(auth.uid(), 'requirement.status_update_own') AND related_to_me(auth.uid(), id))
  OR (has_permission(auth.uid(), 'requirement.edit_own') AND submitter_id = auth.uid())
)
WITH CHECK (
  has_permission(auth.uid(), 'requirement.status_update')
  OR has_permission(auth.uid(), 'requirement.edit_all')
  OR (has_permission(auth.uid(), 'requirement.status_update_own') AND related_to_me(auth.uid(), id))
  OR (has_permission(auth.uid(), 'requirement.edit_own') AND submitter_id = auth.uid())
);

-- DELETE: global delete OR own delete on submitter's record
CREATE POLICY req_delete_by_permission
ON requirements
FOR DELETE
USING (
  has_permission(auth.uid(), 'requirement.delete_all')
  OR (has_permission(auth.uid(), 'requirement.delete_own') AND submitter_id = auth.uid())
);

-- 6) Helpful indexes for permission checks
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_requirements_created_by ON requirements(created_by);
CREATE INDEX IF NOT EXISTS idx_requirements_submitter_id ON requirements(submitter_id);

-- Notes:
-- - Admin/super-admin无需额外硬编码：只要其角色拥有 requirement.view_all / status_update / edit_all 等权限码，策略自然放行。
-- - 若要严格状态流转，请将状态机收敛到数据库函数中统一裁决，并让前端共用同一套定义，避免“能选但写不进”。