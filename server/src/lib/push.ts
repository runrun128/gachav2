import webpush from "web-push";
import { env } from "./env";
import { prisma } from "./prisma";

let pushEnabled = Boolean(env.vapidPublicKey && env.vapidPrivateKey);

if (pushEnabled) {
  // VAPID_SUBJECTの形式ミス(mailto:を忘れている等)でここが例外を投げると、
  // プッシュ通知機能とは無関係のサーバー全体が起動できなくなってしまうため、
  // 設定不備時はプッシュ通知だけを無効化してサーバーは通常通り起動を続ける。
  try {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!);
  } catch (err) {
    console.error("[push] VAPID設定が不正なため、プッシュ通知を無効化します。", err);
    pushEnabled = false;
  }
} else {
  console.warn("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY が未設定のため、プッシュ通知は無効です。");
}

export function isPushEnabled(): boolean {
  return pushEnabled;
}

export function getVapidPublicKey(): string | null {
  return env.vapidPublicKey ?? null;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const json = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // 購読が失効(通知の許可を取り消し/ブラウザデータ削除等)しているので掃除する
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("[push] send failed", statusCode, err);
        }
      }
    })
  );
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.all(userIds.map((userId) => sendPushToUser(userId, payload)));
}
