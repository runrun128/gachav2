import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AdminRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { AchievementsPage } from "./pages/AchievementsPage";
import { AdminPage } from "./pages/AdminPage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { BattleLobbyPage } from "./pages/BattleLobbyPage";
import { BattleRoomPage } from "./pages/BattleRoomPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { GachaPage } from "./pages/GachaPage";
import { HistoryPage } from "./pages/HistoryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RaidLobbyListPage } from "./pages/RaidLobbyListPage";
import { RaidRoomPage } from "./pages/RaidRoomPage";
import { RankingPage } from "./pages/RankingPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ShopPage } from "./pages/ShopPage";
import { TradeLobbyPage } from "./pages/TradeLobbyPage";
import { TradeRoomPage } from "./pages/TradeRoomPage";
import { TrainPage } from "./pages/TrainPage";

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
        <Route path="/" element={<GachaPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/battle" element={<BattleLobbyPage />} />
        <Route path="/battle/:roomId" element={<BattleRoomPage />} />
        <Route path="/raid" element={<RaidLobbyListPage />} />
        <Route path="/raid/:roomId" element={<RaidRoomPage />} />
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
