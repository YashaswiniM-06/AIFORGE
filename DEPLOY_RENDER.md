# Deploy PackSignal on Render

PackSignal is a single Node web service: Node serves the UI and API, while a private Python worker parses uploaded files. Deploy it as one Render Docker web service; do not split the UI from the API.

## Before connecting GitHub

- Keep the source repository private while it is under development. The challenge accepts a packaged source submission, so the judges can receive the source ZIP separately from the live demo URL.
- Do not commit `.env.local`, `.env`, review data, uploaded files, or API keys. The repository ignores local env files and `.packproof/`; the Docker build also excludes them.
- The Render service uses HTTP Basic Authentication. Give the judges the service URL, username `judge`, and the demo password through the official submission channel.

## Create the service

1. Push the project to a private GitHub repository and connect that repository to Render.
2. In Render, choose **New → Blueprint** and select the repository. Render reads `render.yaml` and builds the Docker web service.
3. Use the service's environment settings to enter `PACKPROOF_ACCESS_PASSWORD` and `PACKPROOF_PUBLIC_ORIGIN`. Set the latter to the exact HTTPS origin Render assigned, such as `https://your-service.onrender.com`.
4. Add Gemini credentials in Render's secret environment-variable fields: `GEMINI_API_KEY` through `GEMINI_API_KEY_5`. Never put their values in GitHub, `render.yaml`, or the source ZIP. Keep the model set to `gemini-3.8-flash` only if that model is enabled for the selected Google project.
5. Wait for the `/healthz` check to pass, then open the HTTPS URL and authenticate. Upload one small sample and confirm PDF, HTML, and JSON report export before sharing the judge link.

## Hosting boundaries

The Blueprint uses a paid Render Starter web service with a 1 GB persistent disk because review files and audit records are stored on the server filesystem. The disk is mounted at `/var/data`; the application writes there through `PACKPROOF_DATA_DIR`. Render's free web services have ephemeral storage and are not suitable for this persistence setup.

Basic Authentication protects the entire app and API. Use a new, unique password for the hosted demo and rotate any provider keys that were pasted into chat before adding credentials to Render. Keep the judge password out of the public source repository.
