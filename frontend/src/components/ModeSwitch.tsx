export type TodayMode = "learn" | "review";

/** 今日页顶部：学习 / 复习 分段开关，带各自剩余量徽标 */
export default function ModeSwitch({
  mode,
  onSwitch,
  learnCount,
  reviewCount,
}: {
  mode: TodayMode;
  onSwitch: (m: TodayMode) => void;
  learnCount: number;
  reviewCount: number;
}) {
  return (
    <div className="mode-switch" role="tablist" aria-label="学习 / 复习 模式切换">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "learn"}
        className={"ms-btn" + (mode === "learn" ? " on" : "")}
        onClick={() => onSwitch("learn")}
      >
        学习
        {learnCount > 0 && <em className="ms-badge">{learnCount}</em>}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "review"}
        className={"ms-btn" + (mode === "review" ? " on" : "")}
        onClick={() => onSwitch("review")}
      >
        复习
        {reviewCount > 0 && <em className="ms-badge">{reviewCount}</em>}
      </button>
    </div>
  );
}
