# Thai Budget API

## Prereqs
- Node.js 18+
- PostgreSQL (or Docker)

## Quick start
1) Start database

```bash
cd ..
docker compose up -d
```

2) Install deps

```bash
cd server
npm install
```

3) Configure env

```bash
cp .env.example .env
```

4) Run API

```bash
npm run dev
```

## Import data

```bash
cd server
npm install
npm run import -- --file ../public/data-all-years.csv --reset
```

## Breakdown endpoint

> Note: The dataset uses B.E. years (2565-2569). Use those values in queries.

```bash
curl "http://localhost:4000/api/breakdown?year=2569&group=ministry"
curl "http://localhost:4000/api/breakdown?year=2569&group=budget_plan&filterMinistryId=1"
```

## Health check

```bash
curl http://localhost:4000/health
```
