import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Slider } from "antd";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { toast } from "../store/ui";

interface ScopeUnit {
  id: number;
  name: string;
  study: boolean;
  practice: boolean;
}

interface ScopeBook {
  id: number;
  name: string;
  stage: string;
  units: ScopeUnit[];
}

const STAGE_LABEL: Record<string, string> = {
  primary: "小学",
  junior: "初中",
  senior: "高中",
  other: "其他",
};

/** 由单元开关状态推算滑块区间（0 起始，含端点） */
function spanOf(units: ScopeUnit[]) {
  let lo = -1;
  let hi = -2;
  units.forEach((u, i) => {
    if (u.study || u.practice) {
      if (lo < 0) lo = i;
      hi = i;
    }
  });
  if (lo < 0) return { lo: 0, hi: Math.max(0, units.length - 1), none: true };
  return { lo, hi, none: false };
}

function BookCard({
  book,
  onRange,
}: {
  book: ScopeBook;
  onRange: (bookId: number, start: number, end: number) => void;
}) {
  const units = book.units;
  const n = units.length;
  const [span, setSpan] = useState(() => spanOf(units));
  const spanRef = useRef(span);
  const dragging = useRef(false);
  const commitTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(commitTimer.current);
  }, []);

  useEffect(() => {
    if (dragging.current) return;
    const next = spanOf(units);
    spanRef.current = next;
    setSpan(next);
  }, [units]);

  const commit = (lo: number, hi: number) => {
    window.clearTimeout(commitTimer.current);
    dragging.current = false;
    const next = { lo, hi, none: false };
    spanRef.current = next;
    setSpan(next);
    onRange(book.id, lo + 1, hi + 1); // 转为 1 起始、含端点
  };

  const handleClearBook = () => {
    window.clearTimeout(commitTimer.current);
    dragging.current = false;
    const next = { lo: 0, hi: Math.max(0, n - 1), none: true };
    spanRef.current = next;
    setSpan(next);
    onRange(book.id, 1, 0); // start > end 表示全部关闭
  };

  const handleChange = (lo: number, hi: number) => {
    dragging.current = true;
    const next = { lo, hi, none: false };
    spanRef.current = next;
    setSpan(next);
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => commit(lo, hi), 600);
  };

  const handleToggleBook = () => {
    if (!n) return;
    if (!span.none) {
      handleClearBook();
    } else {
      commit(0, n - 1);
    }
  };

  const handleUnitChipClick = (i: number) => {
    if (span.none) {
      commit(i, i);
    } else if (span.lo === i && span.hi === i) {
      handleClearBook();
    } else if (i < span.lo) {
      commit(i, span.hi);
    } else if (i > span.hi) {
      commit(span.lo, i);
    } else {
      if (i === span.lo) commit(span.lo + 1, span.hi);
      else if (i === span.hi) commit(span.lo, span.hi - 1);
      else commit(i, i);
    }
  };

  const all = n > 0 && !span.none && span.lo === 0 && span.hi === n - 1;
  const any = !span.none && n > 0;
  const selectedCount = span.none ? 0 : span.hi - span.lo + 1;

  return (
    <div className={"book-card" + (any ? " active" : "")}>
      <div className="book-card-header">
        <div
          className="book-check-area"
          role="checkbox"
          aria-checked={all ? true : any ? "mixed" : false}
          tabIndex={0}
          onClick={handleToggleBook}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              handleToggleBook();
            }
          }}
          title={all ? "整本书已开启，点击取消全选" : any ? "部分单元已开启，点击取消全选" : "点击全选本课本"}
        >
          <span className={"book-checkbox" + (all ? " checked" : any ? " indeterminate" : "")}>
            {all && (
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6.5l2.6 2.6L10 3.5" />
              </svg>
            )}
            {!all && any && (
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M3 6h6" />
              </svg>
            )}
          </span>
          <span className="book-title" title={book.name}>{book.name}</span>
          <span className={"stage-pill " + (book.stage || "other")}>
            {STAGE_LABEL[book.stage] ?? "其他"}
          </span>
        </div>

        <div className="book-header-right">
          <span className={"range-pill" + (span.none ? " off" : "")}>
            {n === 0 ? "无单元" : span.none ? "未开启" : n === 1 ? "Unit 1" : `Unit ${span.lo + 1}–${span.hi + 1}`}
          </span>
          <span className="book-unit-stat">
            {selectedCount}/{n} 单元
          </span>
        </div>
      </div>

      {n > 0 ? (
        <div className="book-controls">
          <div className="slider-row">
            <Slider
              className="drawer-slider"
              range={{ draggableTrack: true }}
              min={0}
              max={Math.max(0, n - 1)}
              value={[span.lo, span.hi]}
              tooltip={{ formatter: (v) => (v === undefined ? "" : `Unit ${v + 1}`) }}
              onChange={(value: number | number[]) => {
                const [lo, hi] = value as number[];
                handleChange(lo, hi);
              }}
              onChangeComplete={(value: number | number[]) => {
                const [lo, hi] = value as number[];
                commit(lo, hi);
              }}
            />
            <div className="book-quick-presets">
              <button
                type="button"
                className={"preset-btn" + (all ? " current" : "")}
                onClick={() => commit(0, n - 1)}
                title="开启整本书全部单元"
              >
                整本
              </button>
              {n > 2 && (
                <>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => commit(0, Math.ceil(n / 2) - 1)}
                    title="选择前半部分单元"
                  >
                    前半
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => commit(Math.ceil(n / 2), n - 1)}
                    title="选择后半部分单元"
                  >
                    后半
                  </button>
                </>
              )}
              {any && (
                <button
                  type="button"
                  className="preset-btn clear"
                  onClick={handleClearBook}
                  title="关闭该书的所有单元"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          <div className="unit-chips-wrap">
            {units.map((u, i) => {
              const inRange = !span.none && i >= span.lo && i <= span.hi;
              return (
                <button
                  key={u.id}
                  type="button"
                  className={"unit-chip" + (inRange ? " in-range" : "")}
                  onClick={() => handleUnitChipClick(i)}
                  title={`点击调整区间至 ${u.name}`}
                >
                  <span className="unit-chip-dot" />
                  <span className="unit-chip-name">{u.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="book-empty-units">此书暂无可用单元</div>
      )}
    </div>
  );
}

export default function ScopeRibbon() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const location = useLocation();

  const { data: books } = useQuery<ScopeBook[]>({
    queryKey: ["scope"],
    queryFn: () => api<ScopeBook[]>("/scope"),
  });

  // 路由跳转时自动收起抽屉
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // 按 Esc 键关闭抽屉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 打开抽屉时禁止底层滚动
  useEffect(() => {
    if (open) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [open]);

  const activeCount = (books ?? []).reduce(
    (a, b) => a + b.units.filter((u) => u.study || u.practice).length,
    0
  );

  const activeBooksCount = (books ?? []).filter((b) =>
    b.units.some((u) => u.study || u.practice)
  ).length;

  const apply = () => {
    qc.invalidateQueries({ queryKey: ["scope"] });
    qc.invalidateQueries({ queryKey: ["today"] });
    qc.invalidateQueries({ queryKey: ["practice"] });
  };

  const putRange = async (bookId: number, start: number, end: number) => {
    try {
      await api("/scope/book-range", { method: "PUT", body: { book_id: bookId, start, end } });
      apply();
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败");
    }
  };

  const handleSelectAll = async () => {
    if (!books || books.length === 0) return;
    try {
      await Promise.all(
        books
          .filter((b) => b.units.length > 0)
          .map((b) =>
            api("/scope/book-range", {
              method: "PUT",
              body: { book_id: b.id, start: 1, end: b.units.length },
            })
          )
      );
      apply();
      toast("已开启所有课本单元");
    } catch (e) {
      toast(e instanceof Error ? e.message : "设置失败");
    }
  };

  const handleClearAll = async () => {
    if (!books || books.length === 0) return;
    try {
      await Promise.all(
        books
          .filter((b) => b.units.length > 0)
          .map((b) =>
            api("/scope/book-range", {
              method: "PUT",
              body: { book_id: b.id, start: 1, end: 0 },
            })
          )
      );
      apply();
      toast("已清空学习范围");
    } catch (e) {
      toast(e instanceof Error ? e.message : "设置失败");
    }
  };

  return createPortal(
    <>
      {/* 遮罩背景 */}
      <div
        className={"scope-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* 抽屉与把手容器：固定在顶栏下方 */}
      <div
        className="scope-drawer-portal-container"
        role="dialog"
        aria-modal={open}
        aria-label="学习范围设置"
      >
        <div className={"scope-drawer-panel" + (open ? " open" : "")}>
          {/* 抽屉卡片主体：展开时从顶栏向下平滑拉出 */}
          <div
            className="drawer-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 抽屉头部：绝无把手遮挡 */}
            <div className="drawer-header">
              <div className="drawer-header-left">
                <div className="drawer-title-row">
                  <span className="drawer-title-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M2.5 4.5h11M2.5 11.5h11M6 2.5v4M10 9.5v4" />
                    </svg>
                  </span>
                  <h2 className="drawer-title">学习范围设置</h2>
                  <span className="drawer-count-badge">
                    已选 <b>{activeCount}</b> 个单元
                  </span>
                  {activeBooksCount > 0 && (
                    <span className="drawer-books-badge">
                      涵盖 {activeBooksCount} 本课本
                    </span>
                  )}
                </div>
                <p className="drawer-subtitle">
                  拖动滑块两端或点击单元标签定制学习区间，选中的单元同时进入「今日学习」与「专项练习」
                </p>
              </div>

              <div className="drawer-header-right">
                <button
                  type="button"
                  className="drawer-action-btn"
                  onClick={handleSelectAll}
                  title="开启所有课本的全部单元"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 8.5l3.5 3.5L13 4.5" />
                  </svg>
                  <span>全选</span>
                </button>
                <button
                  type="button"
                  className="drawer-action-btn"
                  onClick={handleClearAll}
                  title="清空当前所有选中的学习单元"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                  <span>清空</span>
                </button>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setOpen(false)}
                  aria-label="关闭抽屉"
                  title="收起抽屉 (Esc)"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 抽屉滚动内容区 */}
            <div className="drawer-body">
              <div className="drawer-books-grid">
                {(books ?? []).map((b) => (
                  <BookCard key={b.id} book={b} onRange={putRange} />
                ))}
                {books && books.length === 0 && (
                  <div className="drawer-empty">
                    <div className="drawer-empty-icon">📚</div>
                    <div className="drawer-empty-title">书架还没有课本</div>
                    <div className="drawer-empty-desc">请前往管理页创建新书并导入单元词汇</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 精致把手：位于抽屉底部边缘，拉出抽屉时顺滑下移至抽屉底端，绝不挡住抽屉 */}
          <div className="drawer-handle-zone">
            <button
              type="button"
              className={"scope-handle" + (open ? " open" : "") + (activeCount === 0 ? " empty" : "")}
              onClick={() => setOpen((o) => !o)}
              title={open ? "推回收起抽屉 (Esc)" : "拉开抽屉，设置学习范围"}
              aria-expanded={open}
              aria-label="学习范围抽屉把手"
            >
              <span className="scope-handle-content">
                <span className="scope-handle-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2.5 4.5h11M2.5 11.5h11M6 2.5v4M10 9.5v4" />
                  </svg>
                </span>
                <span className="scope-handle-title">
                  {open ? "收起抽屉" : "学习范围"}
                </span>
                <span className="scope-handle-badge">
                  {activeCount > 0 ? `${activeCount} 单元` : "未设"}
                </span>
                <span className="scope-handle-arrow" aria-hidden="true">
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 4.5L6 8L9.5 4.5" />
                  </svg>
                </span>
              </span>
              <span className="scope-handle-grip" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
