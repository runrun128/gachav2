import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useSocket } from "../lib/socket-context";

const NAV_ITEMS = [
  { to: "/", label: "🎰 ガチャ" },
  { to: "/announcements", label: "📢 お知らせ" },
  { to: "/battle", label: "⚔️ バトル" },
  { to: "/raid", label: "🐉 レイド" },
  { to: "/profile", label: "🪪 プロフィール" },
  { to: "/history", label: "📜 履歴" },
  { to: "/ranking", label: "🏆 ランキング" },
  { to: "/shop", label: "🛒 ショップ" },
  { to: "/inventory", label: "🎒 持ち物" },
  { to: "/train", label: "💪 育成" },
];

const PRIMARY_MOBILE_NAV = [
  { to: "/", label: "ガチャ", icon: "🎰" },
  { to: "/battle", label: "バトル", icon: "⚔️" },
  { to: "/raid", label: "レイド", icon: "🐉" },
  { to: "/announcements", label: "お知らせ", icon: "📢" },
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
        <button
          className="btn"
          style={{ width: "100%", marginTop: "0.85rem" }}
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
  const [moreOpen, setMoreOpen] = useState(false);
  const navItems = user?.role === "admin" ? [...NAV_ITEMS, { to: "/admin", label: "⚙️ 運営" }] : NAV_ITEMS;
  const mobileMoreItems = navItems.filter((item) => !PRIMARY_MOBILE_NAV.some((p) => p.to === item.to));

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
            </NavLink>
          ))}
        </nav>
        <span className="money-badge">💰 {user?.money ?? 0} コイン</span>
        <button className="btn desktop-only" onClick={() => logout()}>
          ログアウト
        </button>
      </header>
      <main className="main main-with-bottom-nav">
        <Outlet />
      </main>
      <IncomingChallengeBanner />

      <nav className={"mobile-tabbar" + (moreOpen ? " sheet-open" : "")}>
        {PRIMARY_MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => "mobile-tab" + (isActive ? " active" : "")}
          >
            <span className="mobile-tab-icon">{item.icon}</span>
            <span className="mobile-tab-label">{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={"mobile-tab" + (moreOpen ? " active" : "")}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="mobile-tab-icon">☰</span>
          <span className="mobile-tab-label">もっと</span>
        </button>
      </nav>

      {moreOpen && <MoreSheet items={mobileMoreItems} onClose={() => setMoreOpen(false)} onLogout={logout} />}
    </div>
  );
}
