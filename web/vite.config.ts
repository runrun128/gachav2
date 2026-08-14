import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // game-core は正規のESM(NodeNext)パッケージなので事前バンドル(キャッシュ)の対象から除外し、
  // 常にソースを直接解決させる。include指定していた頃は packages/game-core/dist を再ビルドしても
  // Viteの事前バンドルキャッシュが古いままになり、「does not provide an export named ...」で
  // 画面が真っ白になる不具合が繰り返し発生していた。
  optimizeDeps: {
    exclude: ["@identity-slot/game-core"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
