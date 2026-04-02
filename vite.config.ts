import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isCapacitorBuild = process.env.VITE_CAPACITOR === "1";

const pwa = VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon.png"],
  manifest: {
    name: "Prompt Fix",
    short_name: "PromptFix",
    description:
      "AI prompt improvement for builders — sharper prompts and alternatives.",
    theme_color: "#F5F5F7",
    background_color: "#F5F5F7",
    display: "standalone",
    orientation: "any",
    start_url: "/",
    icons: [
      {
        src: "apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "promptfix-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
});

export default defineConfig({
  base: isCapacitorBuild ? "./" : "/",
  plugins: [react(), ...(isCapacitorBuild ? [] : [pwa])],
});
