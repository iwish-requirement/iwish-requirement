-- ================================================
-- Permission catalog unification by functional category
-- Date: 2025-10-09
-- ================================================
-- 1) Ensure requirement-related permission codes exist and are categorized
-- Insert if not exists pattern
WITH missing AS (
  SELECT 'requirement.status_update' AS code, '需求-状态更新（全局）' AS name, '可更新任意需求状态' AS description, 'requirement' AS category UNION ALL
  SELECT 'requirement.status_update_own', '需求-状态更新（本人相关）', '可更新自己提交或作为执行人的需求状态', 'requirement' UNION ALL
  SELECT 'requirement.view_all', '需求-查看所有', '可查看所有需求', 'requirement' UNION ALL
  SELECT 'requirement.view_own', '需求-查看本人需求', '仅查看本人提交的需求', 'requirement' UNION ALL
  SELECT 'requirement.edit_all', '需求-编辑所有', '可编辑所有需求', 'requirement' UNION ALL
  SELECT 'requirement.edit_own', '需求-编辑本人', '可编辑本人提交的需求', 'requirement' UNION ALL
  SELECT 'requirement.delete_all', '需求-删除所有', '可删除所有需求', 'requirement' UNION ALL
  SELECT 'requirement.delete_own', '需求-删除本人', '可删除本人提交的需求', 'requirement' UNION ALL
  SELECT 'requirement.assign', '需求-分配', '可分配需求给其他人', 'requirement' UNION ALL
  SELECT 'requirement.export', '需求-导出', '可导出需求数据', 'requirement'
)
INSERT INTO permissions (name, code, description, category)
SELECT m.name, m.code, m.description, m.category
FROM missing m
LEFT JOIN permissions p ON p.code = m.code
WHERE p.id IS NULL;

-- 2) Normalize category of existing requirement-related codes to 'requirement'
UPDATE permissions
SET category = 'requirement'
WHERE code LIKE 'requirement.%' AND (category IS DISTINCT FROM 'requirement');

-- 3) Optional: Normalize other domains for consistency (idempotent)
UPDATE permissions SET category = 'user' WHERE code LIKE 'user.%' AND category IS DISTINCT FROM 'user';
UPDATE permissions SET category = 'form' WHERE code LIKE 'form.%' AND category IS DISTINCT FROM 'form';
UPDATE permissions SET category = 'permission' WHERE code LIKE 'permission.%' AND category IS DISTINCT FROM 'permission';
UPDATE permissions SET category = 'navigation' WHERE code LIKE 'navigation.%' AND category IS DISTINCT FROM 'navigation';
UPDATE permissions SET category = 'system' WHERE code LIKE 'system.%' AND category IS DISTINCT FROM 'system';
UPDATE permissions SET category = 'analytics' WHERE code LIKE 'analytics.%' AND category IS DISTINCT FROM 'analytics';
UPDATE permissions SET category = 'comment' WHERE code LIKE 'comment.%' AND category IS DISTINCT FROM 'comment';

-- 4) Seed role-permission bindings for new requirement status permissions
-- super_admin: all requirement.* (already likely has all, but ensure)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('requirement.status_update', 'requirement.status_update_own')
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
WHERE r.code = 'super_admin' AND rp.id IS NULL;

-- admin: grant global status update
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('requirement.status_update')
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
WHERE r.code = 'admin' AND rp.id IS NULL;

-- employee: grant own status update (if业务需要)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('requirement.status_update_own')
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
WHERE r.code = 'employee' AND rp.id IS NULL;

-- 5) Helpful indexes (no-op if exist)
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);