import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../api/client";
import type { SpellItem, UserActionResp } from "../api/types";
import { useAuth } from "../store/auth";
import { floatPts, toast } from "../store/ui";
import { speak } from "../utils/speech";
import { CheckIcon, CrossIcon } from "./Listen";

export default function Spell() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ correct: boolean; answer: string; pts: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, refetch } = useQuery<{ items: SpellItem[] }>({
    queryKey: ["practice", "spell"],
    queryFn: () => api<{ items: SpellItem[] }>("/practice/session?mode=spell&limit=5"),
  });

  const item = data?.items[idx];
  const total = data?.items.length ?? 0;

  const check = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!item || result) return;
    if (!typed) {
      toast("先在格子里把单词敲出来");
      return;
    }
    try {
      const res = await api<UserActionResp>("/practice/answer", {
        method: "POST",
        body: { mode: "spell", word_id: item.word_id, answer: typed },
      });
      setUser(res.user);
      floatPts(res.points_added, e.currentTarget);
      setResult({ correct: !!res.correct, answer: res.correct_answer ?? "", pts: res.points_added });
      if (res.task_awarded) toast("任务完成：完成一次拼写练习");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      if (res.correct) speak(res.correct_answer ?? "");
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败");
    }
  };

  const next = () => {
    setTyped("");
    setResult(null);
    if (idx + 1 >= total) {
      setIdx(0);
      refetch();
    } else {
      setIdx(idx + 1);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (!item) return null;

  return (
    <div>
      <div className="q-meta">
        第 {idx + 1} / {total} 题 · 看释义默写
      </div>
      <div className="q-title">
        <span className="zh">{item.meaning}</span>
        <span className="mono">{item.phonetic}</span>
      </div>
      <div className="spell-grid" tabIndex={0} onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          value={typed}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="输入单词拼写"
          onChange={(e) => {
            if (result) return;
            setTyped(e.target.value.replace(/[^a-zA-Z]/g, "").toLowerCase());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !result) {
              e.preventDefault();
              (document.getElementById("spell-check-btn") as HTMLButtonElement | null)?.click();
            }
          }}
        />
        {typed.split("").map((ch, i) => {
          let cls = "spell-cell";
          if (result) cls += ch === result.answer[i]?.toLowerCase() ? " ok" : " bad";
          return (
            <span key={i} className={cls}>
              {ch}
            </span>
          );
        })}
        {!result && <span className="spell-cursor" />}
      </div>
      <div className="spell-ans">
        {result ? (
          result.correct ? (
            <span style={{ color: "var(--green)", fontWeight: 600 }}>全对，+{result.pts} 分</span>
          ) : (
            <>
              正确写法：<b>{result.answer}</b> · 明天会再默一次
            </>
          )
        ) : (
          "点击格子开始输入 · 每个字母会落在四线格里（共 " + item.length + " 个字母）"
        )}
      </div>
      <div className="spell-tools">
        <button className="btn btn-ghost" disabled={!result} onClick={() => result && speak(result.answer, 0.8)}>
          听发音
        </button>
        <button className="btn btn-primary" id="spell-check-btn" style={{ marginLeft: "auto" }} onClick={check} disabled={!!result}>
          检查回车
        </button>
      </div>
      <div className="feedback">
        {result &&
          (result.correct ? (
            <>
              <CheckIcon />
              <span className="fb-ok">答对了</span>
            </>
          ) : (
            <>
              <CrossIcon />
              <span className="fb-no">有字母不对，对照正确写法记一记</span>
            </>
          ))}
        {result && (
          <button className="btn btn-primary next-btn" onClick={next}>
            {idx + 1 >= total ? "再来一组" : "再默一个"}
          </button>
        )}
      </div>
    </div>
  );
}
