-- =====================================================
-- iWish Requirement - 初始数据
-- 创建时间: 2025-01-12
-- =====================================================

-- =====================================================
-- 插入基础权限
-- =====================================================

-- 需求管理权限
INSERT INTO permissions (name, code, description, category) VALUES
('创建需求', 'requirement.create', '可以创建新的需求', 'requirement'),
('查看所有需求', 'requirement.view_all', '可以查看所有需求', 'requirement'),
('查看自己的需求', 'requirement.view_own', '只能查看自己提交的需求', 'requirement'),
('编辑自己的需求', 'requirement.edit_own', '可以编辑自己提交的需求', 'requirement'),
('编辑所有需求', 'requirement.edit_all', '可以编辑所有需求', 'requirement'),
('删除自己的需求', 'requirement.delete_own', '可以删除自己提交的需求', 'requirement'),
('删除所有需求', 'requirement.delete_all', '可以删除所有需求', 'requirement'),
('分配需求', 'requirement.assign', '可以分配需求给其他人', 'requirement'),
('导出需求', 'requirement.export', '可以导出需求数据', 'requirement');

-- 用户管理权限
INSERT INTO permissions (name, code, description, category) VALUES
('查看用户', 'user.view', '可以查看用户列表', 'user'),
('创建用户', 'user.create', '可以创建新用户', 'user'),
('编辑用户', 'user.edit', '可以编辑用户信息', 'user'),
('删除用户', 'user.delete', '可以删除用户', 'user'),
('管理用户角色', 'user.manage_roles', '可以管理用户的角色分配', 'user');

-- 表单配置权限
INSERT INTO permissions (name, code, description, category) VALUES
('查看表单配置', 'form.view', '可以查看表单配置', 'form'),
('创建表单配置', 'form.create', '可以创建表单配置', 'form'),
('编辑表单配置', 'form.edit', '可以编辑表单配置', 'form'),
('删除表单配置', 'form.delete', '可以删除表单配置', 'form');

-- 权限管理权限
INSERT INTO permissions (name, code, description, category) VALUES
('查看权限', 'permission.view', '可以查看权限列表', 'permission'),
('管理权限', 'permission.manage', '可以管理权限和角色', 'permission');

-- 导航配置权限
INSERT INTO permissions (name, code, description, category) VALUES
('查看导航配置', 'navigation.view', '可以查看导航配置', 'navigation'),
('管理导航配置', 'navigation.manage', '可以管理导航配置', 'navigation');

-- 系统配置权限
INSERT INTO permissions (name, code, description, category) VALUES
('查看系统配置', 'system.view', '可以查看系统配置', 'system'),
('管理系统配置', 'system.manage', '可以管理系统配置', 'system');

-- 统计分析权限
INSERT INTO permissions (name, code, description, category) VALUES
('查看统计数据', 'analytics.view', '可以查看统计分析数据', 'analytics'),
('导出统计数据', 'analytics.export', '可以导出统计分析数据', 'analytics');

-- 评论权限
INSERT INTO permissions (name, code, description, category) VALUES
('添加评论', 'comment.create', '可以添加评论', 'comment'),
('删除自己的评论', 'comment.delete_own', '可以删除自己的评论', 'comment'),
('删除所有评论', 'comment.delete_all', '可以删除所有评论', 'comment');

-- =====================================================
-- 创建系统角色
-- =====================================================

-- 超级管理员角色
INSERT INTO roles (name, code, description, is_system) VALUES
('超级管理员', 'super_admin', '拥有系统所有权限，可以管理一切', true);

-- 管理员角色
INSERT INTO roles (name, code, description, is_system) VALUES
('管理员', 'admin', '拥有除用户管理外的所有权限', true);

-- 员工角色
INSERT INTO roles (name, code, description, is_system) VALUES
('员工', 'employee', '基础员工权限，可以提交和管理自己的需求', true);

-- =====================================================
-- 分配权限给角色
-- =====================================================

-- 超级管理员拥有所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'super_admin';

-- 管理员权限（除了用户管理相关权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'admin'
AND p.code NOT IN ('user.create', 'user.edit', 'user.delete', 'user.manage_roles', 'permission.manage');

-- 员工权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'employee'
AND p.code IN (
    'requirement.create',
    'requirement.view_all',
    'requirement.view_own',
    'requirement.edit_own',
    'requirement.delete_own',
    'comment.create',
    'comment.delete_own'
);

-- =====================================================
-- 创建默认用户
-- =====================================================

-- 插入默认超级管理员用户
INSERT INTO users (
    id,
    email,
    full_name,
    department,
    position,
    role,
    active
) VALUES (
    uuid_generate_v4(),
    'lin88@iwishweb.com',
    '技术管理员',
    '技术部',
    '技术管理员',
    'super_admin',
    true
);

-- 为默认用户分配超级管理员角色
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'lin88@iwishweb.com'
AND r.code = 'super_admin';

-- =====================================================
-- 创建默认表单配置
-- =====================================================

-- 技术需求表单配置
INSERT INTO form_schemas (
    name,
    description,
    department,
    position,
    fields,
    is_active,
    created_by
) VALUES (
    '技术需求表单',
    '技术部门通用需求表单',
    '技术部',
    '通用',
    '[
        {
            "id": "title",
            "name": "title",
            "label": "需求标题",
            "type": "text",
            "required": true,
            "placeholder": "请输入需求标题",
            "order": 1
        },
        {
            "id": "description",
            "name": "description",
            "label": "需求描述",
            "type": "textarea",
            "required": true,
            "placeholder": "请详细描述需求内容",
            "order": 2
        },
        {
            "id": "priority",
            "name": "priority",
            "label": "优先级",
            "type": "select",
            "required": true,
            "options": ["high", "medium", "low"],
            "order": 3
        },
        {
            "id": "due_date",
            "name": "due_date",
            "label": "期望完成时间",
            "type": "date",
            "required": true,
            "order": 4
        },
        {
            "id": "technical_requirements",
            "name": "technical_requirements",
            "label": "技术要求",
            "type": "textarea",
            "placeholder": "请描述具体的技术要求和实现方式",
            "order": 5
        },
        {
            "id": "acceptance_criteria",
            "name": "acceptance_criteria",
            "label": "验收标准",
            "type": "textarea",
            "placeholder": "请描述验收标准和测试要求",
            "order": 6
        }
    ]'::jsonb,
    true,
    (SELECT id FROM users WHERE email = 'lin88@iwishweb.com')
);

-- 创意需求表单配置
INSERT INTO form_schemas (
    name,
    description,
    department,
    position,
    fields,
    is_active,
    created_by
) VALUES (
    '创意需求表单',
    '创意部门通用需求表单',
    '创意部',
    '通用',
    '[
        {
            "id": "title",
            "name": "title",
            "label": "需求标题",
            "type": "text",
            "required": true,
            "placeholder": "请输入需求标题",
            "order": 1
        },
        {
            "id": "description",
            "name": "description",
            "label": "需求描述",
            "type": "textarea",
            "required": true,
            "placeholder": "请详细描述需求内容",
            "order": 2
        },
        {
            "id": "priority",
            "name": "priority",
            "label": "优先级",
            "type": "select",
            "required": true,
            "options": ["high", "medium", "low"],
            "order": 3
        },
        {
            "id": "due_date",
            "name": "due_date",
            "label": "期望完成时间",
            "type": "date",
            "required": true,
            "order": 4
        },
        {
            "id": "creative_type",
            "name": "creative_type",
            "label": "创意类型",
            "type": "select",
            "required": true,
            "options": ["平面设计", "视频制作", "UI设计", "品牌设计", "其他"],
            "order": 5
        },
        {
            "id": "target_audience",
            "name": "target_audience",
            "label": "目标受众",
            "type": "text",
            "placeholder": "请描述目标受众群体",
            "order": 6
        },
        {
            "id": "style_requirements",
            "name": "style_requirements",
            "label": "风格要求",
            "type": "textarea",
            "placeholder": "请描述期望的设计风格和要求",
            "order": 7
        },
        {
            "id": "reference_materials",
            "name": "reference_materials",
            "label": "参考资料",
            "type": "textarea",
            "placeholder": "请提供参考链接或描述参考案例",
            "order": 8
        }
    ]'::jsonb,
    true,
    (SELECT id FROM users WHERE email = 'lin88@iwishweb.com')
);

-- =====================================================
-- 创建默认导航配置
-- =====================================================

INSERT INTO navigation_configs (
    name,
    items,
    is_active,
    created_by
) VALUES (
    '默认导航配置',
    '[
        {
            "id": "dashboard",
            "label": "仪表板",
            "path": "/dashboard",
            "icon": "LayoutDashboard",
            "order": 1,
            "permissions": [],
            "is_active": true
        },
        {
            "id": "requirements",
            "label": "需求管理",
            "icon": "FileText",
            "order": 2,
            "permissions": ["requirement.view_all", "requirement.view_own"],
            "is_active": true,
            "children": [
                {
                    "id": "requirements-list",
                    "label": "需求列表",
                    "path": "/requirements",
                    "order": 1,
                    "permissions": ["requirement.view_all", "requirement.view_own"],
                    "is_active": true
                },
                {
                    "id": "requirements-create",
                    "label": "创建需求",
                    "path": "/requirements/create",
                    "order": 2,
                    "permissions": ["requirement.create"],
                    "is_active": true
                }
            ]
        },
        {
            "id": "forms",
            "label": "表单配置",
            "path": "/forms",
            "icon": "Settings",
            "order": 3,
            "permissions": ["form.view"],
            "is_active": true
        },
        {
            "id": "users",
            "label": "用户管理",
            "path": "/users",
            "icon": "Users",
            "order": 4,
            "permissions": ["user.view"],
            "is_active": true
        },
        {
            "id": "analytics",
            "label": "统计分析",
            "path": "/analytics",
            "icon": "BarChart3",
            "order": 5,
            "permissions": ["analytics.view"],
            "is_active": true
        },
        {
            "id": "system",
            "label": "系统管理",
            "icon": "Cog",
            "order": 6,
            "permissions": ["system.view", "permission.view", "navigation.view"],
            "is_active": true,
            "children": [
                {
                    "id": "system-permissions",
                    "label": "权限管理",
                    "path": "/system/permissions",
                    "order": 1,
                    "permissions": ["permission.view"],
                    "is_active": true
                },
                {
                    "id": "system-navigation",
                    "label": "导航配置",
                    "path": "/system/navigation",
                    "order": 2,
                    "permissions": ["navigation.view"],
                    "is_active": true
                },
                {
                    "id": "system-config",
                    "label": "系统配置",
                    "path": "/system/config",
                    "order": 3,
                    "permissions": ["system.view"],
                    "is_active": true
                }
            ]
        }
    ]'::jsonb,
    true,
    (SELECT id FROM users WHERE email = 'lin88@iwishweb.com')
);

-- =====================================================
-- 创建默认系统配置
-- =====================================================

INSERT INTO system_configs (key, value, description, category, is_public) VALUES
('app.name', '"iWish Requirement"', '应用名称', 'app', true),
('app.version', '"1.0.0"', '应用版本', 'app', true),
('app.description', '"企业级可配置需求管理SaaS平台"', '应用描述', 'app', true),
('requirement.auto_assign', 'false', '是否自动分配需求', 'requirement', false),
('requirement.default_priority', '"medium"', '默认需求优先级', 'requirement', false),
('notification.email_enabled', 'true', '是否启用邮件通知', 'notification', false),
('file.max_size', '10485760', '文件上传最大大小（字节）', 'file', false),
('file.allowed_types', '["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx", "xls", "xlsx"]', '允许上传的文件类型', 'file', false);

-- =====================================================
-- 创建视图和函数
-- =====================================================

-- 用户权限视图
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role as user_role,
    array_agg(DISTINCT p.code) as permissions
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.active = true
GROUP BY u.id, u.email, u.full_name, u.role;

-- 需求统计函数
CREATE OR REPLACE FUNCTION get_requirement_stats()
RETURNS TABLE (
    total_count BIGINT,
    pending_count BIGINT,
    in_progress_count BIGINT,
    completed_count BIGINT,
    cancelled_count BIGINT,
    rejected_count BIGINT,
    high_priority_count BIGINT,
    medium_priority_count BIGINT,
    low_priority_count BIGINT,
    overdue_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count,
        COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority_count,
        COUNT(*) FILTER (WHERE priority = 'low') as low_priority_count,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'cancelled', 'rejected')) as overdue_count
    FROM requirements;
END;
$$ LANGUAGE plpgsql;