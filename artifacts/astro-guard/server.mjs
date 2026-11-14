import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "dist/public",
);
const port = Number(process.env.PORT);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("A valid PORT environment variable is required.");
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function findFile(path) {
  try {
    return (await stat(path)).isFile() ? path : undefined;
  } catch {
    return undefined;
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const candidate = resolve(publicDir, `.${pathname}`);
  if (candidate !== publicDir && !candidate.startsWith(`${publicDir}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  const filePath =
    (await findFile(candidate)) ?? (await findFile(resolve(publicDir, "index.html")));

  if (!filePath) {
    response.writeHead(404).end("Build output not found");
    return;
  }

  const fileInfo = await stat(filePath);
  response.writeHead(200, {
    "Cache-Control": filePath.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=300",
    "Content-Length": fileInfo.size,
    "Content-Type":
      contentTypes[extname(filePath).toLowerCase()] ??
      "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`AstroVita web server listening on port ${port}\n`);
});
