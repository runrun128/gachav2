"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const http_1 = require("http");
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const env_1 = require("./lib/env");
const admin_1 = require("./routes/admin");
const announcements_1 = require("./routes/announcements");
const auth_1 = require("./routes/auth");
const characters_1 = require("./routes/characters");
const gacha_1 = require("./routes/gacha");
const profile_1 = require("./routes/profile");
const shop_1 = require("./routes/shop");
const users_1 = require("./routes/users");
const socket_1 = require("./socket");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: env_1.env.webOrigin, credentials: true }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth_1.authRouter);
app.use("/api/gacha", gacha_1.gachaRouter);
app.use("/api", profile_1.profileRouter);
app.use("/api", shop_1.shopRouter);
app.use("/api", characters_1.charactersRouter);
app.use("/api", users_1.usersRouter);
app.use("/api", announcements_1.announcementsRouter);
app.use("/api/admin", admin_1.adminRouter);
// 本番ビルドでは web/dist を同じプロセスから静的配信し、SPA用にフォールバックする
// (フロント・APIを1コンテナ/1プロセスにまとめてデプロイをシンプルにするため)
if (process.env.NODE_ENV === "production") {
    const webDist = path_1.default.resolve(__dirname, "../../web/dist");
    if ((0, fs_1.existsSync)(webDist)) {
        app.use(express_1.default.static(webDist));
        app.get(/^(?!\/api).*/, (_req, res) => {
            res.sendFile(path_1.default.join(webDist, "index.html"));
        });
    }
}
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "サーバーエラーが発生しました。" });
});
const httpServer = (0, http_1.createServer)(app);
(0, socket_1.createSocketServer)(httpServer);
httpServer.listen(env_1.env.port, () => {
    console.log(`NEO ORACLE ARCADE server listening on http://localhost:${env_1.env.port}`);
});
