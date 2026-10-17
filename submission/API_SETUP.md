# API and subscription setup

Default additional spending: **$0**. Local checks run without an API. No paid service or billing activation has been authorized.

## Gemini

Gemini is PackSignal's primary and only implemented LLM provider. Local deterministic checks remain available when Gemini cannot respond; this is explicitly reported as local continuation, not a successful AI review. Groq is not implemented.

1. Use one Google AI Studio key from a project you control. PackSignal reads `GEMINI_API_KEY` from `.env.local` on server startup. The UI is read-only and never handles the secret.
2. Check the project's available model and free-tier quota in AI Studio. The initial configurable model is `gemini-3.8-flash`.
3. Copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`), then restart PackSignal. Never send a key in a chat or commit it.
4. AI-assisted mode is the default. Local extraction and exact checks finish first; Gemini then runs in the background. A review can be used while Gemini is still running. A real successful run is required before presenting AI behavior as validated.
5. If quota is exhausted, wait or inspect the project allowance. PackSignal uses a single configured key and does not rotate credentials to bypass quota.

### Request limits and recovery

PackSignal does not promise unlimited API access or keep retrying forever. Requests use conservative, bounded recovery:

- Retry only HTTP 429 and 503, with at most three attempts per request by default.
- Honor a provider `Retry-After` header or `google.rpc.RetryInfo` delay. If waiting would exceed the request's retry budget, defer AI work instead of sending another immediate request.
- Keep a process-wide cooldown across the server process. A new review cannot skip that cooldown.
- Preserve the deterministic findings and display the AI failure or deferral. Image interpretation and other unfinished AI work remain unverified.
- Send artwork pages first in groups of three, up to 12 rendered pages total. The initial batch extracts supplied facts/rules and reviews its page images; subsequent batches transcribe only their labeled pages. A full 12-page vision pass can use four provider requests, still subject to the session cap, retry budget, and Google quota. If a later batch fails, earlier proposals remain available, incomplete pages are named in the review, and partial results are not cached as complete.

Optional `.env.local` controls:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_MAX_REQUESTS_PER_SESSION` | `20` | Local ceiling on outbound attempts during one server process; retries count. |
| `GEMINI_MIN_INTERVAL_MS` | `6000` | Minimum interval between outbound attempts. Provider delays may require a longer wait. |
| `GEMINI_MAX_ATTEMPTS` | `3` | Maximum attempts for one request, within the implementation's bounded limits. |

These controls limit this app; they do not increase provider quota or guarantee free usage. The session counter is not a billing ledger and resets with the server. Check project usage before restarting or increasing a local allowance. The key is loaded from the ignored `.env.local` file at server startup and never shown in the UI. Revoke and replace any key exposed in chat or a public repository before using Gemini again.

Google AI Pro subscription benefits and Gemini API billing are related only through explicitly eligible benefits, not unlimited interchangeable usage. Current Google documentation lists certain Developer Program/Cloud credit benefits for eligible plans; eligibility and redemption must be checked on the account. Do not assume five accounts provide one pooled API allowance. Paid API setup can require prepayment. For the zero-spend path, remain on available free quota.

Free-service data terms differ from paid-service terms. Use official challenge or original fictional samples; avoid confidential commercial artwork unless your terms permit that processing.

Official sources:
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing)
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google AI plan benefits](https://support.google.com/googleone/answer/14534406?hl=en)
- [Developer Program benefits](https://developers.google.com/profile/help/benefits)

## ChatGPT Plus

There is no generic “ChatGPT Plus API key” that automatically pays for ordinary OpenAI API-key calls. Standard API-key billing is separate. Current OpenAI documentation also describes an eligible **Sign in with ChatGPT** integration for certain applications; that is an authentication/inference integration, not a key extracted from the ChatGPT website.

PackSignal currently implements Gemini only. It does not scrape ChatGPT, reuse browser tokens, or implement the separate Sign in with ChatGPT flow. Adding that flow is future work if eligibility and project needs justify it.

Official sources:
- [Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart)
- [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

## Delivered live run

A real Gemini 3.8 Flash review of the fictional Fieldday V1 files completed in one outbound attempt. It returned 19 fact proposals, 12 rule proposals and two observations. The report is in `submission/example-reports/fieldday-live-gemini-review.pdf`. This establishes that the integration worked for that input and project at that time; it is not an accuracy benchmark or a guarantee of future quota.

Local controls are bounded: 1–100 requests per session, 1,000–60,000 ms between attempts, and 1–3 attempts per request. The request budget is 120 seconds, with at most 30 seconds of cumulative retry sleep. Provider delays longer than that pause AI work. Saved results can be reused across reviews with identical files, filenames, roles, model and prompt version; the interface and audit history identify reused results.
