import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>("/auth/reset-password", { token, newPassword });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "パスワードの再設定に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="center-screen">
        <div className="panel auth-card">
          <h1>🔑 パスワード再設定</h1>
          <p className="error-text">リンクが正しくありません。もう一度「パスワードを忘れた場合」からやり直してください。</p>
          <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-dim)" }}>
            <Link to="/forgot-password">パスワードを忘れた場合へ</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <form className="panel auth-card" onSubmit={onSubmit}>
        <h1>🔑 パスワード再設定</h1>
        {message ? (
          <>
            <p style={{ color: "var(--success)", fontSize: "0.9rem" }}>{message}</p>
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-dim)" }}>
              <Link to="/login">ログイン画面へ</Link>
            </p>
          </>
        ) : (
          <>
            <div className="form-field">
              <label>新しいパスワード</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="form-field">
              <label>新しいパスワード(確認)</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
              パスワードを再設定
            </button>
          </>
        )}
      </form>
    </div>
  );
}
