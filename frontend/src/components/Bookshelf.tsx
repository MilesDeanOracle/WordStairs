import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { AdminBook, UnitWord } from "../api/types";
import { toast } from "../store/ui";

const STAGES: { value: string; label: string }[] = [
  { value: "primary", label: "小学" },
  { value: "junior", label: "初中" },
  { value: "senior", label: "高中" },
  { value: "other", label: "其他" },
];

const SPINE: Record<string, string> = {
  primary: "var(--indigo)",
  junior: "var(--teal)",
  senior: "var(--wine)",
  other: "var(--ink-3)",
};

const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));

const EMPTY_WORD = { text: "", phonetic: "", pos: "", meaning: "", example: "", example_cn: "", tip: "" };

export default function Bookshelf({
  target,
  onTargetChange,
}: {
  target: { unitId: number; bookName: string; unitName: string } | null;
  onTargetChange: (t: { unitId: number; bookName: string; unitName: string } | null) => void;
}) {
  const qc = useQueryClient();
  const { data: books } = useQuery<AdminBook[]>({
    queryKey: ["content"],
    queryFn: () => api<AdminBook[]>("/admin/content"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["content"] });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [viewingUnit, setViewingUnit] = useState<number | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [newBook, setNewBook] = useState({ name: "", subtitle: "", stage: "primary" });
  const [editingBook, setEditingBook] = useState<{ id: number; name: string; subtitle: string; stage: string } | null>(null);
  const [newUnitFor, setNewUnitFor] = useState<number | null>(null);
  const [newUnitName, setNewUnitName] = useState("");
  const [editingUnit, setEditingUnit] = useState<{ id: number; name: string } | null>(null);
  const [wordForm, setWordForm] = useState<{ unitId: number; wordId: number | null; data: typeof EMPTY_WORD } | null>(null);
  const [unitWords, setUnitWords] = useState<Record<number, UnitWord[]>>({});

  const doConfirm = (key: string, action: () => Promise<unknown>, done: string) => {
    if (confirmKey !== key) {
      setConfirmKey(key);
      setTimeout(() => setConfirmKey((k) => (k === key ? null : k)), 3000);
      return;
    }
    setConfirmKey(null);
    action().then(
      () => {
        toast(done);
        refresh();
      },
      (e) => toast(e instanceof Error ? e.message : "操作失败"),
    );
  };

  const loadWords = async (unitId: number) => {
    try {
      const words = await api<UnitWord[]>(`/admin/content/units/${unitId}/words`);
      setUnitWords((m) => ({ ...m, [unitId]: words }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "加载失败");
    }
  };

  const saveWord = async () => {
    if (!wordForm || !wordForm.data.text.trim() || !wordForm.data.meaning.trim()) {
      toast("单词和释义是必填的");
      return;
    }
    try {
      if (wordForm.wordId) {
        await api(`/admin/content/words/${wordForm.wordId}`, { method: "PATCH", body: wordForm.data });
      } else {
        await api(`/admin/content/units/${wordForm.unitId}/words`, { method: "POST", body: wordForm.data });
      }
      toast(wordForm.wordId ? "已保存修改" : `已添加 ${wordForm.data.text}`);
      setWordForm(null);
      refresh();
      loadWords(wordForm.unitId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <div className="card card-pad">
      <div className="side-title">
        书架管理
        <span className="more">
          {books?.length ? `${books.length} 本书 · 共 ${books.reduce((a, b) => a + b.word_count, 0)} 词` : ""}
        </span>
        <button className="mini-btn primary" style={{ marginLeft: "auto" }} onClick={() => setNewBookOpen((v) => !v)}>
          {newBookOpen ? "收起" : "＋ 新建书"}
        </button>
      </div>

      {newBookOpen && (
        <div className="add-form" style={{ marginBottom: 14 }}>
          <input placeholder="书名，如：人教 PEP · 六年级上册" value={newBook.name} style={{ width: 240 }} onChange={(e) => setNewBook({ ...newBook, name: e.target.value })} />
          <input placeholder="副标题（可空）" value={newBook.subtitle} style={{ width: 160 }} onChange={(e) => setNewBook({ ...newBook, subtitle: e.target.value })} />
          <select value={newBook.stage} onChange={(e) => setNewBook({ ...newBook, stage: e.target.value })}>
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            className="mini-btn primary"
            onClick={async () => {
              if (!newBook.name.trim()) return toast("先填书名");
              try {
                await api("/admin/content/books", { method: "POST", body: newBook });
                toast("书建好了，接着加单元");
                setNewBook({ name: "", subtitle: "", stage: "primary" });
                setNewBookOpen(false);
                refresh();
              } catch (e) {
                toast(e instanceof Error ? e.message : "创建失败");
              }
            }}
          >
            创建
          </button>
        </div>
      )}

      {(books ?? []).map((b) => {
        const isOpen = expanded === b.id;
        return (
          <div key={b.id} className="book" style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
            <div style={{ display: "flex", gap: 14, padding: "12px 0", alignItems: "center" }}>
              <div className="book-spine" style={{ background: SPINE[b.stage] ?? SPINE.other }} />
              <div className="book-body">
                {editingBook?.id === b.id ? (
                  <div className="add-form" style={{ marginTop: 0 }}>
                    <input value={editingBook.name} style={{ width: 220 }} onChange={(e) => setEditingBook({ ...editingBook, name: e.target.value })} />
                    <input value={editingBook.subtitle} placeholder="副标题" style={{ width: 130 }} onChange={(e) => setEditingBook({ ...editingBook, subtitle: e.target.value })} />
                    <select value={editingBook.stage} onChange={(e) => setEditingBook({ ...editingBook, stage: e.target.value })}>
                      {STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="mini-btn primary"
                      onClick={async () => {
                        try {
                          await api(`/admin/content/books/${b.id}`, { method: "PATCH", body: editingBook });
                          toast("已保存");
                          setEditingBook(null);
                          refresh();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "保存失败");
                        }
                      }}
                    >
                      保存
                    </button>
                    <button className="mini-btn" onClick={() => setEditingBook(null)}>
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="book-name">
                      {b.name} <span className="stage-tag">{STAGE_LABEL[b.stage] ?? "其他"}</span>
                    </div>
                    <div className="book-sub">
                      {b.subtitle ? b.subtitle + " · " : ""}
                      {b.units.length} 个单元 · {b.word_count} 词
                    </div>
                  </>
                )}
              </div>
              <div className="book-actions" style={{ marginLeft: "auto" }}>
                <button className="mini-btn" onClick={() => { setExpanded(isOpen ? null : b.id); setNewUnitFor(null); }}>
                  {isOpen ? "收起" : "单元"}
                </button>
                <button className="mini-btn" onClick={() => setEditingBook({ id: b.id, name: b.name, subtitle: b.subtitle, stage: b.stage })}>
                  改名
                </button>
                <button
                  className={"mini-btn danger" + (confirmKey === `book-${b.id}` ? " primary" : "")}
                  onClick={() =>
                    doConfirm(`book-${b.id}`, () => api(`/admin/content/books/${b.id}`, { method: "DELETE" }), "书已删除")
                  }
                >
                  {confirmKey === `book-${b.id}` ? "确认删除？" : "删除"}
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="unit-list">
                {b.units.map((u) => {
                  const isViewing = viewingUnit === u.id;
                  const isTarget = target?.unitId === u.id;
                  return (
                    <div key={u.id} className="unit-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", flexWrap: "wrap" }}>
                        {editingUnit?.id === u.id ? (
                          <>
                            <input value={editingUnit.name} style={{ width: 160 }} onChange={(e) => setEditingUnit({ ...editingUnit, name: e.target.value })} className="add-form" />
                            <button
                              className="mini-btn primary"
                              onClick={async () => {
                                try {
                                  await api(`/admin/content/units/${u.id}`, { method: "PATCH", body: { name: editingUnit.name } });
                                  toast("已保存");
                                  setEditingUnit(null);
                                  refresh();
                                  if (isTarget) onTargetChange({ unitId: u.id, bookName: b.name, unitName: editingUnit.name });
                                } catch (e) {
                                  toast(e instanceof Error ? e.message : "保存失败");
                                }
                              }}
                            >
                              保存
                            </button>
                            <button className="mini-btn" onClick={() => setEditingUnit(null)}>
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="unit-name">{u.name}</span>
                            <span className="unit-count">{u.word_count} 词</span>
                            <div className="book-actions" style={{ marginLeft: "auto" }}>
                              <button
                                className={"mini-btn" + (isTarget ? " on-target" : "")}
                                onClick={() => onTargetChange(isTarget ? null : { unitId: u.id, bookName: b.name, unitName: u.name })}
                                title="选为下方导入的目标单元"
                              >
                                {isTarget ? "导入目标 ✓" : "选为导入目标"}
                              </button>
                              <button
                                className="mini-btn"
                                onClick={() => {
                                  setViewingUnit(isViewing ? null : u.id);
                                  if (!isViewing) loadWords(u.id);
                                }}
                              >
                                {isViewing ? "收起词表" : "词表"}
                              </button>
                              <button className="mini-btn" onClick={() => setEditingUnit({ id: u.id, name: u.name })}>
                                改名
                              </button>
                              <button
                                className={"mini-btn danger" + (confirmKey === `unit-${u.id}` ? " primary" : "")}
                                onClick={() =>
                                  doConfirm(`unit-${u.id}`, () => api(`/admin/content/units/${u.id}`, { method: "DELETE" }), "单元已删除")
                                }
                              >
                                {confirmKey === `unit-${u.id}` ? "确认删除？" : "删除"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {isViewing && (
                        <div className="words-box">
                          <div className="imp-preview" style={{ marginTop: 0 }}>
                            <table className="preview">
                              <thead>
                                <tr>
                                  <th>单词</th>
                                  <th>音标</th>
                                  <th>词性</th>
                                  <th>释义</th>
                                  <th>例句</th>
                                  <th>操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(unitWords[u.id] ?? []).map((w) =>
                                  wordForm?.wordId === w.id ? (
                                    <tr key={w.id}>
                                      <td colSpan={6}>
                                        <WordFormFields
                                          value={wordForm.data}
                                          onChange={(d) => setWordForm({ ...wordForm, data: d })}
                                          onSave={saveWord}
                                          onCancel={() => setWordForm(null)}
                                        />
                                      </td>
                                    </tr>
                                  ) : (
                                    <tr key={w.id}>
                                      <td>{w.text}</td>
                                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)" }}>{w.phonetic || "—"}</td>
                                      <td>{w.pos || "—"}</td>
                                      <td>{w.meaning}</td>
                                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{w.example || "—"}</td>
                                      <td>
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <button className="mini-btn" onClick={() => setWordForm({ unitId: u.id, wordId: w.id, data: { ...EMPTY_WORD, ...w } })}>
                                            改
                                          </button>
                                          <button
                                            className={"mini-btn danger" + (confirmKey === `uw-${w.id}` ? " primary" : "")}
                                            onClick={() =>
                                              doConfirm(`uw-${w.id}`, async () => {
                                                await api(`/admin/content/units/${u.id}/words/${w.id}`, { method: "DELETE" });
                                                await loadWords(u.id);
                                              }, "已从单元移除")
                                            }
                                          >
                                            {confirmKey === `uw-${w.id}` ? "确认？" : "删"}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                          {wordForm && !wordForm.wordId && wordForm.unitId === u.id ? (
                            <WordFormFields value={wordForm.data} onChange={(d) => setWordForm({ ...wordForm, data: d })} onSave={saveWord} onCancel={() => setWordForm(null)} />
                          ) : (
                            <button className="mini-btn" style={{ marginTop: 8 }} onClick={() => setWordForm({ unitId: u.id, wordId: null, data: { ...EMPTY_WORD } })}>
                              ＋ 添加单词
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {newUnitFor === b.id ? (
                  <div className="add-form" style={{ paddingLeft: 4 }}>
                    <input
                      placeholder="单元名，如：Unit 1"
                      value={newUnitName}
                      style={{ width: 180 }}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.nextElementSibling?.dispatchEvent(new Event("click"))}
                    />
                    <button
                      className="mini-btn primary"
                      onClick={async () => {
                        if (!newUnitName.trim()) return toast("先填单元名");
                        try {
                          await api(`/admin/content/books/${b.id}/units`, { method: "POST", body: { name: newUnitName.trim() } });
                          toast("单元建好了");
                          setNewUnitName("");
                          setNewUnitFor(null);
                          refresh();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "创建失败");
                        }
                      }}
                    >
                      创建
                    </button>
                    <button className="mini-btn" onClick={() => setNewUnitFor(null)}>
                      取消
                    </button>
                  </div>
                ) : (
                  <button className="mini-btn" style={{ margin: "6px 0 10px 4px" }} onClick={() => setNewUnitFor(b.id)}>
                    ＋ 添加单元
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {books && books.length === 0 && (
        <div style={{ padding: "26px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
          书架还是空的，点右上角「新建书」开始
        </div>
      )}
    </div>
  );
}

function WordFormFields({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: typeof EMPTY_WORD;
  onChange: (d: typeof EMPTY_WORD) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof typeof EMPTY_WORD) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="add-form" style={{ marginTop: 8 }}>
      <input className="wd-input" placeholder="单词 *" value={value.text} onChange={set("text")} />
      <input className="wd-input" placeholder="音标" value={value.phonetic} onChange={set("phonetic")} />
      <input placeholder="词性" style={{ width: 70 }} value={value.pos} onChange={set("pos")} />
      <input className="wd-input" placeholder="释义 *" value={value.meaning} onChange={set("meaning")} />
      <input className="wd-input-wide" placeholder="例句" value={value.example} onChange={set("example")} />
      <input className="wd-input-wide" placeholder="例句翻译" value={value.example_cn} onChange={set("example_cn")} />
      <input className="wd-input-wide" placeholder="助记（可空）" value={value.tip} onChange={set("tip")} />
      <button className="mini-btn primary" onClick={onSave}>
        保存
      </button>
      <button className="mini-btn" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}
