# Deploy PackSignal on Render

PackSignal is a single Node web service: Node serves the UI and API, while a private Python worker parses uploaded files. Deploy it as one Render Docker web service; do not split the UI from the API.

## Before connecting GitHub

- Keep the source repository private while it is under development. The challenge accepts a packaged source submission, so the judges can receive the source ZIP separately from the live demo URL.
- Do not commit `.env.local`, `.env`, review data, uploaded files, or API keys. The repository ignores local env files and `.packproof/`; the Docker build also excludes them.
- The Render service uses HTTP Basic Authentication. Give the judges the service URL, username `judge`, and the demo password through the official submission channel.

## Live Deployment

- **Service URL:** [https://packsignal.onrender.com](https://packsignal.onrender.com)
- **Dashboard:** [https://dashboard.render.com/web/srv-db9dsmnbtjjs73bbpb40](https://dashboard.render.com/web/srv-db9dsmnbtjjs73bbpb40)
- **Healthcheck:** `/healthz` (200 OK)
- **Environment:** Docker runtime on Node 24 + Python 3 virtualenv
- **AI Cluster:** 5-key Gemini failover pool active (`GEMINI_API_KEY` through `GEMINI_API_KEY_5`)
- **Origin & CORS:** Automatically configured for `https://packsignal.onrender.com`

## How it was deployed

1. The project was linked to `https://github.com/vamshichethan/AIFORGE` on the `main` branch.
2. Render built the Docker container using `Dockerfile`, installing system prepress libraries and Python dependencies (`pypdfium2`, `openpyxl`, `reportlab`, `pillow`, `python-docx`).
3. Server environment variables were provisioned via the Render API, keeping all keys isolated and secret on the server.
4. Mutation tokens and same-origin protections bind automatically to the assigned Render subdomain.

## Hosting boundaries

**Live deployment check, 2026-10-18:** the Render dashboard shows this service on the Free plan. Its Disk page says disks are not supported on free compute. The `/var/data` path is therefore not a persistent disk on the current live instance, so review files and records may disappear when Render spins the service down, restarts it, or redeploys it. Do not treat the current hosted workspace as durable storage.

The Blueprint requests a paid Render Starter web service with a 1 GB persistent disk because review files and audit records are stored on the server filesystem. The live service must be moved to a disk-supported plan and the disk attached before hosted review data can be treated as durable. Verify the [Render pricing page](https://render.com/pricing) before changing plans. When attached, the disk should be mounted at `/var/data`, which the application uses through `PACKPROOF_DATA_DIR`.

The live dashboard also says this Free instance spins down with inactivity and may delay requests by 50 seconds or more. Render's [free web service documentation](https://render.com/docs/free#spinning-down-on-idle) describes the idle sleep and startup delay. Application code cannot remove that infrastructure delay.

Render's **“service is starting” loading page** appears before this application can respond. [Render documents](https://render.com/docs/free#spinning-down-on-idle) that Free web services sleep after 15 idle minutes and take about a minute to start again. Application animation, compression, or loading-screen changes cannot remove that infrastructure delay. An always-on paid service removes the free-tier idle sleep; changing the plan is a separate hosting/billing decision.

The app serves Brotli/gzip-compressed UI assets, preloads its JavaScript modules, and uses private browser caching with ETag revalidation. Unchanged assets return `304`; changed files are fetched on the next visit so a deployment appears without clearing the browser cache. Review APIs, uploaded documents, and generated reports retain `no-store` responses.

Basic Authentication protects the entire app and API. Use a new, unique password for the hosted demo and rotate any provider keys that were pasted into chat before adding credentials to Render. Keep the judge password out of the public source repository.
