import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { AchievementsPage } from "./pages/AchievementsPage";
import { AdminPage } from "./pages/AdminPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { BattleHubPage } from "./pages/BattleHubPage";
import { BattleLobbyPage } from "./pages/BattleLobbyPage";
import { BattleRoomPage } from "./pages/BattleRoomPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { GachaPage } from "./pages/GachaPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RaidLobbyListPage } from "./pages/RaidLobbyListPage";
import { RaidRoomPage } from "./pages/RaidRoomPage";
import { RankingPage } from "./pages/RankingPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { RoyaleLobbyListPage } from "./pages/RoyaleLobbyListPage";
import { RoyaleRoomPage } from "./pages/RoyaleRoomPage";
import { ShopPage } from "./pages/ShopPage";
import { TournamentLobbyListPage } from "./pages/TournamentLobbyListPage";
import { TournamentRoomPage } from "./pages/TournamentRoomPage";
import { TradeLobbyPage } from "./pages/TradeLobbyPage";
import { TradeRoomPage } from "./pages/TradeRoomPage";
import { TrainPage } from "./pages/TrainPage";

// /raid/:roomId という旧URL(ブックマーク等)を新URLへ転送する。
// <Navigate>は静的な文字列しか渡せないため、paramsを拾うための小さなラッパーが必要。
function RaidRoomRedirect() {
  const { roomId } = useParams<{ roomId: string }>();
  return <Navigate to={`/battle/raid/${roomId}`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/gacha" element={<GachaPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/battle" element={<BattleHubPage />} />
        <Route path="/battle/duel" element={<BattleLobbyPage />} />
        <Route path="/battle/duel/:roomId" element={<BattleRoomPage />} />
        <Route path="/battle/raid" element={<RaidLobbyListPage />} />
        <Route path="/battle/raid/:roomId" element={<RaidRoomPage />} />
        <Route path="/battle/royale" element={<RoyaleLobbyListPage />} />
        <Route path="/battle/royale/:roomId" element={<RoyaleRoomPage />} />
        <Route path="/battle/tournament" element={<TournamentLobbyListPage />} />
        <Route path="/battle/tournament/:roomId" element={<TournamentRoomPage />} />
        <Route path="/raid" element={<Navigate to="/battle/raid" replace />} />
        <Route path="/raid/:roomId" element={<RaidRoomRedirect />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/train" element={<TrainPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/trade" element={<TradeLobbyPage />} />
        <Route path="/trade/:roomId" element={<TradeRoomPage />} />
        <Route path="/market" element={<Navigate to="/shop" replace />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
