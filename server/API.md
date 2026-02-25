# Thai Budget API Documentation

## Overview

The Thai Budget API provides access to Thai government budget data across fiscal years 2565-2569 B.E. The API uses a star schema design where budget data is organized by dimensions (Ministry, Budgetary Unit, Budget Plan, Output, Project, and Category) with support for hierarchical category filtering.

## Base URL

```
http://localhost:4000
```

## Endpoints

### Health Check

#### `GET /health`

Performs a database connectivity check.

**Response (200 OK):**
```json
{
  "ok": true,
  "db": 1
}
```

**Response (500 Internal Server Error):**
```json
{
  "ok": false,
  "error": "Connection failed"
}
```

---

### Budget Breakdown

#### `GET /api/breakdown`

Returns aggregated budget data grouped by a specified dimension, with optional filtering capabilities.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year` | integer | Yes | Fiscal year (2565-2569) |
| `group` | string | Yes | Grouping dimension: `ministry`, `budgetary_unit`, `budget_plan`, `output`, `project`, or `category` |
| `filterMinistryId` | integer | No | Filter by ministry ID |
| `filterBudgetaryUnitId` | integer | No | Filter by budgetary unit ID |
| `filterBudgetPlanId` | integer | No | Filter by budget plan ID |
| `filterOutputId` | integer | No | Filter by output ID |
| `filterProjectId` | integer | No | Filter by project ID |
| `filterCategoryId` | integer | No | Filter by category ID (includes all descendants in hierarchy) |

**Response (200 OK):**
```json
{
  "year": 2569,
  "group": "ministry",
  "total": 3784000000000.00,
  "rows": [
    {
      "id": 1,
      "name": "Ministry of Finance",
      "total_amount": "397800000000.00",
      "pct": 0.10515
    },
    {
      "id": 2,
      "name": "Ministry of Education",
      "total_amount": "756000000000.00",
      "pct": 0.19989
    }
  ]
}
```

**Response Field Descriptions:**

- `year`: The requested fiscal year
- `group`: The grouping dimension used
- `total`: Total amount across all rows (baht)
- `rows`: Array of grouped results containing:
  - `id`: Dimension identifier
  - `name`: Dimension name (or `level` for category group)
  - `total_amount`: Sum of budget amounts (as string decimal)
  - `pct`: Percentage of total (as decimal, 0-1)

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "year is required"
}
```

```json
{
  "error": "unsupported group"
}
```

```json
{
  "error": "filterMinistryId must be an integer"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Database query failed"
}
```

---

## Usage Examples

### Get all ministries for fiscal year 2569

```bash
curl "http://localhost:4000/api/breakdown?year=2569&group=ministry"
```

### Get budgetary units under Ministry of Finance (ID: 1)

```bash
curl "http://localhost:4000/api/breakdown?year=2569&group=budgetary_unit&filterMinistryId=1"
```

### Get budget categories under a specific budgetary unit

```bash
curl "http://localhost:4000/api/breakdown?year=2569&group=category&filterBudgetaryUnitId=5"
```

### Get budget plans with hierarchical category filtering (ID: 10)

```bash
curl "http://localhost:4000/api/breakdown?year=2569&group=budget_plan&filterCategoryId=10"
```

### Get outputs for a specific project and budget plan

```bash
curl "http://localhost:4000/api/breakdown?year=2569&group=output&filterProjectId=3&filterBudgetPlanId=2"
```

---

## Data Dimensions

### Ministry
Top-level organizational dimension representing Thai government ministries.

**Example values:**
- Ministry of Finance
- Ministry of Education
- Ministry of Defense
- etc.

### Budgetary Unit
Sub-categories within each Ministry (e.g., departments, agencies).

**Relationship:** Many budgetary units belong to one ministry.

### Budget Plan
Classification of budget allocations (e.g., annual plan, special plan, contingency).

### Output
Deliverables or services produced by the budgetary unit.

### Project
Specific initiatives or programs within outputs.

### Category
Hierarchical classification of budget items (up to 6 levels):
- Level 1: Main category
- Level 2-6: Sub-categories

**Hierarchy Filtering:** When using `filterCategoryId`, the API returns all budget items in that category and its descendants (full subtree).

---

## Fiscal Years Supported

- 2565 B.E. (Buddhist Era) = 2022 C.E.
- 2566 B.E. = 2023 C.E.
- 2567 B.E. = 2024 C.E.
- 2568 B.E. = 2025 C.E.
- 2569 B.E. = 2026 C.E.

---

## Notes

- All monetary amounts are in Thai Baht (฿)
- Percentages (`pct`) are returned as decimals (0-1). Multiply by 100 for percentage display.
- Query results are ordered by `total_amount` in descending order
- Multiple filters can be combined in a single request (AND logic)
- The API uses connection pooling and parameterized queries for security and performance
- CORS is enabled for cross-origin requests
