import { query } from "../db.js";

export function registerDimensionsRoute(app) {
  app.get("/api/dimensions", async (req, res) => {
    try {
      const [budgetaryUnitsResult, categoriesResult] = await Promise.all([
        query(`
          select bu.id, bu.name, 1 as level
          from dim_budgetary_unit bu
          where bu.level = 1
          order by bu.name
        `),
        query(`
          select c.id, c.name
          from dim_category c
          where c.level = 1
          order by c.name
        `),
      ]);

      const obligedTypes = [
        { id: "false", name: "งบไม่ผูกพัน" },
        { id: "new", name: "งบผูกพัน (เริ่มต้นปีนี้)" },
        { id: "carry", name: "งบผูกพัน (จากปีก่อนๆ)" },
      ];

      return res.json({
        budgetary_unit: budgetaryUnitsResult.rows,
        category: categoriesResult.rows,
        obliged: obligedTypes,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
}
