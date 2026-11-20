const REMOVED_SCHEMA_KEYS = new Set([
  "$schema",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "multipleOf",
  "pattern",
  "uniqueItems",
]);

export function toGeminiCompatibleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiCompatibleSchema);
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  const target: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(source)) {
    if (REMOVED_SCHEMA_KEYS.has(key)) continue;
    if (key === "const") {
      target.enum = [child];
      continue;
    }
    target[key] = toGeminiCompatibleSchema(child);
  }

  return target;
}

export function requireMotionInActionSchemas(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(requireMotionInActionSchemas);
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  const target = Object.fromEntries(
    Object.entries(source).map(([key, child]) => [key, requireMotionInActionSchemas(child)]),
  ) as Record<string, unknown>;
  const properties = target.properties;
  if (
    typeof properties === "object" &&
    properties !== null &&
    "actionId" in properties &&
    "order" in properties &&
    "type" in properties &&
    "motion" in properties
  ) {
    const required = Array.isArray(target.required) ? target.required : [];
    target.required = [...new Set([...required, "motion"])];
  }
  return target;
}
