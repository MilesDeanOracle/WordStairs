import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 绑定所有网卡：本机 localhost 和平板局域网 IP 都能访问
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8735",
    },
  },
});
