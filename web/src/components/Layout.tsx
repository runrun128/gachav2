import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { useAudio } from "../lib/audio-context";
import { useBgm } from "../hooks/useBgm";
import { Icon, IconName } from "./Icon";
import { useSocket } from "../lib/socket-context";

const NAV_ITEMS = [
  { to: "/", label: "🏠 ホーム" },
  { to: "/gacha", label: "🎰 ガチャ" },
  { to: "/battle", label: "⚔️ バトル" },
  { to: "/announcements", label: "📢 お知らせ" },
  { to: "/profile", label: "🪪 プロフィール" },
  { to: "/history", label: "📖 図鑑" },
  { to: "/ranking", label: "🏆 ランキング" },
  { to: "/shop", label: "🛒 ショップ" },
  { to: "/inventory", label: "🎒 持ち物" },
  { to: "/train", label: "💪 育成" },
  { to: "/trade", label: "🔄 トレード" },
  { to: "/achievements", label: "🏆 実績" },
];

const PRIMARY_MOBILE_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "ホーム", icon: "home" },
  { to: "/gacha", label: "ガチャ", icon: "gacha" },
  { to: "/battle", label: "バトル", icon: "battle" },
  { to: "/announcements", label: "お知らせ", icon: "announcement" },
];

function IncomingChallengeBanner() {
  const { incomingChallenge, clearIncomingChallenge, socket } = useSocket();
  const [busy, setBusy] = useState(false);

  if (!incomingChallenge) return null;

  function respond(accept: boolean) {
    if (!socket) return;
    setBusy(true);
    socket.emit("battle:respondChallenge", { challengeId: incomingChallenge!.challengeId, accept }, () => {
      setBusy(false);
      if (!accept) clearIncomingChallenge();
    });
  }

  return (
    <div className="challenge-toast">
      <p>
        ⚔️ <strong>{incomingChallenge.from.displayName}</strong> から対戦の挑戦が届きました!
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={busy} onClick={() => respond(true)}>
          受けて立つ
        </button>
        <button className="btn" disabled={busy} onClick={() => respond(false)}>
          今は無理
        </button>
      </div>
    </div>
  );
}

function IncomingTradeInviteBanner() {
  const { incomingTradeInvite, clearIncomingTradeInvite, socket } = useSocket();
  const [busy, setBusy] = useState(false);

  if (!incomingTradeInvite) return null;

  function respond(accept: boolean) {
    if (!socket) return;
    setBusy(true);
    socket.emit("trade:respondInvite", { inviteId: incomingTradeInvite!.inviteId, accept }, () => {
      setBusy(false);
      if (!accept) clearIncomingTradeInvite();
    });
  }

  return (
    <div className="challenge-toast">
      <p>
        🔄 <strong>{incomingTradeInvite.from.displayName}</strong> からトレードの申し込みが届きました!
      </p>
      <div className="btn-row">
        <button className="btn btn-primary" disabled={busy} onClick={() => respond(true)}>
          応じる
        </button>
        <button className="btn" disabled={busy} onClick={() => respond(false)}>
          今は無理
        </button>
      </div>
    </div>
  );
}

function SoundSettings() {
  const { muted, volume, setMuted, setVolume } = useAudio();
  return (
    <div className="btn-row" style={{ alignItems: "center", width: "100%", marginTop: "0.85rem" }}>
      <button type="button" className="btn" onClick={() => setMuted(!muted)}>
        {muted ? "🔇 ミュート中" : "🔊 サウンドON"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={muted}
        onChange={(e) => setVolume(Number(e.target.value))}
        style={{ flex: 1, minWidth: 100 }}
      />
    </div>
  );
}

function MoreSheet({
  items,
  onClose,
  onLogout,
}: {
  items: { to: string; label: string }[];
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="mobile-sheet-backdrop" onClick={onClose}>
      <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-grid">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className="mobile-sheet-link" onClick={onClose}>
              {item.label}
            </NavLink>
          ))}
        </div>
        <SoundSettings />
        <button
          className="btn"
          style={{ width: "100%", marginTop: "0.6rem" }}
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { muted, setMuted } = useAudio();
  const [moreOpen, setMoreOpen] = useState(false);
  useBgm("lobby", null);
  const navItems = user?.role === "admin" ? [...NAV_ITEMS, { to: "/admin", label: "⚙️ 運営" }] : NAV_ITEMS;
  const mobileMoreItems = navItems.filter((item) => !PRIMARY_MOBILE_NAV.some((p) => p.to === item.to));

  const { data: unreadData } = useQuery({
    queryKey: ["announcements-unread-count"],
    queryFn: () => api.get<{ count: number }>("/announcements/unread-count"),
    refetchInterval: 20_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="app-shell">
      <header className="topnav">
        <span className="brand">NEO ORACLE ARCADE</span>
        <nav className="desktop-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              {item.label}
              {item.to === "/announcements" && unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <span className="money-badge">💰 {user?.money ?? 0} コイン</span>
        <button className="btn desktop-only" onClick={() => setMuted(!muted)} title="サウンド設定">
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="btn desktop-only" onClick={() => logout()}>
          ログアウト
        </button>
      </header>
      <main className="main main-with-bottom-nav">
        <Outlet />
      </main>
      <IncomingChallengeBanner />
      <IncomingTradeInviteBanner />

      <nav className={"mobile-tabbar" + (moreOpen ? " sheet-open" : "")}>
        {PRIMARY_MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => "mobile-tab" + (isActive ? " active" : "")}
          >
            <span className="mobile-tab-icon">
              <Icon name={item.icon} size={22} />
              {item.to === "/announcements" && unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </span>
            <span className="mobile-tab-label">{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={"mobile-tab" + (moreOpen ? " active" : "")}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="mobile-tab-icon">
            <Icon name="more" size={22} />
          </span>
          <span className="mobile-tab-label">もっと</span>
        </button>
      </nav>

      {moreOpen && <MoreSheet items={mobileMoreItems} onClose={() => setMoreOpen(false)} onLogout={logout} />}
    </div>
  );
}
