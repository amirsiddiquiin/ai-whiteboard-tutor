# Chalk — AI Whiteboard Tutor

Chalk turns an educational topic into a short, AI-generated lesson designed for synchronized narration and an interactive whiteboard. It is being built for the Braynix Studios AI-Powered Interactive Whiteboard Tutor assignment.

## Current capabilities

- Responsive, accessible chat-first topic experience
- Real server-side Gemini lesson generation through the official `@google/genai` SDK
- Structured output constrained by a JSON Schema derived from the runtime Zod schema
- One bounded repair attempt for malformed or semantically invalid model output
- Typed narration cues and allowlisted whiteboard commands
- Semantic validation for IDs, action ordering, element references, word count, and duration
- Stale-response protection, duplicate-submit prevention, retryable errors, and validated client storage
- Responsive SVG whiteboard rendering for every allowlisted drawing command
- Deterministic timeline reconstruction at any playback position
- Play, pause, resume, seek, restart, replay, keyboard controls, and current cue text
- Real Gemini lesson data connected directly to the interactive lesson player
- Unit, component, service, and API route tests with a mocked provider

Phase 3 uses a deterministic visual playback clock. Phase 4 will synthesize narration and make real audio time the playback source of truth.

## Stack

- Next.js App Router, React, strict TypeScript, and Tailwind CSS
- Official Google Gen AI SDK with Gemini structured output
- Zod for API, model-output, and client-response validation
- Zustand for lesson-generation state
- Vitest and React Testing Library

## Setup

Requirements: Node.js 20.9 or later and a Gemini API key from Google AI Studio.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set the following in `.env.local`:

```dotenv
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.5-flash-lite
PROVIDER_TIMEOUT_MS=30000
```

`GEMINI_API_KEY` is read only by server modules. Do not prefix it with `NEXT_PUBLIC_`, expose it in client code, or commit `.env.local`.

Open [http://localhost:3000](http://localhost:3000), enter a topic, and select **Create my lesson**.

## Lesson generation flow

1. The browser validates and normalizes the topic.
2. `POST /api/lessons` validates the request again on the server.
3. Gemini receives a dedicated visual-teaching system prompt and a strict JSON response schema.
4. Zod validates the returned structure.
5. Semantic validation checks IDs, action references, action order, narration length, and estimated duration.
6. One repair request is allowed when model output is invalid; a second invalid result becomes `INVALID_LESSON`.
7. The server adds the UUID, normalized topic, computed segment narration, total duration, word count, and timing metadata.
8. The browser validates the response again before storing or displaying it.

## Lesson and whiteboard contract

Lessons contain 3–7 ordered segments. Each segment contains short narration cues with estimated duration and ordered whiteboard actions. The cues collectively form the segment’s coherent narration passage.

The drawing surface uses normalized `1000 × 600` coordinates. Supported commands are:

- `CREATE_TEXT`
- `CREATE_RECTANGLE`
- `CREATE_CIRCLE`
- `CREATE_LINE`
- `CREATE_ARROW`
- `CREATE_ARRAY`
- `CREATE_EQUATION`
- `HIGHLIGHT_ELEMENT`
- `UPDATE_ELEMENT`
- `REMOVE_ELEMENT`
- `CLEAR_WHITEBOARD`

Created elements use stable IDs. Reference actions are rejected unless their target already exists. Array cells may use an ID such as `values:3`. Generated JavaScript, HTML, SVG source, unknown operations, and unrestricted update properties are rejected.

## API

### `POST /api/lessons`

Request:

```json
{ "topic": "How binary search works" }
```

Successful response, abbreviated:

```json
{
  "lesson": {
    "id": "7e130a2d-0c88-46b5-a540-c8a48710e112",
    "topic": "How binary search works",
    "title": "Binary Search: Halving the Search Space",
    "learningObjective": "Trace binary search and explain why sorted input matters.",
    "estimatedDurationSeconds": 112,
    "segments": [
      {
        "id": "segment-search-space",
        "title": "The sorted search space",
        "narration": "Imagine these values arranged from smallest to largest...",
        "estimatedDurationSeconds": 24,
        "cues": [
          {
            "id": "cue-show-array",
            "narration": "Imagine these values arranged from smallest to largest.",
            "estimatedDurationSeconds": 8,
            "actions": [
              {
                "actionId": "action-show-array",
                "order": 0,
                "type": "CREATE_ARRAY",
                "elementId": "values",
                "properties": {
                  "x": 120,
                  "y": 250,
                  "width": 760,
                  "values": ["2", "5", "8", "12", "16", "23", "38"],
                  "color": "blue"
                }
              }
            ]
          }
        ]
      }
    ],
    "metadata": {
      "wordCount": 268,
      "timing": "estimated"
    }
  }
}
```

Errors use one consistent shape:

```json
{
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "Lesson generation took too long. Please retry.",
    "retryable": true,
    "requestId": "uuid"
  }
}
```

Status mappings:

- `400 INVALID_REQUEST` or `INVALID_TOPIC`
- `422 INVALID_LESSON`
- `429 RATE_LIMITED`
- `502 AI_PROVIDER_ERROR`
- `503 CONFIGURATION_ERROR`
- `504 PROVIDER_TIMEOUT`

## Verification

Automated checks use a mocked Gemini requester and never consume provider quota:

```bash
npm run check
```

To verify the real integration manually:

1. Add a valid `GEMINI_API_KEY` to `.env.local`.
2. Start the app with `npm run dev`.
3. Generate “How binary search works.”
4. Confirm the response contains a unique lesson ID, roughly two minutes of narration, 3–7 segments, and meaningful visual actions.
5. Generate an unrelated topic and confirm the result is genuinely different.
6. Temporarily use an invalid key and confirm the UI shows a retryable provider error without exposing provider details.

Do not treat the mocked tests as proof that the configured Gemini account works. Real-provider verification must be recorded separately.

## Known limitations

- Durations are estimates until Phase 4 measures generated audio.
- Phase 3 intentionally has no synthesized audio; playback currently drives the visual timeline only.
- Gemini may require one repair request, increasing latency and cost.
- Rate limiting currently relies on provider/project quotas; deployment-level abuse controls remain a release task.
- Follow-up AI chat is implemented in Phase 5.

See [docs/architecture.md](docs/architecture.md) for detailed module and API boundaries.
