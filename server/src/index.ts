import { existsSync } from "fs";
import { createServer } from "http";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { adminRouter } from "./routes/admin";
import { achievementsRouter } from "./routes/achievements";
import { announcementsRouter } from "./routes/announcements";
import { authRouter } from "./routes/auth";
import { dailyBonusRouter } from "./routes/dailyBonus";
import { charactersRouter } from "./routes/characters";
import { gachaRouter } from "./routes/gacha";
import { loadCustomGameContent } from "./lib/gameContent";
import { marketRouter } from "./routes/market";
import { profileRouter } from "./routes/profile";
import { pushRouter } from "./routes/push";
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
app.use("/api", pushRouter);
app.use("/api", marketRouter);
app.use("/api", achievementsRouter);
app.use("/api", dailyBonusRouter);
app.use("/api/admin", adminRouter);

// 本番ビルドでは web/dist を同じプロセスから静的配信し、SPA用にフォールバックする
// (フロント・APIを1コンテナ/1プロセスにまとめてデプロイをシンプルにするため)
if (process.env.NODE_ENV === "production") {
  const webDist = path.resolve(__dirname, "../../web/dist");
  if (existsSync(webDist)) {
    // index.htmlはデプロイのたびに中身(参照するJS/CSSのハッシュ)が変わるため、
    // 途中の何らかのキャッシュ層(ブラウザ/CDN等)に古い版を留められないよう明示的にno-cacheにする。
    // ハッシュ付きの静的アセット自体は内容が変わらない限り不変なので通常のキャッシュのままでよい。
    app.use(
      express.static(webDist, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.set("Cache-Control", "no-cache");
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

loadCustomGameContent()
  .catch((err) => console.error("[gameContent] failed to load custom items/features", err))
  .finally(() => {
    httpServer.listen(env.port, () => {
      console.log(`NEO ORACLE ARCADE server listening on http://localhost:${env.port}`);
    });
  });
