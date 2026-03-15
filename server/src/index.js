import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerHealthRoute } from "./routes/health.js";
import { registerDimensionsRoute } from "./routes/dimensions.js";
import { registerBreakdownRoute } from "./routes/breakdown.js";
import { registerSearchRoute } from "./routes/search.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// In-memory GET cache for all /api/* routes.
// Budget data is static at runtime so cached entries never expire.
const apiCache = new Map();
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const key = req.originalUrl;
  if (apiCache.has(key)) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(apiCache.get(key));
  }
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) apiCache.set(key, body);
    return originalJson(body);
  };
  next();
});

registerHealthRoute(app);
registerDimensionsRoute(app);
registerBreakdownRoute(app);
registerSearchRoute(app);

app.post('/api/cache/clear', (req, res) => {
  const size = apiCache.size;
  apiCache.clear();
  console.log(`Cache cleared (${size} entries)`);
  res.json({ cleared: size });
});

// Serve static files from React build directory
const buildPath = path.join(__dirname, "../../build");
console.log("Serving static files from:", buildPath);
app.use(express.static(buildPath));

// Fallback: serve index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
