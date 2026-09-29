import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import type { AdminBook, Me } from "../api/types";
import Bookshelf from "../components/Bookshelf";
import ImportPanel from "../components/ImportPanel";
import { toast } from "../store/ui";

type AdminUser = Me & { learned_today: number; created_at: string; current_book_id: number | null };

export default function Admin() {
  const qc = useQueryClient();
  const { data: users, error } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => api<AdminUser[]>("/admin/users"),
  });
  const { data: books } = useQuery<AdminBook[]>({
    queryKey: ["content"],
    queryFn: () => api<AdminBook[]>("/admin/content"),
  });
  const [importTarget, setImportTarget] = useState<{ unitId: number; bookName: string; unitName: string } | null>(null);

  const assignBook = async (userId: number, bookId: number | null) => {
    if (!bookId) return;
    try {
      await api(`/books/${bookId}/use`, { method: "POST", body: { user_id: userId } });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast("已指派词书，对方明早的队列会排好");
    } catch (e) {
      toast(e instanceof Error ? e.message : "指派失败");
    }
  };

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">管理</h2>
        <span className="page-note">账号与词书指派 · 书架（书 / 单元 / 单词）维护 · 生词导入</span>
      </div>

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="side-title">账号情况</div>
        <div className="imp-preview" style={{ marginTop: 0 }}>
          {error ? (
            <div style={{ fontSize: 14, color: "var(--red-deep)" }}>
              {error instanceof Error ? error.message : "加载失败"}
            </div>
          ) : (
            <table className="preview">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>年级</th>
                  <th>当前词书</th>
                  <th>积分</th>
                  <th>阶位</th>
                  <th>连续打卡</th>
                  <th>今日已学</th>
                  <th>注册时间</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.username}
                      {u.is_admin && (
                        <span className="st new" style={{ marginLeft: 6 }}>
                          管理员
                        </span>
                      )}
                    </td>
                    <td>{u.grade}</td>
                    <td>
                      <select
                        value={u.current_book_id ?? ""}
                        onChange={(e) => assignBook(u.id, e.target.value ? Number(e.target.value) : null)}
                        style={{ border: "1px solid var(--hair)", borderRadius: 7, padding: "3px 8px", fontSize: 12.5, background: "#fff" }}
                      >
                        <option value="">未指派</option>
                        {(books ?? []).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontFamily: "var(--mono)" }}>{u.points}</td>
                    <td>
                      第 {u.stage} 阶 · {u.stage_title}
                    </td>
                    <td style={{ fontFamily: "var(--mono)" }}>{u.streak} 天</td>
                    <td style={{ fontFamily: "var(--mono)" }}>
                      {u.learned_today} / {u.goal}
                    </td>
                    <td style={{ color: "var(--ink-3)" }}>{u.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Bookshelf target={importTarget} onTargetChange={setImportTarget} />

      <div style={{ height: 18 }} />
      <ImportPanel target={importTarget} />
    </>
  );
}
