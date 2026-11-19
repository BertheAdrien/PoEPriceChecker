import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En dev, Next bloque les origines autres que localhost (HMR + JS) : sans ça, ouvrir
  // http://127.0.0.1:3000 affiche la page sans l'hydrater (filtres et vérif trade inactifs).
  allowedDevOrigins: ["127.0.0.1"],
  // Image Docker : serveur autonome (.next/standalone) sans node_modules complet.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
