# Production-readiness notes

This project is a single Next.js deployment with two external integration points: Gemini lesson generation and text-to-speech synthesis. It deliberately remains a modular monolith; queues, microservices, and multi-agent orchestration would add operational cost without helping the two-minute lesson workflow.

## Implemented gates

- All inbound JSON crosses byte limits and Zod schemas.
- All Gemini and ElevenLabs HTTP calls have explicit timeouts. Google TTS relies on the provider client's deadline/error behavior and maps deadline failures into the same stable contract.
- Provider errors are categorized into configuration, invalid response, rate limit, timeout, and provider failure.
- Gemini uses one delayed retry only for a transient `503`; narration generation does not automatically retry because synthesis can consume quota and is not guaranteed to be idempotent.
- Lesson generation allows one schema-guided repair attempt, then fails closed.
- Whiteboard and playback state are deterministic pure functions with boundary tests.
- Each API response carries a request ID. Production logs contain sanitized request outcome and latency fields.
- Provider selection stays behind an adapter boundary; the lesson and player layers do not depend on Google or ElevenLabs types.

## Operational checks

Before deployment:

1. Run `npm run check`.
2. Confirm `.env.local` and provider credentials are ignored by Git.
3. Configure production secrets through the hosting platform.
4. Set provider-side spending and quota limits.
5. Perform one real lesson and narration smoke test in the deployed environment.
6. Confirm `429`, timeout, malformed JSON, oversized body, and invalid lesson responses do not expose provider details.

## Known limits

- Rate limiting is per server instance. Use a platform firewall/shared limiter for a scaled public deployment.
- Audio is generated on demand and lives only in the active browser session.
- There is no persistent audit store or distributed tracing backend yet; structured logs are the current observability boundary.
- Real-provider quality and latency remain dependent on Gemini and the selected TTS provider.
