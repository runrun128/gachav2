import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>("/auth/forgot-password", { email });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "リクエストに失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="panel auth-card" onSubmit={onSubmit}>
        <h1>🔑 パスワードを忘れた場合</h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-dim)", marginTop: "-0.25rem" }}>
          登録済みのメールアドレスを入力してください。再設定用のリンクを運営が確認できるようにします。
        </p>
        <div className="form-field">
          <label>メールアドレス</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        {message && <p style={{ color: "var(--success)", fontSize: "0.9rem" }}>{message}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
          再設定リンクを送信
        </button>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-dim)" }}>
          <Link to="/login">ログイン画面に戻る</Link>
        </p>
      </form>
    </div>
  );
}
