import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { auth, FRONTEND_ORIGIN } from "./runtime.mjs";
import { GET as api } from "./api.mjs";
const publicDir = resolve("public"),
  port = Number(process.env.PORT || 8788);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ttf": "font/ttf",
};
const origins = new Set([
  FRONTEND_ORIGIN,
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
]);
createServer(async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS",
      );
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.method === "OPTIONS") {
      res.writeHead(origins.has(origin) ? 204 : 403);
      res.end();
      return;
    }
    const path = new URL(req.url, "http://127.0.0.1").pathname;
    if (path.startsWith("/api/")) {
      if (
        origin &&
        !origins.has(origin) &&
        !["GET", "HEAD"].includes(req.method)
      ) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Origen no permitido." }));
        return;
      }
      let chunks = [],
        size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: "Solicitud demasiado grande." }));
          return;
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks),
        headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value)
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
      for (const key of [...headers.keys()])
        if (key.startsWith("oai-")) headers.delete(key);
      const request = new Request(`http://127.0.0.1:${port}` + req.url, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method) && body.length
          ? { body }
          : {}),
      });
      const result =
        (await auth(
          request,
          req.headers["cf-connecting-ip"] ||
            req.socket.remoteAddress ||
            "local",
        )) || (await api(request));
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    const file = resolve(
      publicDir,
      "." + decodeURIComponent(path === "/" ? "/index.html" : path),
    );
    if (
      !file.startsWith(publicDir + "/") &&
      !file.startsWith(publicDir + "\\")
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw Error();
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end("No encontrado");
    }
  } catch (error) {
    console.error("Solicitud fallida:", error.message);
    if (!res.headersSent)
      res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Ocurrió un problema. Inténtalo de nuevo." }),
    );
  }
}).listen(port, "127.0.0.1", () =>
  console.log("Mi Cuarto UT listo en http://127.0.0.1:" + port),
);
