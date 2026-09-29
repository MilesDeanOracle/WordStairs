import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../api/client";
import type { SpeakItem, UserActionResp } from "../api/types";
import { useAuth } from "../store/auth";
import { floatPts, toast } from "../store/ui";
import { getRecognizer, simScore, speak } from "../utils/speech";

export default function Speak() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const busyRef = useRef(false);

  const { data, refetch } = useQuery<{ items: SpeakItem[] }>({
    queryKey: ["practice", "speak"],
    queryFn: () => api<{ items: SpeakItem[] }>("/practice/session?mode=speak&limit=4"),
  });

  const item = data?.items[idx];
  const total = data?.items.length ?? 0;

  const submitScore = async (sc: number) => {
    if (!item) return;
    try {
      const res = await api<UserActionResp>("/practice/answer", {
        method: "POST",
        body: { mode: "speak", word_id: item.word_id, score: sc },
      });
      setUser(res.user);
      floatPts(res.points_added);
      if (res.task_awarded) toast("任务完成：跟读 3 个句子");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败");
    }
  };

  const startMic = () => {
    const rec = getRecognizer();
    if (!rec) {
      toast("这个浏览器不支持语音识别，用 Edge 或 Chrome 打开就能跟读打分");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    speak("");
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      busyRef.current = false;
    };
    rec.onerror = (e) => {
      setListening(false);
      busyRef.current = false;
      toast(e.error === "not-allowed" ? "麦克风权限被拒绝了，在浏览器地址栏允许一下" : "没听清，再试一次");
    };
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript.trim();
      const sc = item ? simScore(item.sentence, said) : 0;
      setTranscript(said);
      setScore(sc);
      submitScore(sc);
    };
    rec.start();
  };

  const next = () => {
    setScore(null);
    setTranscript("");
    if (idx + 1 >= total) {
      setIdx(0);
      refetch();
    } else {
      setIdx(idx + 1);
    }
  };

  if (!item) return null;

  const arc = 2 * Math.PI * 38 * ((score ?? 0) / 100);
  const advice =
    score === null
      ? ""
      : score >= 85
        ? "读得很准，注意长句子的停顿"
        : score >= 60
          ? "意思到了，把重音再对一对"
          : "再听一遍示范，慢一点跟读";

  return (
    <div>
      <div className="q-meta">
        第 {idx + 1} / {total} 题
      </div>
      <div className="q-meta" style={{ marginBottom: 0 }}>大声读出这个句子</div>
      <div className="listen-row" style={{ marginTop: 10 }}>
        <button className="listen-btn" aria-label="播放示范朗读" onClick={() => speak(item.sentence, 0.85)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5.5 6.5 9H3.5v6h3L11 18.5z" />
            <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.6a7.6 7.6 0 0 1 0 10.8" />
          </svg>
        </button>
        <div>
          <div className="speak-target">{item.sentence}</div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{item.sentence_cn}</div>
        </div>
      </div>
      <div className="spell-tools" style={{ marginTop: 4 }}>
        <button className={"mic-btn" + (listening ? " listening" : "")} aria-label="开始跟读" onClick={startMic}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
          </svg>
        </button>
        <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
          {listening ? "在听了，大声读吧…" : "点击麦克风开始跟读"}
        </div>
      </div>
      {score !== null && (
        <div className="speak-result">
          <div className="score-ring">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="38" fill="none" stroke="#E8EDF3" strokeWidth="7" />
              <circle
                cx="44"
                cy="44"
                r="38"
                fill="none"
                stroke="#C4382E"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="238.8"
                strokeDashoffset={238.8 - arc}
                style={{ transition: "stroke-dashoffset .7s ease" }}
              />
            </svg>
            <div className="val">
              <span>{score}</span>
              <small>得分</small>
            </div>
          </div>
          <div className="speak-trans">
            听到你说：<b>“{transcript}”</b>
            <div style={{ fontSize: 12.5, marginTop: 2 }}>{advice}</div>
          </div>
          <button className="btn btn-primary next-btn" onClick={next}>
            {idx + 1 >= total ? "再来一组" : "下一句"}
          </button>
        </div>
      )}
      <div className="speak-note">
        <span className="dot" />
        评分基于浏览器语音识别，后续可接入专业发音评估接口
      </div>
    </div>
  );
}
