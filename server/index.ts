import { createServer } from "node:http";
import { parse } from "node:url";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir, process.env.NODE_ENV !== "production");

async function main() {
  // Imported after loadEnvConfig so Next picks up .env* files, and after
  // module resolution is set up so this file can stay CommonJS-friendly
  // under tsx without a top-level await ordering problem.
  const next = (await import("next")).default;
  const { attachSocketServer } = await import("./socket/index");
  const { sweepExpiredRooms } = await import("@/lib/rooms/store");

  const dev = process.env.NODE_ENV !== "production";
  const port = Number(process.env.PORT ?? 3000);

  const app = next({ dev, dir: projectDir });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  attachSocketServer(httpServer);

  setInterval(() => {
    const removed = sweepExpiredRooms();
    if (removed.length > 0) {
      console.log(`[cleanup] expired ${removed.length} room(s): ${removed.join(", ")}`);
    }
  }, 5 * 60 * 1000);

  httpServer.listen(port, () => {
    console.log(`> Ludo Connect ready on http://localhost:${port} (${dev ? "development" : "production"})`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
