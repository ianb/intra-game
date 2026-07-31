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

/** Answers that mean "I don't know", not a name. */
const NON_NAMES = new Set([
  "unspecified",
  "unknown",
  "player",
  "player_name",
  "playername",
  "you",
]);

/**
 * Every spelling of the three pronoun sets the game supports.
 *
 * Only "he/him", "she/her" and "they/them" work downstream, and a model asked
 * to record what a player just said writes what the player said — "he", "he/him/his",
 * "He / Him". Those were all rejected, so a player who answered the question
 * correctly could end up recorded as they/them anyway, and the model got a
 * complaint about a tag it had every reason to think was right.
 *
 * Relaxing here rather than in the prompt: the mapping is unambiguous, and a
 * prompt long enough to enumerate the accepted spellings costs every turn of
 * the game to fix one moment of it.
 */
const PRONOUN_FORMS: Record<string, string> = {
  he: "he/him",
  him: "he/him",
  his: "he/him",
  "he/him": "he/him",
  "he/his": "he/him",
  "he/him/his": "he/him",
  she: "she/her",
  her: "she/her",
  hers: "she/her",
  "she/her": "she/her",
  "she/hers": "she/her",
  "she/her/hers": "she/her",
  they: "they/them",
  them: "they/them",
  their: "they/them",
  theirs: "they/them",
  "they/them": "they/them",
  "they/their": "they/them",
  "they/them/theirs": "they/them",
};

/** The canonical form of what the model wrote, or null if it isn't pronouns. */
export function coercePronouns(value: string): string | null {
  return PRONOUN_FORMS[value.trim().toLowerCase().replace(/\s+/g, "")] ?? null;
}

/**
 * Should a `<set attr="...">` from the model be allowed to land?
 *
 * Guards the few properties where the model likes to write a non-answer instead
 * of omitting the tag — a profession of "unknown", or a name of "PLAYER". For
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
    // `v` is already lowercased, so these catch the markers the prompts use for
    // the player as well as their literal forms. A model that hasn't learned
    // the name yet will sometimes answer with the placeholder instead of
    // omitting the tag, and that must never land in game state.
    return !NON_NAMES.has(v);
  }
  return true;
}
