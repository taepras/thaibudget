import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerHealthRoute } from "./routes/health.js";
import { registerDimensionsRoute } from "./routes/dimensions.js";
import { registerBreakdownRoute } from "./routes/breakdown.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

registerHealthRoute(app);
registerDimensionsRoute(app);
registerBreakdownRoute(app);

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
