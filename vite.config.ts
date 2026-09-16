import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/import-dtr": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/import-dtr-file": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/import-single-dtr": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/refresh-dtr": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
