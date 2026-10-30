# Rider platform

Professional ride-hailing stack (Uber-like). **Run everything with Docker** — no local MySQL or Node required at runtime.

Location: `D:\GeoToolkit-js\rider-platform`  
(`D:\rider-platform` at drive root is not writable for a standard Windows user on this machine.)

## Services

| Service | Role | Port |
|---|---|---|
| `auth` | Register / login / JWT | 3001 |
| `ride-api` | Quotes, rides, wallet, dispatch | 3002 |
| `customer-web` | Customer Angular UI | 4200 |
| `mysql` | `auth_db` + `ride_db` | 3306 |

Auth is a **separate project**. Ride API never implements login. Both backends use **Controller → Service → DAO → Model**.

## Start

```bash
cd D:\GeoToolkit-js\rider-platform
copy .env.example .env
docker compose up --build
```

Open http://localhost:4200

1. Register a customer
2. Click the map: pickup, then dropoff
3. Confirm ride (seeded drivers around Riyadh will be assigned when nearby)

Wallet starts with **25 USD** on first wallet load. Top-up uses the wallet provider interface (no Stripe in v1).

## Layering

- **Controller** — HTTP only  
- **Service** — use-cases (hashing, JWT, fare, dispatch)  
- **DAO** — persistence only  
- **Model** — Sequelize entity  

## Next

`apps/driver-web` — driver UI against the same auth + ride-api.
