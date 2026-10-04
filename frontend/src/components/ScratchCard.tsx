import { useEffect, useRef, useState } from "react";

/** 刮刮乐票券：盖住 children，用指针刮开涂层；刮开过半自动全显，forceOpen 直接翻开。
 *  onOpen 在用户真的刮下第一笔时触发（forceOpen 自动翻开不算），用于“用过提示”判定。 */
export default function ScratchCard({
  children,
  forceOpen,
  onOpen,
}: {
  children: React.ReactNode;
  forceOpen?: boolean;
  onOpen?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);
  const [opened, setOpened] = useState(false);

  // 挂载时画锡纸涂层
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const foil = ctx.createLinearGradient(0, 0, w, h);
    foil.addColorStop(0, "#e6ebf1");
    foil.addColorStop(0.45, "#f8fafc");
    foil.addColorStop(0.55, "#ccd4dd");
    foil.addColorStop(1, "#e9edf2");
    ctx.fillStyle = foil;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 3;
    for (let x = -h; x < w + h; x += 13) {
      ctx.beginPath();
      ctx.moveTo(x, h + 2);
      ctx.lineTo(x + h, -2);
      ctx.stroke();
    }

    ctx.fillStyle = "#788594";
    ctx.font = '600 14px "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦ 刮开 看单词 ✦", w / 2, h / 2);
  }, []);

  // 答题后自动翻开
  useEffect(() => {
    if (forceOpen) setOpened(true);
  }, [forceOpen]);

  // 翻开时清掉涂层
  useEffect(() => {
    if (!opened) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [opened]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // 采样透明像素占比，刮开过半就算全开
  const checkRatio = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 16) {
      total++;
      if (data[i] === 0) clear++;
    }
    if (total > 0 && clear / total > 0.55) setOpened(true);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (opened) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 没有活动指针（如自动化合成事件）时抓取失败不影响刮涂
    }
    drawing.current = true;
    last.current = pointAt(e);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || opened) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pointAt(e);
    const l = last.current ?? p;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 34;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (moves.current === 0) onOpen?.(); // 刮下第一笔即视为用过提示
    moves.current += 1;
    if (moves.current % 8 === 0) checkRatio();
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    checkRatio();
  };

  return (
    <div className="scratch" ref={wrapRef}>
      <div className="scratch-prize">
        {children}
      </div>
      <canvas
        ref={canvasRef}
        className={"scratch-coat" + (opened ? " off" : "")}
        aria-label="刮开涂层查看提示"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </div>
  );
}
