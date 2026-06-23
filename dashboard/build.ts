import { copyFile, mkdir, rm } from "node:fs/promises";

const outDir = "dist/dashboard";

await rm(outDir, { force: true, recursive: true });
await mkdir(`${outDir}/assets`, { recursive: true });

const result = await Bun.build({
  entrypoints: ["dashboard/src/main.tsx"],
  outdir: `${outDir}/assets`,
  target: "browser",
  format: "esm",
  minify: true,
  sourcemap: "linked",
  naming: {
    entry: "[name].[ext]",
    chunk: "[name]-[hash].[ext]",
    asset: "[name]-[hash].[ext]",
  },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await copyFile("dashboard/index.html", `${outDir}/index.html`);
await copyFile("dashboard/styles.css", `${outDir}/styles.css`);
await Bun.write(`${outDir}/.nojekyll`, "");

console.log(`Dashboard built in ${outDir}`);
