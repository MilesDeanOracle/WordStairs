import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Task } from "../api/types";

export default function Tasks() {
  const { data } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => api<Task[]>("/study/tasks"),
  });

  return (
    <div className="card card-pad">
      <div className="side-title">今日任务</div>
      <div className="tasks">
        {(data ?? []).map((t) => (
          <div key={t.key} className={"task" + (t.done ? " done" : "")}>
            <span className="task-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            </span>
            <span className="task-body">
              <span className="task-name">{t.name}</span>
              <span className="task-prog">
                {t.now} / {t.goal}
              </span>
            </span>
            <span className="task-pts">+{t.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
