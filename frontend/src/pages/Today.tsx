import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { StudyItem, TodayResp } from "../api/types";
import Flashcard, { Tally } from "../components/Flashcard";
import ModeSwitch, { type TodayMode } from "../components/ModeSwitch";
import ReviewCard, { type ReviewStats } from "../components/ReviewCard";
import Tasks from "../components/Tasks";
import { useAuth } from "../store/auth";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function dateLabel() {
  const d = new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${week}`;
}

export default function Today() {
  const user = useAuth((s) => s.user);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [learnGraded, setLearnGraded] = useState<Set<number>>(new Set()); // 学习模式里评过的词
  const [dayItems, setDayItems] = useState<StudyItem[]>([]); // 今天出现过的全部词（累积快照）
  const [mode, setMode] = useState<TodayMode>(() =>
    localStorage.getItem("todayMode") === "review" ? "review" : "learn",
  );
  const [rvStats, setRvStats] = useState<ReviewStats | null>(null);
  const { data, refetch } = useQuery<TodayResp>({
    queryKey: ["today"],
    queryFn: () => api<TodayResp>("/study/today"),
  });

  useEffect(() => {
    localStorage.setItem("todayMode", mode);
  }, [mode]);

  // 后端队列是滚动窗口（评过分的词会出列、新词会补位），
  // 这里按首次出现顺序累积成「今日词单」，重新学习时才有完整的词可回炉。
  useEffect(() => {
    if (!data) return;
    setDayItems((prev) => {
      const seen = new Set(prev.map((x) => x.word.id));
      const fresh = data.items.filter((i) => !seen.has(i.word.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [data]);

  /** 评过分的词从队列里摘掉：换下一张卡靠摘除而不是下标 +1，
   *  这样后端刷新队列（词已出列）时不会跳词，学习/复习两个模式也互不重复。 */
  const markDone = (wordId: number) =>
    setDoneIds((prev) => {
      if (prev.has(wordId)) return prev;
      const n = new Set(prev);
      n.add(wordId);
      return n;
    });

  // 学习模式评分：除摘除外，还记进 learnGraded，
  // 复习会话里遇到这些词会悄悄跳过，避免同一个词今天被打两次分。
  const markLearn = (wordId: number) => {
    markDone(wordId);
    setLearnGraded((prev) => {
      if (prev.has(wordId)) return prev;
      const n = new Set(prev);
      n.add(wordId);
      return n;
    });
  };

  /** 重新学习：清掉今日已评记录，把今天累积的词单从第一张再过一遍。
   *  刷新页面后内存快照会丢，这时用后端 day_items（今天评过分的全部词）回填。 */
  const restartLearn = () => {
    setDoneIds(new Set());
    const serverDayItems = data?.day_items ?? [];
    if (serverDayItems.length > 0) {
      setDayItems((prev) => {
        const seen = new Set(prev.map((x) => x.word.id));
        const fresh = serverDayItems.filter((i) => !seen.has(i.word.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    }
    refetch();
  };

  const items = dayItems.filter((i) => !doneIds.has(i.word.id));
  const reviewItems = items.filter((i) => !i.is_new);
  const stats = data?.stats;
  const learned = stats?.learned_today ?? user?.learned_today ?? 0;
  const goal = stats?.goal ?? 20;

  const rvTotal = rvStats ? rvStats.total : stats?.reviews_due ?? 0;
  const rvDone = rvStats?.done ?? 0;
  const reviewRemaining = rvStats ? (rvStats.finished ? 0 : rvStats.total - rvStats.done) : stats?.reviews_due ?? 0;
  const reviewHeadline = rvStats?.finished
    ? "这一轮复习完毕，错词明天见。"
    : rvTotal > 0
      ? `今天有 ${rvTotal} 个词到了复习日。`
      : "今天没有到期的复习。";

  return (
    <>
      <section className="board" aria-label="今日概览">
        <div className="board-top">
          <div className="board-meta">{dateLabel()}</div>
          <ModeSwitch
            mode={mode}
            onSwitch={setMode}
            learnCount={items.length}
            reviewCount={reviewRemaining}
          />
        </div>
        <div className="board-row">
          <h1 className="board-hi">
            {greeting()}，<em>{user?.username ?? ""}</em>。
            {mode === "learn"
              ? items.length > 0
                ? `今天还有 ${items.length} 个词要过。`
                : "今天的队列清空了。"
              : reviewHeadline}
          </h1>
          <div className="stat-line">
            {mode === "learn" ? (
              <>
                <span className="stat">
                  <b>
                    {learned}/{goal}
                  </b>
                  今日已学
                </span>
                <span className="stat">
                  <b>{stats?.reviews_due ?? 0}</b>
                  待复习
                </span>
                <span className="stat">
                  <b>{stats?.new_count ?? 0}</b>
                  新词
                </span>
                <span className="stat">
                  <b>{user?.streak ?? 0}</b>
                  连续打卡
                </span>
              </>
            ) : (
              <>
                <span className="stat">
                  <b>
                    {rvDone}/{rvTotal}
                  </b>
                  已复习
                </span>
                <span className="stat">
                  <b>{rvStats?.wrong ?? 0}</b>
                  本轮错词
                </span>
                <span className="stat">
                  <b>{rvStats?.maxStreak ?? 0}</b>
                  最长连对
                </span>
                <span className="stat">
                  <b>{user?.streak ?? 0}</b>
                  连续打卡
                </span>
              </>
            )}
          </div>
        </div>
        <div className="tally-box">
          <Tally n={mode === "learn" ? learned : rvDone} />
          <span className="tally-cap">
            {mode === "learn" ? (
              <>
                每写完一个「正」记 5 词 · 今日已学 <b>{learned}</b> / {goal}
              </>
            ) : (
              <>
                每写完一个「正」记 5 词 · 已复习 <b>{rvDone}</b> / {rvTotal}
              </>
            )}
          </span>
        </div>
      </section>

      <div className="cols">
        <div className="col-main">
          {/* 学习模式：沿用混合队列 + 翻卡自评（切走再切回不丢进度） */}
          <div className={mode === "learn" ? "" : "hide"}>
            {data === undefined && dayItems.length === 0 ? null : items.length > 0 ? (
              <Flashcard
                key={items[0].word.id}
                item={items[0]}
                index={doneIds.size}
                total={doneIds.size + items.length}
                onRestart={restartLearn}
                onGraded={() => {
                  markLearn(items[0].word.id);
                  refetch();
                }}
              />
            ) : (
              <div className="finish-box">
                <svg className="big-check" viewBox="0 0 44 44">
                  <path d="M8 23 l10 10 L36 11" />
                </svg>
                <div className="title">今天的队列过完了</div>
                <div className="sub">
                  {items.length > 0 || learned > 0
                    ? "不认识的词已排进明天的复习队列"
                    : "还没有配置词书，请家长在管理页建书并指派"}
                </div>
                <span className="seal stamp-in" style={{ padding: "6px 10px", fontSize: 16 }}>
                  今日完成
                </span>
                {(dayItems.length > 0 || (data?.day_items?.length ?? 0) > 0) && (
                  <button type="button" className="btn btn-primary" style={{ marginTop: 6 }} onClick={restartLearn}>
                    重新学习
                  </button>
                )}
                {learned === 0 && user?.is_admin && (
                  <Link to="/admin" className="btn btn-primary" style={{ marginTop: 6 }}>
                    去管理里挑词书
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* 复习模式：选择题快测 */}
          <div className={mode === "review" ? "" : "hide"}>
            {dayItems.length === 0 ? null : reviewItems.length === 0 && !rvStats?.total ? (
              <div className="finish-box">
                <div className="title">今天没有到期的复习</div>
                <div className="sub">学过的词到了日子会自动排进来，先去学几个新词吧</div>
                <button type="button" className="btn btn-primary" onClick={() => setMode("learn")}>
                  去学习模式
                </button>
              </div>
            ) : (
              <ReviewCard
                items={reviewItems}
                pool={dayItems}
                active={mode === "review"}
                doneIds={learnGraded}
                onStats={setRvStats}
                onWordGraded={markDone}
                refetchToday={refetch}
                goLearn={() => setMode("learn")}
              />
            )}
          </div>
        </div>

        <aside className="col-side">
          <Tasks />
          <div className="card card-pad">
            <div className="side-title">我的阶位</div>
            <div className="level-head">
              <span className="seal level-seal stamp-in">{(user?.stage_title ?? "拾").slice(0, 1)}</span>
              <div className="level-info">
                <div className="level-name">
                  第 {user?.stage ?? 1} 阶 · {user?.stage_title ?? "拾词生"}
                </div>
                <div className="level-sub">
                  再得 {Math.max(0, (user?.next_stage_at ?? 200) - (user?.points ?? 0))} 分升入下一阶 · 每阶 200 分
                </div>
              </div>
            </div>
            <div className="stairs" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => {
                const stage = user?.stage ?? 1;
                const cls = "stair" + (i < Math.min(stage, 7) ? (i === Math.min(stage, 7) - 1 ? " now" : " fill") : "");
                return <div key={i} className={cls} style={{ height: `${30 + i * 9}%` }} />;
              })}
            </div>
            <div className="stairs-cap">
              <span>1</span>
              <span>第 {user?.stage ?? 1} 阶</span>
              <span>8</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
