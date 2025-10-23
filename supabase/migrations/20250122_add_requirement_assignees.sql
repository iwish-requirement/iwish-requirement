-- 创建需求执行人关联表
CREATE TABLE IF NOT EXISTS requirement_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_department TEXT NOT NULL,
  user_position TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('primary', 'secondary', 'reviewer')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保同一个需求中同一个用户只能有一个角色
  UNIQUE(requirement_id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_requirement_assignees_requirement_id ON requirement_assignees(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_assignees_user_id ON requirement_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_requirement_assignees_role_type ON requirement_assignees(role_type);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_requirement_assignees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_requirement_assignees_updated_at
  BEFORE UPDATE ON requirement_assignees
  FOR EACH ROW
  EXECUTE FUNCTION update_requirement_assignees_updated_at();

-- 添加自动填充用户信息的触发器
CREATE OR REPLACE FUNCTION auto_fill_assignee_user_info()
RETURNS TRIGGER AS $$
BEGIN
  -- 自动从users表获取用户信息
  SELECT 
    COALESCE(full_name, email),
    email,
    department,
    position
  INTO 
    NEW.user_name,
    NEW.user_email,
    NEW.user_department,
    NEW.user_position
  FROM users 
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_fill_assignee_user_info
  BEFORE INSERT OR UPDATE ON requirement_assignees
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_assignee_user_info();

-- 添加注释
COMMENT ON TABLE requirement_assignees IS '需求执行人关联表';
COMMENT ON COLUMN requirement_assignees.role_type IS '执行人角色类型: primary-主要负责人, secondary-协助处理, reviewer-审核人';