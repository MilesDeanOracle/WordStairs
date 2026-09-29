import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { StudyItem, UserActionResp } from "../api/types";
import { useAuth } from "../store/auth";
import { floatPts, toast } from "../store/ui";
import { speak } from "../utils/speech";

const STROKE_PATHS = ["M4 5h16", "M8 5v14", "M8 11h12", "M17 11v8", "M5 19h17"];

function Zheng({ strokes }: { strokes: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#C4382E" strokeWidth="2.4" strokeLinecap="round">
      {STROKE_PATHS.slice(0, strokes).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Tally({ n }: { n: number }) {
  return (
    <div className="tally" aria-label="今日进度">
      {Array.from({ length: Math.floor(n / 5) }).map((_, i) => (
        <Zheng key={i} strokes={5} />
      ))}
      {n % 5 > 0 && <Zheng strokes={n % 5} />}
    </div>
  );
}

export default function Flashcard({
  item,
  index,
  total,
  onGraded,
}: {
  item: StudyItem;
  index: number;
  total: number;
  onGraded: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);

  const w = item.word;

  const grade = async (level: "yes" | "fuzzy" | "no", e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      const res = await api<UserActionResp>("/study/grade", {
        method: "POST",
        body: { word_id: w.id, level },
      });
      setUser(res.user);
      floatPts(res.points_added, e.currentTarget);
      if (res.task_awarded) toast("任务完成，奖励已入账");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["books"] });
      onGraded();
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败");
    }
  };

  return (
    <div className="card card-pad">
      <div className="fcard-top">
        <span className="fcard-label">
          今日队列 · {item.is_new ? "新词" : "复习"}
        </span>
        <span className="fcard-count">
          {index + 1} / {total}
        </span>
        <button
          className="icon-btn"
          style={{ marginLeft: "auto" }}
          aria-label="朗读单词"
          title="朗读（美音）"
          onClick={() => speak(w.text)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5.5 6.5 9H3.5v6h3L11 18.5z" />
            <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.6a7.6 7.6 0 0 1 0 10.8" />
          </svg>
        </button>
      </div>

      <div className={"fcard" + (flipped ? " flipped" : "")} onClick={() => setFlipped((f) => !f)}>
        <div className="fcard-inner">
          <div className="face front">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".1em" }}>看词 · 想意思</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-3)" }}>
                {w.phonetic}
              </span>
            </div>
            <div className="word-group">
              <div className="fourline fl-word">{w.text}</div>
              <div className="word-meta">
                <span className="word-pos">{w.pos}</span>
              </div>
            </div>
            <div className="face-hint">点击卡片翻面看释义</div>
          </div>
          <div className="face back">
            {(() => {
              const hasSentence = !!(w.example || w.example_cn);
              const tip = w.tip ? (
                <div className="tip-line">
                  <span className="tag">助记</span>
                  <span>{w.tip}</span>
                </div>
              ) : null;
              const hint = (
                <div className="face-hint" style={{ marginTop: 10 }}>
                  再点一下翻回正面
                </div>
              );
              if (!hasSentence) {
                return (
                  <>
                    <div className="word-hero">
                      <span className="zh">{w.meaning}</span>
                    </div>
                    {tip}
                    {hint}
                  </>
                );
              }
              return (
                <>
                  <div className="word-group">
                    <div className="word-def">
                      <span className="zh">{w.meaning}</span>
                    </div>
                    <div className="ex-block">
                      <div className="ex-en">
                        {w.example ? (
                          w.example.split(new RegExp(`(${w.text})`, "i")).map((seg, i) =>
                            seg.toLowerCase() === w.text.toLowerCase() ? (
                              <span key={i} className="hi">
                                {seg}
                              </span>
                            ) : (
                              <span key={i}>{seg}</span>
                            ),
                          )
                        ) : null}
                      </div>
                      {w.example_cn && <div className="ex-cn">{w.example_cn}</div>}
                    </div>
                  </div>
                  {tip}
                  {hint}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="grade-row">
        <button className="btn btn-no" onClick={(e) => grade("no", e)}>
          不认识<small>明天重新学</small>
        </button>
        <button className="btn btn-mid" onClick={(e) => grade("fuzzy", e)}>
          想了一下<small>间隔减半再来</small>
        </button>
        <button className="btn btn-ok" onClick={(e) => grade("yes", e)}>
          认识<small>间隔拉长</small>
        </button>
      </div>
    </div>
  );
}
