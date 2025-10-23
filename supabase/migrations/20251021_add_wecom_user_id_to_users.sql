-- 为用户表新增企业微信 UserID 字段，用于精准消息推送
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wecom_user_id TEXT;

COMMENT ON COLUMN users.wecom_user_id IS '企业微信 UserID，用于精准消息推送';

-- 确保同一企微账号只能绑定一名用户
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wecom_user_id_unique
  ON users(wecom_user_id)
  WHERE wecom_user_id IS NOT NULL;
