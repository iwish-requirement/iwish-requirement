export const MIN_PASSWORD_LENGTH = 8;

export function normalizeRecoveryEmail(email: string) {
  return email.trim();
}

export function getPasswordRecoveryRedirectUrl(origin: string) {
  return new URL('/reset-password', origin).toString();
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`;
  }

  if (password !== confirmation) {
    return '两次输入的密码不一致';
  }

  return null;
}
