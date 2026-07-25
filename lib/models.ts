/**
 * The models the game runs on.
 *
 * Ids are in the `provider/model` form that both Cloudflare AI Gateway and
 * OpenRouter accept, so the same string works whether the request goes through
 * the server-side gateway or a player's own OpenRouter key.
 *
 * This file deliberately has no imports: the Worker needs it, and everything
 * else in lib/llm.ts drags in the OpenAI client and browser storage.
 *
 * Two tiers, because the engine asks for one or the other per prompt (see
 * `model: "flash"` in classes.ts). "Flash" is the workhorse — most turns are a
 * character deciding what to say, and the game is written and playtested
 * against a Haiku-class model. "Pro" is for the prompts where a bad answer
 * derails the story.
 */

/** Cheap and fast; what most of the game runs on. */
export const DEFAULT_FLASH_MODEL = "anthropic/claude-haiku-4-5";

/** For the prompts worth paying more for. */
export const DEFAULT_PRO_MODEL = "anthropic/claude-sonnet-5";

/**
 * What a prompt gets when it doesn't ask for a tier — which is most of them,
 * including every character response.
 *
 * Left on the pro tier because that's what it has always been, not because
 * it's been measured. The intake cassette is recorded from a Haiku-class model
 * and passes, so the character prompts do work a tier down; switching this to
 * DEFAULT_FLASH_MODEL is a cost/quality call worth making deliberately.
 */
export const DEFAULT_MODEL = DEFAULT_PRO_MODEL;
