# Providers & routing

Model catalogs and prices change weekly. **Never rely on a remembered endpoint ID, parameter name, or price** — look them up live every session, then quote from what you fetched.

## Routing order

1. **fal.ai — default.** Most reliable, live per-model schema + price, one key. Use unless a rule below applies.
2. **WaveSpeed — fallback / wider catalog.** Use when the needed model isn't on fal, when fal fails twice for a job, or when its quote is meaningfully cheaper (> 25%).
3. **Kie.ai — cheapest, least reliable.** Use only when the user asks to minimize cost, or for large low-stakes `explore` batches. Expect occasional failures; never use it for time-sensitive work.

A fallback that changes price or model must be re-quoted before submitting (SKILL.md rule 1).

## fal.ai

- Key: `FAL_KEY` env var. Auth header: `Authorization: Key $FAL_KEY`.
- Find a model: browse https://fal.ai/explore or the index at https://fal.ai/llms.txt.
- **Before every call**, fetch `https://fal.ai/models/<endpoint-id>/llms.txt` — it gives the current input/output schema, defaults, constraints, and pricing. Quote from this.
- Submit: `POST https://queue.fal.run/<endpoint-id>` with JSON body per the schema. The response includes the request ID plus status and result URLs.
- Poll the status URL until `COMPLETED` (states: `IN_QUEUE` → `IN_PROGRESS` → `COMPLETED`), then GET the result URL and download every output file right away.
- Local reference images: follow the model's `llms.txt` for how images are passed (URL vs. data URI); for large files use fal's file upload (https://fal.ai/docs/documentation/model-apis/fal-cdn).
- No charge for server errors or queue time; billing is per output from prepaid credit.

```bash
# Pattern only — fill <endpoint-id> and body from the model's llms.txt
curl -s -X POST "https://queue.fal.run/<endpoint-id>" \
  -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
  -d @generations/tmp/request.json
```

## WaveSpeed

- Key: `WAVESPEED_API_KEY` env var.
- Docs: https://wavespeed.ai/docs · pricing: https://wavespeed.ai/pricing · catalog: https://wavespeed.ai/models
- Preferred integration: the official MCP server (`npx -y @wavespeed/mcp`), which offers catalog search, per-model schema, and **price quotes before spending**. Installing it changes the user's Claude Code config — ask first.
- Without MCP: follow the REST quick-start in the docs; confirm endpoint and auth from the docs at first use.

## Kie.ai

- Key: `KIE_API_KEY` env var.
- Docs index: https://docs.kie.ai/llms.txt · start with "Getting Started with KIE API".
- APIs differ per model family and often use callbacks/task polling. Read that model's page for endpoint, auth, and polling before the first call.

## Verified notes

Append a dated line here after the first successful call through each provider (endpoint pattern, auth, polling quirks). No keys, no prices.

- _(empty)_
