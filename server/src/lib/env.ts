import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  webOrigin: required("WEB_ORIGIN", "http://localhost:5173"),
  cookieName: process.env.COOKIE_NAME ?? "identity_slot_token",
  adminSignupCode: required("ADMIN_SIGNUP_CODE"),
};
