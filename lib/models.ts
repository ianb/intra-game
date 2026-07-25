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

/**
 * What a prompt asks for, as opposed to what it gets.
 *
 * The prompt declares a tier and the deployment decides what fulfils it — a
 * player's OpenRouter selection, a Worker's gateway vars, an eval trying a pair
 * of models. Baking model ids into prompt assembly would make "can this run on
 * a small model" unanswerable without editing the game.
 */
export type ModelTier = "pro" | "flash";

export interface TierModels {
  pro?: string;
  flash?: string;
}

/**
 * The model id for a tier.
 *
 * A missing flash model falls back to the pro one rather than to a default
 * nobody chose: someone who has picked one model expects the game to use it,
 * and quietly sending a third of their turns somewhere else would be a surprise
 * they never asked for.
 */
export function modelForTier(
  tier: ModelTier | undefined,
  models: TierModels = {},
): string {
  if (tier === "flash") {
    return models.flash || models.pro || DEFAULT_FLASH_MODEL;
  }
  return models.pro || DEFAULT_PRO_MODEL;
}

/**
 * Routing prompts by tier is free where it looks expensive.
 *
 * A prefix cache is keyed by (model, exact prefix), so two prompt kinds share a
 * cache entry only if they share a prefix. Measured with `pnpm playtest:cache`:
 * a character prompt and any player-side prompt have **19 characters** in
 * common, out of thousands. They were never in the same entry, so sending the
 * player-side prompts to a small model cannot cost a character prompt a single
 * hit — the cache barrier doesn't move.
 *
 * The same measurement says which prompts are worth moving. Character prompts
 * reuse 86% of their text once the player's name is known; `player input`
 * reuses 8%, because it carries the room, who is in it, and the exits, all of
 * which change every turn. The prompts with the least to lose from a cold cache
 * are exactly the mechanical ones — which is the happy version of this
 * trade-off, and not one to assume holds after the prompts change.
 */
