-- Schema for budget data

create table staging_budget_raw (
  item_id text,
  ref_doc text,
  ref_page_no integer,
  ministry text,
  budgetary_unit text,
  cross_func boolean,
  budget_plan text,
  output text,
  project text,
  category_lv1 text,
  category_lv2 text,
  category_lv3 text,
  category_lv4 text,
  category_lv5 text,
  category_lv6 text,
  item_description text,
  fiscal_year integer,
  amount_text text,
  obliged boolean,
  debug_log text
);

create table dim_ministry (
  id bigserial primary key,
  name text unique
);

create table dim_budgetary_unit (
  id bigserial primary key,
  ministry_id bigint not null references dim_ministry(id),
  name text not null,
  unique (ministry_id, name)
);

create table dim_budget_plan (
  id bigserial primary key,
  name text unique
);

create table dim_output (
  id bigserial primary key,
  name text unique
);

create table dim_project (
  id bigserial primary key,
  name text unique
);

create table dim_category (
  id bigserial primary key,
  name text not null,
  parent_id bigint references dim_category(id),
  level smallint not null,
  unique (name, parent_id, level)
);

create table dim_category_path (
  ancestor_id bigint not null references dim_category(id),
  descendant_id bigint not null references dim_category(id),
  depth smallint not null,
  primary key (ancestor_id, descendant_id)
);

create table fact_budget_item (
  id bigserial primary key,
  item_id text unique,
  ref_doc text,
  ref_page_no integer,
  budgetary_unit_id bigint references dim_budgetary_unit(id),
  cross_func boolean,
  budget_plan_id bigint references dim_budget_plan(id),
  output_id bigint references dim_output(id),
  project_id bigint references dim_project(id),
  category_id bigint references dim_category(id),
  item_description text,
  fiscal_year integer not null,
  amount numeric(18,2) not null,
  obliged boolean,
  debug_log text
);

create index idx_fact_year on fact_budget_item (fiscal_year);
create index idx_fact_budgetary_unit on fact_budget_item (budgetary_unit_id);
create index idx_fact_category on fact_budget_item (category_id);
create index idx_catpath_ancestor on dim_category_path (ancestor_id);
create index idx_catpath_descendant on dim_category_path (descendant_id);
