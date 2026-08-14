"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const zod_1 = require("zod");
const game_core_1 = require("@identity-slot/game-core");
const env_1 = require("../lib/env");
const jwt_1 = require("../lib/jwt");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.authRouter = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, "パスワードは8文字以上にしてください"),
    displayName: zod_1.z.string().min(1).max(30),
    adminCode: zod_1.z.string().optional(),
});
const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
};
exports.authRouter.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
    }
    const { email, password, displayName, adminCode } = parsed.data;
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ error: "このメールアドレスは既に登録されています。" });
    }
    if (adminCode && adminCode !== env_1.env.adminSignupCode) {
        return res.status(400).json({ error: "運営コードが正しくありません。" });
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const userCount = await prisma_1.prisma.user.count();
    // 最初の登録者、または正しい運営コードを入力した場合に管理者になる
    const isAdmin = userCount === 0 || (!!adminCode && adminCode === env_1.env.adminSignupCode);
    const user = await prisma_1.prisma.user.create({
        data: {
            email,
            passwordHash,
            displayName,
            money: game_core_1.STARTING_MONEY,
            role: isAdmin ? "admin" : "user",
        },
    });
    const token = (0, jwt_1.signToken)({ userId: user.id });
    res.cookie(env_1.env.cookieName, token, cookieOptions);
    res.status(201).json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        money: user.money,
    });
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.authRouter.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "メールアドレスとパスワードを入力してください。" });
    }
    const { email, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: "メールアドレスまたはパスワードが正しくありません。" });
    }
    const token = (0, jwt_1.signToken)({ userId: user.id });
    res.cookie(env_1.env.cookieName, token, cookieOptions);
    res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, money: user.money });
});
exports.authRouter.post("/logout", (_req, res) => {
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
    res.clearCookie(env_1.env.cookieName, clearOptions);
    res.status(204).end();
});
exports.authRouter.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        return res.status(401).json({ error: "ログインが必要です。" });
    res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, money: user.money });
});
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30分
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000; // 連打防止(メールアドレス単位・メモリ上のみ)
const lastResetRequestAt = new Map();
function hashResetToken(token) {
    return node_crypto_1.default.createHash("sha256").update(token).digest("hex");
}
const forgotPasswordSchema = zod_1.z.object({ email: zod_1.z.string().email() });
exports.authRouter.post("/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "メールアドレスを入力してください。" });
    }
    const { email } = parsed.data;
    // メールアドレスの存在有無に関わらず同じレスポンスを返し、登録有無の推測を防ぐ
    const genericMessage = "このメールアドレスが登録されている場合、パスワード再設定用のリンクを送信しました。";
    const now = Date.now();
    const last = lastResetRequestAt.get(email) ?? 0;
    if (now - last < RESET_REQUEST_COOLDOWN_MS) {
        return res.json({ message: genericMessage });
    }
    lastResetRequestAt.set(email, now);
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (user) {
        const token = node_crypto_1.default.randomBytes(32).toString("hex");
        await prisma_1.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash: hashResetToken(token),
                expiresAt: new Date(now + RESET_TOKEN_TTL_MS),
            },
        });
        const resetUrl = `${env_1.env.webOrigin}/reset-password?token=${token}`;
        // 現状SMTP等のメール送信基盤が無いため、再設定リンクはサーバーのコンソールに出力する。
        // 運営はここからリンクを取得し、本人確認の上で個別に案内すること。
        // eslint-disable-next-line no-console
        console.log(`[パスワード再設定] ${email} 宛のリンク: ${resetUrl} (有効期限30分)`);
    }
    res.json({ message: genericMessage });
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8, "パスワードは8文字以上にしてください"),
});
exports.authRouter.post("/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "入力内容が不正です。" });
    }
    const { token, newPassword } = parsed.data;
    const tokenHash = hashResetToken(token);
    const resetToken = await prisma_1.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "リンクが無効か、有効期限が切れています。もう一度お試しください。" });
    }
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
        prisma_1.prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);
    res.json({ message: "パスワードを再設定しました。新しいパスワードでログインしてください。" });
});
const promoteSchema = zod_1.z.object({ code: zod_1.z.string().min(1) });
exports.authRouter.post("/promote", auth_1.requireAuth, async (req, res) => {
    const parsed = promoteSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "運営コードを入力してください。" });
    if (parsed.data.code !== env_1.env.adminSignupCode) {
        return res.status(403).json({ error: "運営コードが正しくありません。" });
    }
    const user = await prisma_1.prisma.user.update({ where: { id: req.user.id }, data: { role: "admin" } });
    res.json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, money: user.money });
});
