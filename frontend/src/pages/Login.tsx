import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Me } from "../api/types";
import { BrandMark } from "../components/Topbar";
import { useAuth } from "../store/auth";

const GRADES = ["三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"];

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("六年级");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await api<{ token: string; user: Me }>(
        mode === "login" ? "/auth/login" : "/auth/register",
        { method: "POST", body: { username: username.trim(), password: password.trim(), grade } },
      );
      setAuth(res.token, res.user);
      nav("/");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "出错了，稍后再试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand">
          <BrandMark size={44} />
          <h1>词阶</h1>
          <p>WordStairs · 拾级而上，日进一阶</p>
        </div>
        <div className="field">
          <label>用户名</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="孩子的名字或昵称"
            required
            minLength={2}
          />
        </div>
        <div className="field">
          <label>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "" : "至少 6 位"}
            required
            minLength={6}
          />
        </div>
        {mode === "register" && (
          <div className="field">
            <label>年级</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
        )}
        {err && <div className="login-err">{err}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "请稍等…" : mode === "login" ? "登录" : "注册并开始"}
        </button>
        <div className="login-switch">
          {mode === "login" ? (
            <>
              还没有账号？
              <button type="button" onClick={() => setMode("register")}>
                注册一个
              </button>
            </>
          ) : (
            <>
              已经有账号了？
              <button type="button" onClick={() => setMode("login")}>
                去登录
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
