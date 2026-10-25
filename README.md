# DriverHub Ug

DriverHub Ug has a React/Vite frontend, a Node.js API, and a MongoDB database connection
in separate folders:

- `frontend/` — React application, static assets, and Vite entry point.
- `backend/` — HTTP API and application routes.
- `connection/` — MongoDB connection and shared data access.

## Run locally

Use Node.js 24 or newer and have MongoDB running locally, then configure and start both
services:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The defaults in `.env.example` connect to local MongoDB at
`mongodb://127.0.0.1:27017` and store app data in the `driverhub_ug` database. For MongoDB
Atlas or another server, set `MONGODB_URI` in `.env` to its connection string. Keep `.env`
private and out of version control.

If you already have data in `data/driverhub.sqlite`, run `npm run migrate:mongodb` before
the first `npm run dev`. The migration copies current state, credentials, and the demo
reset baseline into MongoDB; it leaves SQLite unchanged and will not overwrite an existing
MongoDB hub record.

Open the URL printed by Vite (normally `http://localhost:5173`). The frontend proxies
`/api` requests to the backend at `http://127.0.0.1:3001`. The first run initializes the
MongoDB database with the demo accounts and listings.

## Deploy to Vercel

Import the repository into Vercel and use the included `vercel.json` configuration. It
builds the Vite app into `dist`, serves `/api/*` through the serverless function in
`api/[...path].js`, and rewrites frontend routes to the app entry point.

In Vercel **Project Settings → Environment Variables**, add:

- `MONGODB_URI` — a MongoDB Atlas connection string reachable from Vercel.
- `MONGODB_DB` — the database name, for example `driverhub_ug`.

Allow the Vercel deployment to connect in the Atlas Network Access settings, then
redeploy after setting the variables. Vercel cannot connect to MongoDB on your computer
at `127.0.0.1`.

The production database must be initialized before registration. To copy an existing
local SQLite database to Atlas, set `MONGODB_URI` and `MONGODB_DB` to the Atlas values in
your local PowerShell session and run `npm run migrate:mongodb`. The migration is
one-time, will not overwrite an existing hub in that MongoDB database, and leaves the
SQLite file unchanged. Do not enable demo mode in production.

Demo accounts use the password `demo`:

- `owner@driverhub.ug` — car owner
- `driver@driverhub.ug` — listed driver
- `hassan@driverhub.ug` — driver awaiting application review
- `hub@driverhub.ug` — hub administrator

`npm run dev:api` and `npm run dev:frontend` can also be used to run either service
separately. Demo bootstrap and reset are enabled
only by the development commands and are disabled when `NODE_ENV=production`.

New owner and driver registrations are stored in MongoDB and wait for administrator
approval before member services are available. Existing accounts migrated from SQLite
remain approved. The admin dashboard can review registrations, driver applications,
Mobile Money payment claims, and hire requests, and records those actions in the hub.

Before drivers can submit an access-fee payment, an administrator must configure the
Airtel Uganda Money and MTN Uganda MoMo receiving numbers under **Payment numbers** in
the admin dashboard. Drivers pay using their Mobile Money app and submit the payer number
and transaction reference. The claim remains pending until an administrator verifies it
against the provider statement. This is manual verification; the app does not initiate
payments or claim automatic confirmation from a Mobile Money provider.

Password reset links expire after 30 minutes and can be used once. Configure the SMTP
settings in `.env.example` to send reset emails. In development without SMTP, the reset
link is shown on screen instead. Environment secrets belong in an untracked `.env` file
or a deployment secret store, never in source control.

Before production, provision the initial administrator using a controlled deployment
process; the demo bootstrap endpoint cannot initialize a production database. Also
configure rate limiting, HTTPS, and production-grade secrets management.
