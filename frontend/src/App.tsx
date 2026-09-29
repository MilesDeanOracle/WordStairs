import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Topbar from "./components/Topbar";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Practice from "./pages/Practice";
import Today from "./pages/Today";
import { useAuth } from "./store/auth";
import { useUI } from "./store/ui";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const floats = useUI((s) => s.floats);
  return (
    <>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
            {t.msg}
          </div>
        ))}
      </div>
      {floats.map((f) => (
        <span key={f.id} className="float-pts" style={{ left: f.x, top: f.y }}>
          {f.delta > 0 ? "+" : "−"}
          {Math.abs(f.delta)}
        </span>
      ))}
    </>
  );
}

function Shell() {
  const user = useAuth((s) => s.user);
  return (
    <>
      <Topbar />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/admin" element={user?.is_admin ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  const token = useAuth((s) => s.token);
  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: "#213A5E", borderRadius: 8, fontFamily: "inherit" },
        components: {
          Slider: {
            trackBg: "#C4382E",
            trackHoverBg: "#C4382E",
            handleColor: "#213A5E",
            handleActiveColor: "#C4382E",
            railBg: "#DCE3EA",
            railHoverBg: "#CFD9E3",
            dotBorderColor: "#9AA7B4",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/*" element={token ? <Shell /> : <Navigate to="/login" replace />} />
          </Routes>
          <Toasts />
        </BrowserRouter>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
