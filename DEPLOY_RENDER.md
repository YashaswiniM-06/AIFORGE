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

The Blueprint uses a paid Render Starter web service with a 1 GB persistent disk because review files and audit records are stored on the server filesystem. At current listed rates, compute is about $7/month and the disk about $0.25/month, before bandwidth, taxes, or price changes; verify the [Render pricing page](https://render.com/pricing) before creating it. The disk is mounted at `/var/data`; the application writes there through `PACKPROOF_DATA_DIR`. Render's free web services have ephemeral storage and cannot attach a persistent disk.

Basic Authentication protects the entire app and API. Use a new, unique password for the hosted demo and rotate any provider keys that were pasted into chat before adding credentials to Render. Keep the judge password out of the public source repository.
