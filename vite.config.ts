import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// BASE_PATH permite publicar num subdiretório (ex.: GitHub Pages em /pulso/).
export default defineConfig({
  base: process.env["BASE_PATH"] ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
});
