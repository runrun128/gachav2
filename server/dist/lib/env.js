"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (value === undefined) {
        throw new Error(`環境変数 ${name} が設定されていません`);
    }
    return value;
}
exports.env = {
    port: Number(process.env.PORT ?? 4000),
    jwtSecret: required("JWT_SECRET"),
    webOrigin: required("WEB_ORIGIN", "http://localhost:5173"),
    cookieName: process.env.COOKIE_NAME ?? "identity_slot_token",
    adminSignupCode: required("ADMIN_SIGNUP_CODE"),
};
