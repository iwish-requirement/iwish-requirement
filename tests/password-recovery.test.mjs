import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getPasswordRecoveryRedirectUrl,
  normalizeRecoveryEmail,
  validateNewPassword,
} from "../lib/passwordRecovery.ts";

test("builds a reset URL on the same origin", () => {
  assert.equal(
    getPasswordRecoveryRedirectUrl("https://requirement.iwishweb.com"),
    "https://requirement.iwishweb.com/reset-password",
  );
  assert.equal(
    getPasswordRecoveryRedirectUrl("http://localhost:3000/login"),
    "http://localhost:3000/reset-password",
  );
});

test("normalizes surrounding whitespace from a recovery email", () => {
  assert.equal(normalizeRecoveryEmail("  user@example.com  "), "user@example.com");
});

test("validates password length and confirmation", () => {
  assert.equal(validateNewPassword("short", "short"), "新密码至少需要 8 个字符");
  assert.equal(validateNewPassword("password-1", "password-2"), "两次输入的密码不一致");
  assert.equal(validateNewPassword("password-1", "password-1"), null);
});

test("login recovery link no longer points to the current-page hash", async () => {
  const loginPage = await readFile(new URL("../app/(auth)/login/page.tsx", import.meta.url), "utf8");
  const forgotPasswordPage = await readFile(new URL("../app/(auth)/forgot-password/page.tsx", import.meta.url), "utf8");
  const resetPasswordPage = await readFile(new URL("../app/(auth)/reset-password/page.tsx", import.meta.url), "utf8");

  assert.match(loginPage, /href="\/forgot-password"/);
  assert.doesNotMatch(loginPage, /href="#"[^>]*>忘记密码/);
  assert.match(forgotPasswordPage, /resetPasswordForEmail/);
  assert.match(resetPasswordPage, /PASSWORD_RECOVERY/);
  assert.match(resetPasswordPage, /updateUser\(\{ password \}\)/);
});
