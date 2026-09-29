let enVoice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  enVoice =
    vs.find((v) => /en[-_]US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}

if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text: string, rate = 0.92, onEnd?: () => void) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  if (enVoice) u.voice = enVoice;
  if (onEnd) u.onend = onEnd;
  speechSynthesis.speak(u);
}

interface SRResultEvent {
  results: { 0: { transcript: string } }[];
}
interface SRLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: SRResultEvent) => void) | null;
  start: () => void;
}
type SRCtor = new () => SRLike;

export function getRecognizer(): SRLike | null {
  const Ctor = (window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor })
    .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  return rec;
}

function lev(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** 词命中 + 字符编辑距离的双重相似度，返回 0-100 */
export function simScore(target: string, said: string): number {
  const la = target.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean);
  const lb = said.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean);
  let hit = 0;
  const pool = [...la];
  for (const w of lb) {
    const i = pool.indexOf(w);
    if (i > -1) {
      hit++;
      pool.splice(i, 1);
    }
  }
  const wordScore = hit / Math.max(lb.length, 1);
  const dist = lev(target.toLowerCase().replace(/ /g, ""), said.toLowerCase().replace(/ /g, ""));
  const charScore = 1 - dist / Math.max(target.length, 1);
  return Math.max(0, Math.min(100, Math.round((wordScore * 0.6 + charScore * 0.4) * 100)));
}
