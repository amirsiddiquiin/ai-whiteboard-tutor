# Security model

This application accepts public lesson topics and validated lesson documents, then calls Gemini and a configured text-to-speech provider from server-only modules.

## Trust boundaries

- Browser input is untrusted. Every API route parses a bounded JSON body and validates it with Zod before provider access.
- Gemini and TTS responses are untrusted provider data. Structured lesson output, audio metadata, cue IDs, and cue ordering are validated before reaching the UI.
- API credentials are server-only environment variables. They must never use a `NEXT_PUBLIC_` prefix, enter browser storage, or be committed.
- Generated whiteboard actions are an allowlisted data language. The renderer does not execute provider-generated HTML, SVG, or JavaScript.

## Realistic adversaries and abuse cases

The primary threat is an opportunistic internet user attempting quota exhaustion, oversized requests, malformed payloads, or prompt-driven unsupported drawing operations. A second threat is accidental credential disclosure through source control or logs. This assignment does not store accounts, payments, health data, or other user profiles.

Controls:

- Per-instance request budgets protect the expensive lesson and narration routes from simple bursts.
- Request bodies have route-specific byte limits and fail before provider calls.
- Provider calls use explicit timeouts; Gemini only retries one transient `503` response.
- Error responses expose stable categories and request IDs, not provider messages or credentials.
- Structured operational events contain route, status, duration, outcome, and request ID only. Topics, narration, IP addresses, prompts, credentials, and audio are not logged.
- Browser responses disable MIME sniffing, framing, camera, microphone, and geolocation.

## Deployment limitations

The in-memory limiter is a bounded local safety net, not a distributed quota system. A multi-instance public deployment should add platform-level rate limiting or a shared durable limiter. Provider dashboards must also enforce spending and quota limits. Authentication is intentionally out of scope for the public assignment demo; it is required before adding saved lessons or user data.

## Incident response

If a credential is exposed, revoke it at the provider, create a replacement, update deployment secrets, and verify logs and repository history. Do not paste replacement credentials into chat, issues, logs, or commits.
