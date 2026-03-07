-- Migration: Convert budgetary units to hierarchical structure like categories
-- This merges dim_ministry and dim_budgetary_unit into a single hierarchical table

begin;

-- Create new hierarchical budgetary_unit table (temporary name)
create table dim_budgetary_unit_new (
  id bigserial primary key,
  name text not null,
  parent_id bigint references dim_budgetary_unit_new(id),
  level smallint not null,
  unique (name, parent_id, level)
);

-- Create closure table for budgetary unit paths
create table dim_budgetary_unit_path (
  ancestor_id bigint not null references dim_budgetary_unit_new(id),
  descendant_id bigint not null references dim_budgetary_unit_new(id),
  depth smallint not null,
  primary key (ancestor_id, descendant_id)
);

-- Migrate ministries as level 1 (parent_id = null)
insert into dim_budgetary_unit_new (id, name, parent_id, level)
select id, name, null, 1
from dim_ministry
order by id;

-- Create a mapping of old ministry IDs to new budgetary_unit IDs (they're the same)
-- Then migrate budgetary units as level 2, with ministry as parent
insert into dim_budgetary_unit_new (id, name, parent_id, level)
select 
  bu.id + (select max(id) from dim_ministry), -- Offset IDs to avoid collision
  bu.name,
  bu.ministry_id, -- parent_id points to the ministry (now in dim_budgetary_unit_new)
  2
from dim_budgetary_unit bu
order by bu.id;

-- Build closure table paths
-- Self-references (depth 0)
insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth)
select id, id, 0
from dim_budgetary_unit_new;

-- Direct parent-child relationships (depth 1)
insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth)
select parent_id, id, 1
from dim_budgetary_unit_new
where parent_id is not null;

-- Update fact_budget_item references
-- Map old budgetary_unit IDs to new IDs (with offset)
alter table fact_budget_item add column budgetary_unit_id_new bigint;

update fact_budget_item
set budgetary_unit_id_new = budgetary_unit_id + (select max(id) from dim_ministry)
where budgetary_unit_id is not null;

-- Drop old foreign key constraint
alter table fact_budget_item drop constraint if exists fact_budget_item_budgetary_unit_id_fkey;

-- Drop old tables
drop table dim_budgetary_unit cascade;
drop table dim_ministry cascade;

-- Rename new table to final name
alter table dim_budgetary_unit_new rename to dim_budgetary_unit;

-- Rename the ID sequence
alter sequence dim_budgetary_unit_new_id_seq rename to dim_budgetary_unit_id_seq;

-- Update fact_budget_item to use new column
alter table fact_budget_item drop column budgetary_unit_id;
alter table fact_budget_item rename column budgetary_unit_id_new to budgetary_unit_id;

-- Add foreign key constraint
alter table fact_budget_item 
  add constraint fact_budget_item_budgetary_unit_id_fkey 
  foreign key (budgetary_unit_id) references dim_budgetary_unit(id);

-- Create indexes
create index idx_bupath_ancestor on dim_budgetary_unit_path (ancestor_id);
create index idx_bupath_descendant on dim_budgetary_unit_path (descendant_id);

commit;

-- Verify migration
select 
  'Ministries (level 1)' as category,
  count(*) as count
from dim_budgetary_unit
where level = 1
union all
select 
  'Budgetary Units (level 2)' as category,
  count(*) as count
from dim_budgetary_unit
where level = 2
union all
select 
  'Path entries' as category,
  count(*) as count
from dim_budgetary_unit_path;
