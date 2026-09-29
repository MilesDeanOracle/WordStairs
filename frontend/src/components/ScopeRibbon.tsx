import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Slider } from "antd";
import { useEffect, useRef, useState } from "react";
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

const STAGE_LABEL: Record<string, string> = { primary: "小学", junior: "初中", senior: "高中", other: "其他" };

/** 由开关数据推出滑块区间（0 起始、含端点）；全部关闭时回落为整本 */
function spanOf(units: ScopeUnit[]) {
  let lo = -1;
  let hi = -2;
  units.forEach((u, i) => {
    if (u.study || u.practice) {
      if (lo < 0) lo = i;
      hi = i;
    }
  });
  if (lo < 0) return { lo: 0, hi: units.length - 1, none: true };
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
    // 拖动进行中时，不用服务器数据覆盖用户操作
    if (dragging.current) return;
    const next = spanOf(units);
    spanRef.current = next;
    setSpan(next);
  }, [units]);

  const commit = (lo: number, hi: number) => {
    window.clearTimeout(commitTimer.current);
    dragging.current = false;
    onRange(book.id, lo + 1, hi + 1); // 转 1 起始、含端点
  };

  const handleChange = (lo: number, hi: number) => {
    dragging.current = true;
    const next = { lo, hi, none: false };
    spanRef.current = next;
    setSpan(next);
    // 兜底：onChangeComplete 未触发时（部分输入路径），600ms 无后续操作也提交
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => commit(lo, hi), 600);
  };

  return (
    <>
      <div className="range-line">
        <span className={"range-val" + (span.none ? " off" : "")}>
          {n === 0 ? "—" : span.none ? "未选" : n === 1 ? `Unit 1` : `Unit ${span.lo + 1}–${span.hi + 1}`}
        </span>
        {n > 0 && (
          <Slider
            className="range-slider"
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
        )}
        <span className="range-count">{span.none ? 0 : span.hi - span.lo + 1} 个单元</span>
      </div>
      <div className="scope-unit-list">
        {units.map((u, i) => {
          const inRange = !span.none && i >= span.lo && i <= span.hi;
          return (
            <span key={u.id} className={"uchip" + (inRange ? " in" : "")}>
              {u.name}
            </span>
          );
        })}
      </div>
    </>
  );
}

export default function ScopeRibbon() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: books } = useQuery<ScopeBook[]>({
    queryKey: ["scope"],
    queryFn: () => api<ScopeBook[]>("/scope"),
  });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const activeCount = (books ?? []).reduce((a, b) => a + b.units.filter((u) => u.study || u.practice).length, 0);

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

  return (
    <div className="scope-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"drawer-pull" + (open ? " open" : "") + (activeCount === 0 ? " empty" : "")}
        onClick={() => setOpen((o) => !o)}
        title={activeCount === 0 ? "拉开抽屉，设置学习范围（当前没有选中任何单元）" : open ? "推回抽屉" : "拉开抽屉，设置学习范围"}
        aria-expanded={open}
        aria-label="学习范围"
      >
        <i className="ridge" />
        <i className="ridge" />
        <i className="ridge" />
      </button>

      <div className={"scope-drawer" + (open ? " open" : "")} role="dialog" aria-label="学习范围">
        <div className="scope-head">
          <b>学习范围</b>
          <span className="scope-note">勾选课本整本加入；拖动滑块两端选出一段单元（如 Unit 2–5），选中的单元同时用于学习和练习</span>
          <button type="button" className="mini-btn" onClick={() => setOpen(false)}>
            推回 ▴
          </button>
        </div>
          <div className="scope-books">
            {(books ?? []).map((b) => {
              const all = b.units.length > 0 && b.units.every((u) => u.study && u.practice);
              const any = b.units.some((u) => u.study || u.practice);
              return (
                <div key={b.id} className="scope-book">
                  <div
                    className="scope-book-row"
                    role="checkbox"
                    aria-checked={all ? true : any ? "mixed" : false}
                    tabIndex={0}
                    onClick={() => {
                      if (!b.units.length) return;
                      if (any) putRange(b.id, 1, 0);
                      else putRange(b.id, 1, b.units.length);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === " " || e.key === "Enter") && b.units.length) {
                        any ? putRange(b.id, 1, 0) : putRange(b.id, 1, b.units.length);
                      }
                    }}
                  >
                    <span className={"ckbx" + (all ? " on" : "") + (!all && any ? " ind" : "")}>
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6.5l2.6 2.6L10 3.5" />
                      </svg>
                    </span>
                    <span className="scope-book-name">{b.name}</span>
                    <span className="stage-tag">{STAGE_LABEL[b.stage] ?? "其他"}</span>
                    <span className="scope-book-count">{b.units.length} 单元</span>
                  </div>
                  {b.units.length ? (
                    <BookCard book={b} onRange={putRange} />
                  ) : (
                    <div className="scope-unit-empty">还没有单元</div>
                  )}
                </div>
              );
            })}
            {books && books.length === 0 && (
              <div className="scope-unit-empty" style={{ padding: "14px 2px" }}>
                书架还没有书，先在管理页建书并添加单元
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
