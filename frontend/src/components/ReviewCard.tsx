import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { StudyItem, UserActionResp, Word } from "../api/types";
import { useAuth } from "../store/auth";
import { floatPts, toast } from "../store/ui";
import { speak } from "../utils/speech";
import { CheckIcon, CrossIcon } from "./Listen";

/** 今日看板需要展示的复习会话统计 */
export interface ReviewStats {
  total: number; // 本轮词数
  done: number; // 已有结果的词数
  wrong: number; // 出过错（进入重考）的词数
  maxStreak: number; // 最长连对
  finished: boolean; // 本轮是否结束
}

type Level = "yes" | "fuzzy" | "no";

interface Entry {
  item: StudyItem;
  round: number; // 0 = 首考，1 = 错词重考
}

interface WordRecord {
  level: Level;
  wrongFirst: boolean;
  elsewhere?: boolean; // 在学习模式里过掉的词，没有走这轮测验
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** 从今日队列里取 3 个干扰释义（队列本身就来自勾选的单元），拼成四选一 */
function buildOptions(word: Word, pool: Word[]): { options: string[]; correct: number } {
  const others = [
    ...new Set(
      pool
        .filter((w) => w.id !== word.id && w.meaning && w.meaning !== word.meaning)
        .map((w) => w.meaning),
    ),
  ];
  const distractors = shuffle(others).slice(0, 3);
  const options = shuffle([word.meaning, ...distractors]);
  return { options, correct: options.indexOf(word.meaning) };
}

/** 复习模式：选择题快测 + 答错翻面重看 + 错词排到本轮末尾重考 */
export default function ReviewCard({
  items,
  pool,
  active,
  doneIds,
  onStats,
  onWordGraded,
  refetchToday,
  goLearn,
}: {
  items: StudyItem[]; // 到期复习词（未处理过的）
  pool: StudyItem[]; // 今日完整队列，用来取干扰释义
  active: boolean; // 复习模式是否处于前台（控制键盘监听）
  doneIds: Set<number>; // 学习模式里已经评过分的词，复习会话中要跳过避免重复评分
  onStats: (s: ReviewStats) => void;
  onWordGraded: (wordId: number) => void;
  refetchToday: () => void;
  goLearn: () => void;
}) {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);

  const [queue, setQueue] = useState<Entry[] | null>(null);
  const [origin, setOrigin] = useState<StudyItem[] | null>(null); // 本轮复习的原始词单，重新复习用
  const [total, setTotal] = useState(0);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<"right" | "wrong" | null>(null);
  const [records, setRecords] = useState<Record<number, WordRecord>>({});
  const [wrongIds, setWrongIds] = useState<number[]>([]);
  const [run, setRun] = useState({ cur: 0, max: 0 });
  const [busy, setBusy] = useState(false);

  // 到货后冻结一轮会话快照，中途切走再切回来不丢进度
  useEffect(() => {
    if (queue === null && items.length > 0) {
      setQueue(items.map((item) => ({ item, round: 0 })));
      if (origin === null) setOrigin(items);
      setTotal(items.length);
    }
  }, [items, queue, origin]);

  // 学习模式里已经过掉的词，从本轮里悄悄跳过，避免重复评分
  useEffect(() => {
    if (!queue) return;
    let p = pos;
    const skipped: Entry[] = [];
    while (queue[p] && doneIds.has(queue[p].item.word.id)) {
      skipped.push(queue[p]);
      p++;
    }
    if (skipped.length) {
      setRecords((r) => {
        const nr = { ...r };
        for (const s of skipped) {
          if (!nr[s.item.word.id]) nr[s.item.word.id] = { level: "yes", wrongFirst: false, elsewhere: true };
        }
        return nr;
      });
      setPos(p);
      setPicked(null);
      setResult(null);
    }
  }, [pos, queue, doneIds]);

  // 向看板汇报本轮统计
  useEffect(() => {
    if (queue === null) return;
    onStats({
      total,
      done: Object.keys(records).length,
      wrong: wrongIds.length,
      maxStreak: run.max,
      finished: queue.length > 0 && pos >= queue.length,
    });
  }, [queue, total, records, wrongIds, run, pos, onStats]);

  const cur = queue ? queue[pos] : undefined;
  const w = cur?.item.word;

  const { options, correct } = useMemo(
    () => (w ? buildOptions(w, pool.map((i) => i.word)) : { options: [] as string[], correct: -1 }),
    [w?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const answer = (i: number) => {
    if (!cur || !w || result !== null || busy) return;
    setPicked(i);
    if (i === correct) {
      setResult("right");
      setRun((r) => {
        const nc = r.cur + 1;
        return { cur: nc, max: Math.max(r.max, nc) };
      });
    } else {
      setResult("wrong");
      setRun((r) => ({ ...r, cur: 0 }));
      setWrongIds((list) => (list.includes(w.id) ? list : [...list, w.id]));
    }
  };

  const submit = async (
    level: Level,
    word: Word,
    wrongFirst: boolean,
    e?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    setBusy(true);
    try {
      const res = await api<UserActionResp>("/study/grade", {
        method: "POST",
        body: { word_id: word.id, level },
      });
      setUser(res.user);
      floatPts(res.points_added, e?.currentTarget);
      if (res.task_awarded) toast("任务完成，奖励已入账");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["books"] });
      setRecords((r) => (r[word.id] ? r : { ...r, [word.id]: { level, wrongFirst } }));
      onWordGraded(word.id);
      refetchToday();
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "提交失败");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setPicked(null);
    setResult(null);
    setPos((p) => p + 1);
  };

  // 重新复习：用原始词单从头再考一轮
  const restart = () => {
    if (!origin || busy) return;
    setQueue(origin.map((item) => ({ item, round: 0 })));
    setTotal(origin.length);
    setPos(0);
    setPicked(null);
    setResult(null);
    setRecords({});
    setWrongIds([]);
    setRun({ cur: 0, max: 0 });
  };

  // 答对：首考直接过（认识，间隔拉长）；重考算「想了一下」（间隔减半）
  const advanceRight = async (guessed: boolean, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!cur || busy) return;
    const level: Level = guessed || cur.round > 0 ? "fuzzy" : "yes";
    if (await submit(level, cur.item.word, cur.round > 0, e)) next();
  };

  // 答错：首考不打分，排到本轮末尾重考一次；重考仍错才算「不认识」（明天重现）
  const advanceWrong = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!cur || busy) return;
    if (cur.round === 0) {
      setQueue((q) => (q ? [...q, { item: cur.item, round: 1 }] : q));
      next();
    } else if (await submit("no", cur.item.word, true, e)) {
      next();
    }
  };

  // 键盘：数字 1-4 作答，回车进入下一题（仅复习模式在前台时）
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (document.activeElement?.tagName === "BUTTON") return;
        e.preventDefault();
        (document.getElementById("rv-next-btn") as HTMLButtonElement | null)?.click();
        return;
      }
      if (!cur || result !== null) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) answer(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (queue === null || total === 0) return null;

  // ---- 结算页 ----
  if (!cur || !w) {
    const vals = Object.values(records);
    const yes = vals.filter((v) => !v.elsewhere && v.level === "yes").length;
    const fuzzy = vals.filter((v) => !v.elsewhere && v.level === "fuzzy").length;
    const no = vals.filter((v) => !v.elsewhere && v.level === "no").length;
    const elsewhere = vals.filter((v) => v.elsewhere).length;
    const quizzed = Math.max(1, total - elsewhere);
    const firstRight = vals.filter((v) => !v.elsewhere && !v.wrongFirst).length;
    const pct = Math.round((firstRight / quizzed) * 100);
    const wrongWords = wrongIds
      .map((id) => queue.find((q) => q.item.word.id === id)?.item.word)
      .filter((x): x is Word => !!x);
    return (
      <div className="finish-box">
        <svg className="big-check" viewBox="0 0 44 44">
          <path d="M8 23 l10 10 L36 11" />
        </svg>
        <div className="title">这一轮复习完毕</div>
        <div className="sub">
          {yes} 个拉长间隔 · {fuzzy} 个间隔减半 · {no} 个明天再来 · 首答正确率 {pct}%
          {elsewhere > 0 && ` · ${elsewhere} 个已在学习模式过掉`}
        </div>
        <span className="seal stamp-in" style={{ padding: "6px 10px", fontSize: 16 }}>
          复习完毕
        </span>
        {wrongWords.length > 0 && (
          <div className="rv-wrong-list">
            <div className="rv-wrong-title">这轮要再记一记的词，点击可听发音</div>
            {wrongWords.map((x) => (
              <button key={x.id} type="button" className="rv-wrong-word" onClick={() => speak(x.text)}>
                {x.text}
                <span>{x.meaning}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-primary" style={{ marginTop: 6 }} onClick={restart}>
          重新复习
        </button>
        <button type="button" className="btn btn-ghost" onClick={goLearn}>
          回到学习模式
        </button>
      </div>
    );
  }

  // ---- 出题 ----
  const isRe = cur.round > 0;
  return (
    <div className="card card-pad">
      <div className="fcard-top">
        <span className="fcard-label">复习测验 · {isRe ? "错词重考" : `第 ${pos + 1} 题`}</span>
        <span className="fcard-count">
          {Object.keys(records).length} / {total}
        </span>
        <button
          type="button"
          className="mini-btn"
          style={{ marginLeft: "auto" }}
          title="用这一轮的词从头再考一遍"
          disabled={busy}
          onClick={restart}
        >
          重新复习
        </button>
        <button
          className="icon-btn"
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

      <div className="rv-word">
        <div className="fourline fl-word">{w.text}</div>
        <div className="word-meta">
          <span className="word-pos">{w.pos}</span>
          <span className="word-ph">{w.phonetic}</span>
        </div>
        <div className="rv-prompt">想一想意思，选出正确释义 · 键盘 1–{options.length} 作答</div>
      </div>

      <div className="opts rv-opts">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={
              "opt" +
              (result !== null && i === correct ? " right" : "") +
              (picked === i && i !== correct ? " wrong" : "")
            }
            disabled={result !== null}
            onClick={() => answer(i)}
          >
            <kbd>{i + 1}</kbd>
            <span className="zh">{opt}</span>
          </button>
        ))}
      </div>

      {result === "right" && (
        <div className="feedback">
          <CheckIcon />
          <span className="fb-ok">{isRe ? "这次记起来了" : "记对了"}</span>
          {!isRe && (
            <button type="button" className="rv-guess" disabled={busy} onClick={(e) => advanceRight(true, e)}>
              其实是蒙的
            </button>
          )}
          <button
            id="rv-next-btn"
            type="button"
            className="btn btn-primary next-btn"
            disabled={busy}
            onClick={(e) => advanceRight(false, e)}
          >
            下一个
          </button>
        </div>
      )}

      {result === "wrong" && (
        <>
          <div className="rv-reveal">
            <div className="word-def">
              <span className="zh">{w.meaning}</span>
            </div>
            {(w.example || w.example_cn) && (
              <div className="ex-block">
                <div className="ex-en">
                  {w.example
                    ? w.example.split(new RegExp(`(${w.text})`, "i")).map((seg, i) =>
                        seg.toLowerCase() === w.text.toLowerCase() ? (
                          <span key={i} className="hi">
                            {seg}
                          </span>
                        ) : (
                          <span key={i}>{seg}</span>
                        ),
                      )
                    : null}
                </div>
                {w.example_cn && <div className="ex-cn">{w.example_cn}</div>}
              </div>
            )}
            {w.tip && (
              <div className="tip-line">
                <span className="tag">助记</span>
                <span>{w.tip}</span>
              </div>
            )}
          </div>
          <div className="feedback">
            <CrossIcon />
            <span className="fb-no">
              {isRe ? "又没记起来，明天重新来" : "记错了，这个词稍后在本轮末尾再考一次"}
            </span>
            <button
              id="rv-next-btn"
              type="button"
              className="btn btn-primary next-btn"
              disabled={busy}
              onClick={(e) => advanceWrong(e)}
            >
              再看一眼，继续
            </button>
          </div>
        </>
      )}
    </div>
  );
}
