import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function resolveLocalConfigPath(): string | null {
  const rootConfig = path.join(rootDir, "local.config.js");
  const publicConfig = path.join(rootDir, "public", "local.config.js");
  if (fs.existsSync(rootConfig)) return rootConfig;
  if (fs.existsSync(publicConfig)) return publicConfig;
  return null;
}

function copyTizenAssets(): Plugin {
  return {
    name: "copy-tizen-assets",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/dev-xtream-proxy?")) {
          next();
          return;
        }
        const requestUrl = new URL(req.url, "http://127.0.0.1");
        const target = requestUrl.searchParams.get("url");
        if (!target) {
          res.statusCode = 400;
          res.end("Missing url parameter.");
          return;
        }
        try {
          const upstream = await fetch(target, {
            headers: { Accept: "application/json" },
          });
          res.statusCode = upstream.status;
          res.setHeader(
            "Content-Type",
            upstream.headers.get("content-type") ?? "application/json",
          );
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch {
          res.statusCode = 502;
          res.end("Xtream proxy request failed.");
        }
      });

      server.middlewares.use((req, res, next) => {
        if (req.url !== "/local.config.js") {
          next();
          return;
        }
        const file = resolveLocalConfigPath();
        if (!file) {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/javascript");
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const dist = path.join(rootDir, "dist");
      fs.copyFileSync(path.join(rootDir, "config.xml"), path.join(dist, "config.xml"));
      const iconSrc = path.join(rootDir, "public", "icon.png");
      if (fs.existsSync(iconSrc)) {
        fs.copyFileSync(iconSrc, path.join(dist, "icon.png"));
      }
      const brandLogoSrc = path.join(rootDir, "public", "brand-logo.png");
      if (fs.existsSync(brandLogoSrc)) {
        fs.copyFileSync(brandLogoSrc, path.join(dist, "brand-logo.png"));
      }
      const configExample = path.join(rootDir, "local.config.example.js");
      if (fs.existsSync(configExample)) {
        fs.copyFileSync(configExample, path.join(dist, "local.config.example.js"));
      }
      const localConfig = resolveLocalConfigPath();
      if (localConfig) {
        fs.copyFileSync(localConfig, path.join(dist, "local.config.js"));
      }
    },
  };
}

export default defineConfig({
  root: rootDir,
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    assetsDir: "assets",
  },
  resolve: {
    alias: {
      "@tv/xtream-core": path.resolve(rootDir, "../../packages/xtream-core/src/index.ts"),
    },
  },
  plugins: [copyTizenAssets()],
});
