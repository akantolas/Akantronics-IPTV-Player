import { copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dirname, "..");
const distDir = resolve(appDir, "dist");
const tizen = "C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat";

const result = spawnSync(tizen, ["package", "-t", "wgt", "-s", "Akantronics", "--", distDir], {
  cwd: appDir,
  shell: true,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

copyFileSync(resolve(distDir, "Akantronics IPTV.wgt"), resolve(distDir, "AkantronicsIPTV.wgt"));
console.log("Created dist/AkantronicsIPTV.wgt");
