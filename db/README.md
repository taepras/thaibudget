# Database

## Schema
The schema is in schema.sql and is applied automatically when using Docker Compose.

## Manual apply

```bash
psql postgresql://postgres:postgres@localhost:5432/thaibudget -f db/schema.sql
```
