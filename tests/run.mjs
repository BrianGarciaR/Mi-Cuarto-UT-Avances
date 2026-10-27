import {spawn} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve, sep, basename} from "node:path";
import {setTimeout} from "node:timers/promises";

const directory = await mkdtemp(join(tmpdir(), "mcut-tests-"));
const server = spawn(process.execPath, ["server.mjs"], {
  env: {...process.env, PORT: "0", MCUT_DATA_DIR: directory},
  stdio: ["ignore", "pipe", "inherit"]
});
try {
  const origin = await new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error("El servidor de prueba no inició.")), 12000);
    server.once("error", reject);
    server.stdout.on("data", chunk => {
      const url = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {globalThis.clearTimeout(timer); resolve(url);}
    });
  });
  const tests = spawn(process.execPath, ["tests/api.mjs"], {
    env: {...process.env, MCUT_TEST_ORIGIN: origin}, stdio: "inherit"
  });
  const code = await new Promise((resolve, reject) => {tests.once("error", reject); tests.once("exit", resolve);});
  if (code !== 0) process.exitCode = code || 1;
} finally {
  server.kill();
  await new Promise(resolve => {if (server.exitCode !== null) resolve(); else server.once("exit", resolve);});
  await setTimeout(100);
  const target = resolve(directory);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("mcut-tests-"))
    throw new Error("La carpeta de prueba no pertenece al directorio temporal.");
  await rm(target, {recursive: true, force: true});
}
