import { describe, expect, it } from "vitest";

import { requireMotionInActionSchemas, toGeminiCompatibleSchema } from "./gemini-schema";

describe("toGeminiCompatibleSchema", () => {
  it("converts literals and removes unsupported validation keywords", () => {
    expect(
      toGeminiCompatibleSchema({
        $schema: "draft",
        properties: {
          type: { const: "CREATE_TEXT" },
          id: { type: "string", pattern: "^[a-z]+$", minLength: 1, maxLength: 80 },
          order: { type: "integer", minimum: 0, maximum: 7, multipleOf: 1 },
          values: { type: "array", minItems: 2, maxItems: 12, uniqueItems: true },
        },
      }),
    ).toEqual({
      properties: {
        type: { enum: ["CREATE_TEXT"] },
        id: { type: "string" },
        order: { type: "integer" },
        values: { type: "array" },
      },
    });
  });
});

describe("requireMotionInActionSchemas", () => {
  it("requires choreography only on action-shaped schema objects", () => {
    const schema = requireMotionInActionSchemas({
      properties: {
        actions: {
          items: {
            properties: {
              actionId: { type: "string" },
              order: { type: "integer" },
              type: { enum: ["CREATE_TEXT"] },
              motion: { type: "object" },
            },
            required: ["actionId", "order", "type"],
          },
        },
      },
    }) as { properties: { actions: { items: { required: string[] } } } };

    expect(schema.properties.actions.items.required).toContain("motion");
  });
});
