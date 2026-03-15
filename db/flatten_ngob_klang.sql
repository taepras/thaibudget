-- Make งบกลาง one-tier: remove the redundant level-2 "งบกลาง" budgetary unit
-- and point all fact rows directly at the level-1 ministry entry.
--
-- dim_budgetary_unit:
--   id=1  name='งบกลาง' level=1  parent_id=NULL  (ministry — keep)
--   id=34 name='งบกลาง' level=2  parent_id=1     (budgetary unit — remove)

begin;

-- 1. Re-point all fact rows that belong to the level-2 entry to the level-1 ministry.
update fact_budget_item
set budgetary_unit_id = 1
where budgetary_unit_id = 34;

-- 2. Remove closure-table rows for the level-2 entry.
delete from dim_budgetary_unit_path
where ancestor_id = 34 or descendant_id = 34;

-- 3. Remove the level-2 budgetary unit row itself.
delete from dim_budgetary_unit where id = 34;

commit;
