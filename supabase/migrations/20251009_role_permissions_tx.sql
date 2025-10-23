-- Transactional update of role permissions to avoid partial failures on large sets
-- Date: 2025-10-09

CREATE OR REPLACE FUNCTION update_role_permissions_tx(p_role_id UUID, p_permission_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Start a transaction-like atomic block
  -- Delete all existing links
  DELETE FROM role_permissions WHERE role_id = p_role_id;

  -- Insert new links (if any)
  IF p_permission_ids IS NOT NULL AND array_length(p_permission_ids, 1) IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT p_role_id, unnest(p_permission_ids);
  END IF;
END;
$$;

-- Helpful index for speed and concurrency
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);