import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { ScrambleItem, UserActionResp } from "../api/types";
import { useAuth } from "../store/auth";
import { floatPts, toast } from "../store/ui";
import { speak } from "../utils/speech";
import { CheckIcon, CrossIcon } from "./Listen";

export default function Scramble() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const [idx, setIdx] = useState(0);
  const [built, setBuilt] = useState<number[]>([]);
  const [fb, setFb] = useState<{ ok: boolean; pts: number; answer: string } | null>(null);

  const { data, refetch } = useQuery<{ items: ScrambleItem[] }>({
    queryKey: ["practice", "scramble"],
    queryFn: () => api<{ items: ScrambleItem[] }>("/practice/session?mode=scramble&limit=4"),
  });

  const item = data?.items[idx];
  const total = data?.items.length ?? 0;

  const check = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!item || fb) return;
    if (!built.length) {
      toast("先点下面的词语把句子排出来");
      return;
    }
    const answer = built.map((i) => item.chips[i]).join(" ");
    try {
      const res = await api<UserActionResp>("/practice/answer", {
        method: "POST",
        body: { mode: "scramble", word_id: item.word_id, answer },
      });
      setUser(res.user);
      floatPts(res.points_added, e.currentTarget);
      setFb({ ok: !!res.correct, pts: res.points_added, answer: res.correct_answer ?? "" });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      if (res.correct) speak(item.sentence, 0.9);
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败");
    }
  };

  const next = () => {
    setBuilt([]);
    setFb(null);
    if (idx + 1 >= total) {
      setIdx(0);
      refetch();
    } else {
      setIdx(idx + 1);
    }
  };

  if (!item) return null;

  return (
    <div>
      <div className="q-meta">
        第 {idx + 1} / {total} 题
      </div>
      <div className="q-meta" style={{ marginBottom: 0 }}>把词语排成正确的句子</div>
      <div className="scramble-hint">
        <span className="zh">{item.sentence_cn}</span>
      </div>
      <div className="scramble-build" aria-label="句子组装区">
        {built.map((ci) => (
          <button
            key={ci}
            className="chip"
            onClick={() => {
              if (fb?.ok) return;
              setBuilt(built.filter((x) => x !== ci));
            }}
          >
            {item.chips[ci]}
          </button>
        ))}
      </div>
      <div className="scramble-bank">
        {item.chips.map((c, i) => (
          <button
            key={i}
            className={"chip" + (built.includes(i) ? " used" : "")}
            onClick={() => {
              if (fb?.ok) return;
              setBuilt([...built, i]);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="feedback">
        {fb &&
          (fb.ok ? (
            <>
              <CheckIcon />
              <span className="fb-ok">排对了，+{fb.pts} 分</span>
            </>
          ) : (
            <>
              <CrossIcon />
              <span className="fb-no">顺序还不对 · 对照中文提示再排一次</span>
            </>
          ))}
        <button
          className="btn btn-ghost"
          style={{ marginLeft: fb ? 0 : "auto" }}
          onClick={() => {
            setBuilt([]);
            setFb(null);
          }}
        >
          重新排
        </button>
        {fb && (
          <button className="btn btn-primary next-btn" onClick={next}>
            {idx + 1 >= total ? "再来一组" : "下一题"}
          </button>
        )}
      </div>
      {!fb && (
        <div className="spell-tools">
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>点词语放进上面的横线，点已放的词语可以退回</span>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={check}>
            检查
          </button>
        </div>
      )}
    </div>
  );
}
