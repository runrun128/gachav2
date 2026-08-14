import { existsSync } from "fs";
import { createServer } from "http";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { adminRouter } from "./routes/admin";
import { announcementsRouter } from "./routes/announcements";
import { authRouter } from "./routes/auth";
import { charactersRouter } from "./routes/characters";
import { gachaRouter } from "./routes/gacha";
import { profileRouter } from "./routes/profile";
import { shopRouter } from "./routes/shop";
import { usersRouter } from "./routes/users";
import { createSocketServer } from "./socket";

const app = express();

app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/gacha", gachaRouter);
app.use("/api", profileRouter);
app.use("/api", shopRouter);
app.use("/api", charactersRouter);
app.use("/api", usersRouter);
app.use("/api", announcementsRouter);
app.use("/api/admin", adminRouter);

// 本番ビルドでは web/dist を同じプロセスから静的配信し、SPA用にフォールバックする
// (フロント・APIを1コンテナ/1プロセスにまとめてデプロイをシンプルにするため)
if (process.env.NODE_ENV === "production") {
  const webDist = path.resolve(__dirname, "../../web/dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(webDist, "index.html"));
    });
  }
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "サーバーエラーが発生しました。" });
});

const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  console.log(`NEO ORACLE ARCADE server listening on http://localhost:${env.port}`);
});
