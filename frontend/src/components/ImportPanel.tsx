import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../api/client";
import type { ImportResp, ImportTarget } from "../api/types";
import { useAuth } from "../store/auth";
import { toast } from "../store/ui";

export default function ImportPanel({ target }: { target: ImportTarget | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResp | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!target) {
      toast("先在上方书架里选一个单元作为导入目标");
      return;
    }
    if (!/\.(xlsx|csv|txt)$/i.test(file.name)) {
      toast("只支持 .xlsx 和 .csv 文件");
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("unit_id", String(target.unitId));
      const token = useAuth.getState().token;
      const res = await fetch("/api/lists/import/file", {
        method: "POST",
        headers: token ? { Authorization: "Bearer " + token } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "导入失败");
      setResult(data as ImportResp);
      toast(`已导入 ${data.added} 个词${data.skipped ? `，${data.skipped} 个已存在自动跳过` : ""}`);
      qc.invalidateQueries({ queryKey: ["content"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "导入失败");
    } finally {
      setUploading(false);
    }
  };

  const doImport = async () => {
    if (!target) {
      toast("先在上方书架里选一个单元作为导入目标");
      return;
    }
    setImporting(true);
    try {
      const res = await api<ImportResp>("/lists/import", {
        method: "POST",
        body: { text, unit_id: target.unitId },
      });
      setResult(res);
      toast(`已导入 ${res.added} 个词${res.skipped ? `，${res.skipped} 个已存在自动跳过` : ""}`);
      qc.invalidateQueries({ queryKey: ["content"] });
      setText("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card card-pad imp">
      <div className="side-title">
        导入生词
        <span className="more">
          {target ? (
            <>
              目标：《{target.bookName}》· {target.unitName}
            </>
          ) : (
            "尚未选择目标单元"
          )}
        </span>
      </div>
      <div
        className="dropzone"
        role="button"
        aria-label="上传词库文件"
        style={{ opacity: target ? 1 : 0.55 }}
        onClick={() => {
          if (!target) return toast("先在上方书架里选一个单元作为导入目标");
          fileInputRef.current?.click();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) uploadFile(f);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,.txt"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <span>
          {uploading ? (
            "正在导入…"
          ) : (
            <>
              把 CSV / Excel 文件拖到这里，或点击选择
              <br />
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                第一行是表头（单词、音标、词性、释义、例句、例句翻译），从第二行开始填
              </span>
            </>
          )}
        </span>
      </div>
      <div style={{ marginTop: 10, fontSize: 13.5 }}>
        <a
          className="btn btn-ghost"
          href="/api/lists/import/template"
          download="词阶导入模板.xlsx"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
            <path d="M5 20h14" />
          </svg>
          下载导入模板
        </a>
        <span style={{ marginLeft: 10, color: "var(--ink-3)", fontSize: 12.5 }}>模板里带三行示例，删掉换成自己的词就能用</span>
      </div>
      {result && (
        <>
          <div className="imp-preview">
            <table className="preview">
              <thead>
                <tr>
                  <th>单词</th>
                  <th>音标</th>
                  <th>释义</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.word}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)" }}>{r.phonetic || "—"}</td>
                    <td>{r.meaning}</td>
                    <td>
                      <span className={"st " + (r.status === "dup" ? "dup" : "new")}>{r.status === "dup" ? "已存在" : "新增"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="imp-sum">
            共 <b>{result.total}</b> 条 · 新增 <b>{result.added}</b> · 重复 <b>{result.skipped}</b>（自动跳过）
            {result.rows.length >= 20 ? " · 仅显示前 20 条" : ""}
          </div>
        </>
      )}
      <div className="or-line">或 粘贴文本</div>
      <textarea
        value={text}
        spellCheck={false}
        placeholder={"每行一个词条，用逗号或 Tab 分隔：\ndelicious,美味的，可口的\nscenery,/ˈsiːnəri/,风景，景色"}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="imp-tools">
        <button className="btn btn-primary" disabled={!text.trim() || importing || !target} onClick={doImport}>
          {importing ? "导入中…" : "确认导入"}
        </button>
        {!target && <span style={{ fontSize: 12.5, color: "var(--amber)" }}>先在上方书架里选一个单元</span>}
      </div>
    </div>
  );
}
