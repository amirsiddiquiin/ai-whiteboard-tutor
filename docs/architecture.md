# Architecture and API contract

## Module boundaries

- `src/app`: routes, page composition, and API entry points.
- `src/components`: presentation components and reusable UI primitives.
- `src/features`: lesson, whiteboard, chat, and later playback domain logic.
- `src/lib`: provider adapters, environment parsing, shared errors, and utilities.
- `src/tests`: global test configuration; feature tests live beside their source.

The browser never receives Gemini or Google Cloud credentials. Provider integrations execute only in server routes through infrastructure adapters.

## Lesson model

A lesson contains three to seven conceptual segments. Each segment contains narration cues. A cue is the smallest synchronization unit: its narration begins at a measured speech timepoint, and its allowlisted whiteboard actions become active at that same point.

Whiteboard coordinates use a logical `1000 × 600` surface. The SVG renderer will scale this coordinate system responsively through its `viewBox`.

Supported action types:

- `CREATE_TEXT`
- `CREATE_RECTANGLE`
- `CREATE_CIRCLE`
- `CREATE_LINE`
- `CREATE_ARROW`
- `CREATE_ARRAY`
- `CREATE_EQUATION`
- `UPDATE_ELEMENT`
- `HIGHLIGHT_ELEMENT`
- `REMOVE_ELEMENT`
- `CLEAR_WHITEBOARD`

Generated HTML, SVG, JavaScript, and unknown command types are rejected.

## Target lesson flow

1. The learner submits a topic to `POST /api/lessons`.
2. The route validates input and calls Gemini with a structured-output schema.
3. The returned lesson passes through Zod and semantic validation.
4. Structural and semantic failures receive one constrained Gemini repair attempt.
5. The server computes segment narration, total estimated duration, and word count.
6. The browser validates the complete response before storing and previewing it.
7. Phase 3 will render actions in cue and action order.
8. Phase 4 will turn cues into SSML marks and replace estimates with measured timing.
9. Follow-up questions are sent to `POST /api/chat` with bounded lesson context in Phase 5.

## `POST /api/lessons`

Request:

```json
{
  "topic": "How binary search works"
}
```

The topic is trimmed and must contain 2–160 characters.

Target success response:

```json
{
  "lesson": {
    "id": "lsn_01J...",
    "topic": "How binary search works",
    "title": "Binary Search: Halving the Search Space",
    "learningObjective": "Trace binary search and explain why sorted input matters.",
    "estimatedDurationSeconds": 112,
    "segments": [],
    "metadata": {
      "wordCount": 268,
      "timing": "estimated"
    }
  }
}
```

The route uses the official server-side `@google/genai` SDK. Gemini receives a JSON Schema derived from the same Zod schema used for runtime validation. The route never returns unvalidated model output.

Provider and validation failures map to `INVALID_LESSON`, `RATE_LIMITED`, `AI_PROVIDER_ERROR`, `CONFIGURATION_ERROR`, or `PROVIDER_TIMEOUT`. Responses are marked `Cache-Control: no-store`.

## `POST /api/chat`

Target request:

```json
{
  "lessonId": "lsn_01J...",
  "topic": "How binary search works",
  "learningObjective": "Explain why sorted input matters.",
  "currentCueId": "cue-4",
  "messages": [
    {
      "role": "user",
      "content": "Why does the input need to be sorted?"
    }
  ]
}
```

Messages are capped at 12 and 1,500 characters each. Phase 1 validates this contract and returns `503 FEATURE_NOT_READY`; the genuine contextual response is implemented in Phase 5.

## Error contract

Every expected API failure uses:

```json
{
  "error": {
    "code": "INVALID_TOPIC",
    "message": "Enter a topic between 2 and 160 characters.",
    "retryable": false,
    "requestId": "uuid"
  }
}
```

Expected codes include validation, rate-limit, provider, timeout, configuration, and invalid generated lesson failures. Internal errors and credentials are never returned.
