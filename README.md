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
- Lesson title, learning objective, duration, and teaching-segment preview after generation
- Responsive SVG whiteboard rendering for every allowlisted drawing command
- Deterministic timeline reconstruction for forward and backward seeking
- Play, pause, resume, seek, restart, replay, keyboard controls, and live cue text
- Server-side Google Cloud Text-to-Speech with SSML cue marks and measured timing
- Audio-led whiteboard synchronization: the media element is the single playback clock
- Narration loading, error, retry, autoplay-failure, and cleanup states
- Unit, component, service, and API route tests with mocked provider boundaries

## Stack

- Next.js App Router, React, strict TypeScript, and Tailwind CSS
- Official Google Gen AI SDK with Gemini structured output
- Official Google Cloud Text-to-Speech client library
- Zod for API, model-output, and client-response validation
- Zustand for lesson-generation state
- Vitest and React Testing Library

## Setup

Requirements: Node.js 20.9 or later, a Gemini API key from Google AI Studio, and a Google Cloud project with Text-to-Speech enabled.

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
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your-key
ELEVENLABS_VOICE_ID=your-voice-id
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

The Gemini and TTS credentials are read only by server modules. Do not prefix credentials with `NEXT_PUBLIC_`, and never commit `.env.local`. Google TTS remains supported by selecting `TTS_PROVIDER=google` and configuring the documented Google variables in `.env.example`.

Open [http://localhost:3000](http://localhost:3000), enter a topic, and select **Create my lesson**.

The server returns synthesized MP3 bytes and cue marks for the current lesson. The browser creates a temporary object URL and revokes it when the lesson changes or the player unmounts; Phase 4 does not persist audio or credentials in browser storage.

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

### `POST /api/narration`

Accepts a validated generated lesson and returns an MP3 payload plus the measured start time for every cue. The route disables response caching and maps configuration, quota, timeout, provider, and invalid-response failures to the same safe API error shape. Provider credentials never appear in the response.

The player waits for browser audio metadata, combines the measured cue marks with the actual MP3 duration, and drives the deterministic whiteboard timeline from `HTMLAudioElement.currentTime`.

## Verification

Automated checks mock Gemini, Google TTS, and ElevenLabs provider boundaries and never consume provider quota:

```bash
npm run check
```

To verify the real integration manually:

1. Add valid Gemini and selected TTS-provider settings to `.env.local`.
2. Start the app with `npm run dev`.
3. Generate “How binary search works.”
4. Confirm the generated MP3 loads, Play starts audible narration, and the cue text and whiteboard follow the audio position.
5. Pause, resume, seek backward and forward, restart, and replay; confirm the visual state reconstructs correctly.
6. Generate an unrelated topic and confirm the lesson and narration are genuinely different.
7. Temporarily remove a TTS setting and confirm the UI shows a retry action without exposing provider details.

Do not treat the mocked tests as proof that the configured Gemini account works. Real-provider verification must be recorded separately.

## Known limitations

- Audio is generated on demand and kept only for the current browser session; there is no persistent media store yet.
- A configured ElevenLabs key and accessible voice, or a configured Google Cloud TTS project, are required for live narration.
- Gemini may require one repair request, increasing latency and cost.
- Rate limiting currently relies on provider/project quotas; deployment-level abuse controls remain a release task.
- Follow-up AI chat is implemented in Phase 5.

See [docs/architecture.md](docs/architecture.md) for detailed module and API boundaries.

Production and security decisions are documented in [docs/production-readiness.md](docs/production-readiness.md) and [docs/security.md](docs/security.md).
