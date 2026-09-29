import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import PointsModal from "./PointsModal";
import ScopeRibbon from "./ScopeRibbon";

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true">
      <g stroke="#213A5E" strokeWidth="1.8" strokeLinecap="round">
        <line x1="3" y1="9" x2="29" y2="9" />
        <line x1="3" y1="16" x2="29" y2="16" />
        <line x1="3" y1="23" x2="29" y2="23" />
        <line x1="3" y1="30" x2="29" y2="30" />
      </g>
      <path d="M15 3 l5 5 M20 3 l-5 5" stroke="#C4382E" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export { BrandMark };

export default function Topbar() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  const [pulse, setPulse] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevPoints = useRef(user?.points);

  useEffect(() => {
    if (user && prevPoints.current !== undefined && user.points > prevPoints.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 220);
      prevPoints.current = user.points;
      return () => clearTimeout(t);
    }
    prevPoints.current = user?.points;
  }, [user?.points, user]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">词阶</span>
          <span className="brand-en">WordStairs</span>
        </div>
        <nav className="menu" aria-label="主导航">
          <NavLink to="/" end className={({ isActive }) => "menu-item" + (isActive ? " on" : "")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="5" width="16" height="15" rx="2.5" />
              <path d="M4 10h16M8 3.5v3M16 3.5v3" />
            </svg>
            <span>今日学习</span>
          </NavLink>
          <NavLink to="/practice" className={({ isActive }) => "menu-item" + (isActive ? " on" : "")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              <path d="M15 5l4 4" />
            </svg>
            <span>专项练习</span>
          </NavLink>
          {user?.is_admin && (
            <NavLink to="/admin" className={({ isActive }) => "menu-item" + (isActive ? " on" : "")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 3v5c0 4.5-3.2 8.4-8 10-4.8-1.6-8-5.5-8-10V6z" />
                <path d="M9 12l2 2 4-4.5" />
              </svg>
              <span>管理</span>
            </NavLink>
          )}
        </nav>
        <div className="top-right">
          <div className="streak-chip" title="连续打卡天数">
            <span className="seal">印</span>
            连续 <b>{user?.streak ?? 0}</b> 天
          </div>
          <button
            className={"pts-chip" + (pulse ? " pulse" : "")}
            title="我的积分"
            onClick={() => setPointsOpen(true)}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8.2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M6 13.5 L9.6 6.5 L11 9.3 L12.4 6.5 L16 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="pts-num">{user?.points ?? 0}</span>
          </button>
          <div className="avatar-wrap" ref={menuRef}>
            <button
              className={"avatar" + (menuOpen ? " open" : "")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={user?.username ?? ""}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {user?.username?.slice(0, 1) ?? "词"}
            </button>
            {menuOpen && (
              <div className="avatar-menu" role="menu">
                <div className="am-head">
                  <div className="am-name">{user?.username ?? ""}</div>
                  <div className="am-sub">
                    {user?.grade ?? ""} · 第 {user?.stage ?? 1} 阶 {user?.stage_title ?? ""}
                  </div>
                </div>
                <button
                  className="am-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setPointsOpen(true);
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="10" cy="10" r="8.2" />
                    <path d="M6 13.5 L9.6 6.5 L11 9.3 L12.4 6.5 L16 13.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>我的积分</span>
                  <span className="am-pts">{user?.points ?? 0}</span>
                </button>
                <button
                  className="am-item am-logout"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    nav("/login");
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12.5 6.5v-2a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 4.5v11A1.5 1.5 0 0 0 5 17h6a1.5 1.5 0 0 0 1.5-1.5v-2" />
                    <path d="M8 10h8.5M14 7.5L16.5 10 14 12.5" />
                  </svg>
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ScopeRibbon />
      <PointsModal open={pointsOpen} onClose={() => setPointsOpen(false)} />
    </header>
  );
}
