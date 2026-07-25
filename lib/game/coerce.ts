/**
 * Turning untrusted LLM text into game values.
 *
 * Everything the model emits arrives as strings in tag attributes and content,
 * and the model is not reliable: it invents attribute spellings, omits them,
 * and answers questions it was told not to guess at ("name: unspecified"). These
 * helpers are the boundary that keeps that mess out of the game state — they
 * always produce a usable value, warning rather than throwing, so one malformed
 * tag can never break a turn.
 */

/** Parse a tag attribute as a boolean, tolerating the spellings models use. */
export function coerceBoolean(v: string | undefined, defaultValue = false) {
  if (v === undefined) {
    return defaultValue;
  }
  v = v.toLowerCase();
  if (v === "true" || v === "yes" || v === "y" || v === "on" || v === "1") {
    return true;
  }
  if (v === "false" || v === "no" || v === "n" || v === "off" || v === "0") {
    return false;
  }
  console.warn("Unexpected boolean value:", JSON.stringify(v));
  return defaultValue;
}

/** Parse a tag attribute as a number; unparseable values become 0. */
export function coerceNumber(v: string | undefined) {
  if (v === undefined) {
    return 0;
  }
  const num = Number(v);
  if (isNaN(num)) {
    console.warn("Unexpected number value:", JSON.stringify(v));
    return 0;
  }
  return num;
}

/** Normalize typographic junk out of a raw LLM response. */
export function fixupText(llmText: string) {
  return llmText
    .replace(/…/g, "...")
    .replace(/&#x20;/g, " ")
    .trim();
}

/**
 * Should a `<set attr="...">` from the model be allowed to land?
 *
 * Guards the few properties where the model likes to write a non-answer instead
 * of omitting the tag — a profession of "unknown", or a name of "player". For
 * pronouns only the three supported sets are accepted, since anything else
 * would break the pronoun lookup downstream.
 */
export function isValidPropertySet(key: string, value: unknown) {
  if (typeof value !== "string") {
    return true;
  }
  const v = value.trim().toLowerCase();
  if (key === "pronouns") {
    return v === "he/him" || v === "she/her" || v === "they/them";
  } else if (key === "profession") {
    return v !== "unspecified" && v !== "unknown";
  } else if (key === "name") {
    return (
      v !== "unspecified" && v !== "unknown" && v !== "player" && v !== "you"
    );
  }
  return true;
}
