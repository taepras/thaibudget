import { query } from "../db.js";

export function registerHealthRoute(app) {
  app.get("/health", async (req, res) => {
    try {
      const result = await query("select 1 as ok");
      res.json({ ok: true, db: result.rows[0].ok });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}
