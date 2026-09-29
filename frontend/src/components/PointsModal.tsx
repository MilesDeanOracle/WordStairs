import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { LedgerRow } from "../api/types";
import { useAuth } from "../store/auth";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
  return `${d.getMonth() + 1}-${d.getDate()} ${hm}`;
}

export default function PointsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const { data: ledger } = useQuery<LedgerRow[]>({
    queryKey: ["ledger"],
    queryFn: () => api<LedgerRow[]>("/points/ledger"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-mask" onClick={onClose}>
      <div
        className="modal points-modal"
        role="dialog"
        aria-modal="true"
        aria-label="我的积分"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="关闭" onClick={onClose}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
        <div className="points-head">
          <span className="seal stamp-in points-seal">积</span>
          <div>
            <div className="points-title">我的积分</div>
            <div className="points-sub">
              当前 <b className="mono">{user?.points ?? 0}</b> 分 · 今日{" "}
              <b className="mono">
                {user?.daily_earned ?? 0} / {user?.daily_cap ?? 300}
              </b>
            </div>
          </div>
        </div>
        <div className="points-body">
          <div className="ledger">
            {(ledger ?? []).map((r, i) => (
              <div key={i} className="led-row">
                <span className="led-name">{r.reason}</span>
                <span className={"led-val " + (r.delta > 0 ? "plus" : "minus")}>
                  {r.delta > 0 ? "+" : "−"}
                  {Math.abs(r.delta)}
                </span>
                <span className="led-time">{timeLabel(r.created_at)}</span>
              </div>
            ))}
            {ledger && ledger.length === 0 && (
              <div className="led-empty">还没有积分记录，去学第一个词吧</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
