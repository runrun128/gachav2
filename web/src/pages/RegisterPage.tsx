import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, useAuth } from "../lib/auth-context";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, displayName, adminCode || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="panel auth-card" onSubmit={onSubmit}>
        <h1>🎲 新規登録</h1>
        <div className="form-field">
          <label>表示名</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} required />
        </div>
        <div className="form-field">
          <label>メールアドレス</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>パスワード(8文字以上)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="form-field">
          <label>運営コード(任意・運営スタッフのみ)</label>
          <input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="通常は空欄でOK" />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
          登録してはじめる
        </button>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-dim)" }}>
          すでにアカウントをお持ちの方は <Link to="/login">ログイン</Link>
        </p>
      </form>
    </div>
  );
}
