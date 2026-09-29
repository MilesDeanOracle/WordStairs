import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { TodayResp } from "../api/types";
import Flashcard, { Tally } from "../components/Flashcard";
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
  const [idx, setIdx] = useState(0);
  const { data, refetch } = useQuery<TodayResp>({
    queryKey: ["today"],
    queryFn: () => api<TodayResp>("/study/today"),
  });

  const items = data?.items ?? [];
  const stats = data?.stats;
  const learned = stats?.learned_today ?? user?.learned_today ?? 0;
  const goal = stats?.goal ?? 20;

  return (
    <>
      <section className="board" aria-label="今日概览">
        <div className="board-meta">{dateLabel()}</div>
        <div className="board-row">
          <h1 className="board-hi">
            {greeting()}，<em>{user?.username ?? ""}</em>。
            {items.length > 0 ? `今天还有 ${items.length} 个词要过。` : "今天的队列清空了。"}
          </h1>
          <div className="stat-line">
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
          </div>
        </div>
        <div className="tally-box">
          <Tally n={learned} />
          <span className="tally-cap">
            每写完一个「正」记 5 词 · 今日已学 <b>{learned}</b> / {goal}
          </span>
        </div>
      </section>

      <div className="cols">
        <div className="col-main">
          {idx < items.length ? (
            <Flashcard
              key={items[idx].word.id}
              item={items[idx]}
              index={idx}
              total={items.length}
              onGraded={() => {
                setIdx(idx + 1);
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
              {learned === 0 && user?.is_admin && (
                <Link to="/admin" className="btn btn-primary" style={{ marginTop: 6 }}>
                  去管理里挑词书
                </Link>
              )}
            </div>
          )}
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
