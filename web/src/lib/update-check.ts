// SPAは一度読み込むとタブを閉じるかリロードするまでずっと古いJSのまま動き続けるため、
// スマホでアプリを開きっぱなし(バックグラウンド常駐)にしていると
// デプロイ後の変更がいつまでも反映されない。
// アプリがフォアグラウンドに戻った時と一定間隔で最新のindex.htmlを取得し、
// 読み込んでいるスクリプトと違えば自動でリロードして最新版に更新する。

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

function currentScriptSrc(): string | null {
  return document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? null;
}

async function checkForUpdate(currentSrc: string) {
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
    const latestSrc = match?.[1];
    if (latestSrc && !currentSrc.endsWith(latestSrc)) {
      window.location.reload();
    }
  } catch {
    // オフライン等は無視。次の機会にまた確認する
  }
}

export function startUpdateCheck() {
  const currentSrc = currentScriptSrc();
  if (!currentSrc) return;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate(currentSrc);
  });
  window.setInterval(() => checkForUpdate(currentSrc), CHECK_INTERVAL_MS);
}
