import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["etaabo-icon.svg", "robots.txt"],
      manifest: {
        name: "eTaabo",
        short_name: "eTaabo",
        description: "Tap, Pay & Track — lacag-bixin fudud oo ganacsi.",
        theme_color: "#00B894",
        background_color: "#1F2A37",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/etaabo-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/etaabo-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
