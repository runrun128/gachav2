import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, useAuth } from "../lib/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ログインに失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="panel auth-card" onSubmit={onSubmit}>
        <h1>🎰 ログイン</h1>
        <div className="form-field">
          <label>メールアドレス</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>パスワード</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
          ログイン
        </button>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-dim)" }}>
          <Link to="/forgot-password">パスワードを忘れた方はこちら</Link>
        </p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--text-dim)" }}>
          アカウントをお持ちでない方は <Link to="/register">新規登録</Link>
        </p>
      </form>
    </div>
  );
}
