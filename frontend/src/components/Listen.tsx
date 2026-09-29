import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ListenItem, UserActionResp } from "../api/types";
import { useAuth } from "../store/auth";
import { floatPts, toast } from "../store/ui";
import { speak } from "../utils/speech";

export function CheckIcon() {
  return (
    <svg className="fb-check" viewBox="0 0 32 32">
      <path d="M6 17 l7 7 L26 8" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg style={{ width: 22, height: 22, flex: "none" }} viewBox="0 0 24 24" fill="none" stroke="#C4382E" strokeWidth="2.6" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function Listen() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [fb, setFb] = useState<{ ok: boolean; pts: number; answer: string } | null>(null);

  const { data, refetch } = useQuery<{ items: ListenItem[] }>({
    queryKey: ["practice", "listen"],
    queryFn: () => api<{ items: ListenItem[] }>("/practice/session?mode=listen&limit=5"),
  });

  const item = data?.items[idx];
  const total = data?.items.length ?? 0;

  const play = (text?: string) => {
    if (text) speak(text, 0.85);
  };

  useEffect(() => {
    if (item) play(item.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.word_id]);

  const answer = async (opt: string, i: number, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!item || picked !== null) return;
    setPicked(i);
    try {
      const res = await api<UserActionResp>("/practice/answer", {
        method: "POST",
        body: { mode: "listen", word_id: item.word_id, answer: opt },
      });
      setUser(res.user);
      floatPts(res.points_added, e?.currentTarget);
      setFb({ ok: !!res.correct, pts: res.points_added, answer: res.correct_answer ?? "" });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= 4 && item && picked === null) {
        const opt = item.options[n - 1];
        if (opt) answer(opt, n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, picked]);

  const next = () => {
    if (idx + 1 >= total) {
      setIdx(0);
      setPicked(null);
      setFb(null);
      refetch();
    } else {
      setIdx(idx + 1);
      setPicked(null);
      setFb(null);
    }
  };

  if (!item) return null;

  return (
    <div>
      <div className="q-meta">
        第 {idx + 1} / {total} 题
      </div>
      <div className="q-title">听录音，选出正确的意思</div>
      <div className="listen-row">
        <button
          className="listen-btn"
          aria-label="播放录音"
          onClick={() => play(item.text)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5.5 6.5 9H3.5v6h3L11 18.5z" />
            <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.6a7.6 7.6 0 0 1 0 10.8" />
          </svg>
        </button>
        <span className="listen-cap">可以反复听 · 键盘 1–4 快速作答</span>
      </div>
      <div className="opts">
        {item.options.map((opt, i) => (
          <button
            key={i}
            className={
              "opt" +
              (picked !== null && i === item.correct_index ? " right" : "") +
              (picked === i && i !== item.correct_index ? " wrong" : "")
            }
            disabled={picked !== null}
            onClick={(e) => answer(opt, i, e)}
          >
            <kbd>{i + 1}</kbd>
            {opt}
          </button>
        ))}
      </div>
      <div className="feedback">
        {fb &&
          (fb.ok ? (
            <>
              <CheckIcon />
              <span className="fb-ok">答对了，+{fb.pts} 分</span>
            </>
          ) : (
            <>
              <CrossIcon />
              <span className="fb-no">是「{fb.answer}」，这个词排进复习队列</span>
            </>
          ))}
        {picked !== null && (
          <button className="btn btn-primary next-btn" onClick={next}>
            {idx + 1 >= total ? "再来一组" : "下一题"}
          </button>
        )}
      </div>
    </div>
  );
}
