import { SignalType } from "@/lib/persistentsignal";
import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import sortBy from "just-sort-by";
import { useEffect } from "react";

type RatingType = "error" | "bad" | "ok" | "good" | "great" | "unknown";

const RATING_ORDER: RatingType[] = ["unknown", "great", "good", "ok"];

const RATING_TITLES: Record<RatingType, string> = {
  great: "Great models!",
  good: "good models",
  ok: "ok, maybe",
  bad: "bad doesn't work",
  error: "error doesn't try to work",
  unknown: "Unknown, hasn't been tried",
};

const RATINGS: Record<string, RatingType> = {
  /* FREE OPTIONS */

  "google/gemini-flash-1.5-exp": "error",
  "google/gemini-flash-1.5-8b-exp": "error",
  "google/gemini-pro-1.5-exp": "error",
  // Doesn't error, but it's only for vision and doesn't respond:
  "meta-llama/llama-3.2-11b-vision-instruct:free": "error",
  "gryphe/mythomist-7b:free": "error",
  "undi95/toppy-m-7b:free": "error",

  "huggingfaceh4/zephyr-7b-beta:free": "bad",
  "meta-llama/llama-3.2-1b-instruct:free": "bad",
  // It kind of works, but isn't good, and is very slow:
  "nousresearch/hermes-3-llama-3.1-405b:free": "bad",
  "microsoft/phi-3-medium-128k-instruct:free": "bad",

  "liquid/lfm-40b:free": "ok",
  "meta-llama/llama-3-8b-instruct:free": "ok",
  "meta-llama/llama-3.1-8b-instruct:free": "ok",
  "meta-llama/llama-3.2-3b-instruct:free": "ok",
  // Maybe this is actually "bad":
  "gryphe/mythomax-l2-13b:free": "ok",

  // Not sure if this is "good":
  "meta-llama/llama-3.1-405b-instruct:free": "good",
  // This one kind of seems better?
  "meta-llama/llama-3.1-70b-instruct:free": "good",
  "mistralai/mistral-7b-instruct:free": "good",
  "openchat/openchat-7b:free": "good",
  // Is it good or just ok?
  "microsoft/phi-3-mini-128k-instruct:free": "good",
  // Ditto...
  "qwen/qwen-2-7b-instruct:free": "good",
  "google/gemma-2-9b-it:free": "good",

  /* PAID OPTIONS */
  // It's okay, but not at this price...
  "ai21/jamba-1-5-large": "ok",
  "ai21/jamba-1-5-mini": "bad",
  "ai21/jamba-instruct": "bad",
  "jondurbin/airoboros-l2-70b": "ok",
  "anthropic/claude-3-haiku": "ok",
  // A bunch of models that are old and not worth listing:
  "anthropic/claude-3-haiku:beta": "bad",
  "anthropic/claude-3-opus": "error",
  "anthropic/claude-3-opus:beta": "error",
  // No reason to use these over 3.5 sonnet:
  "anthropic/claude-3-sonnet": "bad",
  "anthropic/claude-3-sonnet:beta": "bad",
  "anthropic/claude-3.5-sonnet": "great",
  // I don't want to show dated betas...
  "anthropic/claude-3.5-sonnet-20240620": "bad",
  "anthropic/claude-3.5-sonnet-20240620:beta": "bad",
  // Just an unmoderated version, which I'm skipping
  "anthropic/claude-3.5-sonnet:beta": "bad",
  // Out of date:
  "anthropic/claude-instant-1": "bad",
  "anthropic/claude-instant-1:beta": "bad",
  "anthropic/claude-instant-1.0": "bad",
  "anthropic/claude-instant-1.1": "good",
  "anthropic/claude-1": "bad",
  "anthropic/claude-1.2": "bad",
  "anthropic/claude-2": "bad",
  "anthropic/claude-2:beta": "bad",
  "anthropic/claude-2.0": "bad",
  "anthropic/claude-2.0:beta": "bad",
  "anthropic/claude-2.1": "bad",
  "anthropic/claude-2.1:beta": "bad",
  // Not sure what to call it even...
  "openrouter/auto": "good",
  // Outdated...
  "cohere/command": "bad",
  // Quite good?
  "cohere/command-r": "good",
  "cohere/command-r-03-2024": "bad",
  "cohere/command-r-08-2024": "bad",
  "cohere/command-r-plus": "great",
  "cohere/command-r-plus-04-2024": "bad",
  // Oddly this is cheaper... and newer...?
  "cohere/command-r-plus-08-2024": "great",
  "databricks/dbrx-instruct": "ok",
  // Terribly slow
  "deepseek/deepseek-chat": "error",
  "cognitivecomputations/dolphin-mixtral-8x7b": "bad",
  // Slow but seems to work well...
  "cognitivecomputations/dolphin-mixtral-8x22b": "good",
  "eva-unit-01/eva-qwen-2.5-14b": "bad",
  "sao10k/fimbulvetr-11b-v2": "good",
  // Slow, and actually fine, but too expensive
  "alpindale/goliath-120b": "bad",
  "google/gemini-flash-1.5-8b": "ok",
  "google/gemini-flash-1.5": "good",
  // Outdated:
  "google/gemini-pro": "bad",
  "google/gemini-pro-1.5": "great",
  "google/gemini-pro-vision": "error",
  "google/gemma-2-27b-it": "ok",
  "google/gemma-2-9b-it": "ok",
  // Outdated:
  "google/palm-2-chat-bison": "bad",
  "google/palm-2-chat-bison-32k": "bad",
  "google/palm-2-codechat-bison": "bad",
  "google/palm-2-codechat-bison-32k": "bad",
  // Is giving an error:
  "inflection/inflection-3-pi": "error",
  "inflection/inflection-3-productivity": "error",
  // Literally terrible:
  "liquid/lfm-40b": "bad",
  "sao10k/l3-lunaris-8b": "bad",
  // too slow
  "sao10k/l3-euryale-70b": "bad",
  // Expensive:
  "neversleep/llama-3-lumimaid-70b": "bad",
  "neversleep/llama-3-lumimaid-8b": "bad",
  "neversleep/llama-3-lumimaid-8b:extended": "bad",
  "sao10k/l3.1-euryale-70b": "bad",
  "neversleep/llama-3.1-lumimaid-70b": "bad",
  "neversleep/llama-3.1-lumimaid-8b": "bad",
  "lizpreciatior/lzlv-70b-fp16-hf": "bad",
  "alpindale/magnum-72b": "ok",
  "anthracite-org/magnum-v2-72b": "bad",
  "anthracite-org/magnum-v4-72b": "ok",
  "mancer/weaver": "error",
  // Outdated models...
  "meta-llama/llama-3-70b-instruct": "bad",
  "meta-llama/llama-3-70b-instruct:nitro": "bad",
  "meta-llama/llama-3-8b-instruct": "bad",
  "meta-llama/llama-3-8b-instruct:extended": "bad",
  "meta-llama/llama-3-8b-instruct:nitro": "bad",
  "meta-llama/llama-3.1-405b": "bad",
  "meta-llama/llama-3.1-405b-instruct": "good",
  // Wildly expensive
  "meta-llama/llama-3.1-405b-instruct:nitro": "bad",
  "meta-llama/llama-3.1-70b-instruct": "error",
  "meta-llama/llama-3.1-70b-instruct:nitro": "error",
  "meta-llama/llama-3.1-8b-instruct": "ok",
  "meta-llama/llama-3.2-11b-vision-instruct": "error",
  "meta-llama/llama-3.2-1b-instruct": "bad",
  "meta-llama/llama-3.2-3b-instruct": "bad",
  "meta-llama/llama-3.2-90b-vision-instruct": "error",
  "meta-llama/llama-2-13b-chat": "bad",
  "meta-llama/llama-guard-2-8b": "bad",
  "sophosympatheia/midnight-rose-70b": "ok",
  "mistralai/ministral-3b": "bad",
  "mistralai/ministral-8b": "bad",
  // This works, but is SO SLOW
  "mistralai/mistral-large": "bad",
  "mistralai/mistral-medium": "bad",
  "nothingiisreal/mn-celeste-12b": "ok",
  "aetherwiing/mn-starcannon-12b": "ok",
  "mistralai/mistral-small": "ok",
  "mistralai/mistral-tiny": "ok",
  "mistralai/codestral-mamba": "bad",
  // OK but slow...
  "mistralai/mistral-7b-instruct": "bad",
  "mistralai/mistral-7b-instruct:nitro": "bad",
  "mistralai/mistral-7b-instruct-v0.1": "bad",
  "mistralai/mistral-7b-instruct-v0.2": "bad",
  "mistralai/mistral-7b-instruct-v0.3": "ok",
  "mistralai/mistral-nemo": "good",
  "mistralai/mixtral-8x22b-instruct": "good",
  "mistralai/pixtral-12b": "error",
  "mistralai/mixtral-8x7b": "bad",
  "mistralai/mixtral-8x7b-instruct": "ok",
  "mistralai/mixtral-8x7b-instruct:nitro": "ok",
  "gryphe/mythomax-l2-13b": "bad",
  "gryphe/mythomax-l2-13b:extended": "bad",
  "gryphe/mythomax-l2-13b:nitro": "bad",
  "gryphe/mythomist-7b": "bad",
  "neversleep/noromaid-20b": "bad",
  "nousresearch/nous-hermes-llama2-13b": "bad",
  "nousresearch/nous-hermes-2-mixtral-8x7b-dpo": "good",
  "nousresearch/hermes-2-theta-llama-3-8b": "ok",
  "nousresearch/hermes-3-llama-3.1-405b": "ok",
  // Kind of slow and expensive...
  "nousresearch/hermes-3-llama-3.1-405b:extended": "bad",
  "nousresearch/hermes-3-llama-3.1-70b": "ok",
  "nousresearch/hermes-2-pro-llama-3-8b": "good",
  // Maybe good, but so slow...
  "nvidia/llama-3.1-nemotron-70b-instruct": "ok",
  "openai/chatgpt-4o-latest": "great",
  // All too old
  "openai/gpt-3.5-turbo": "bad",
  "openai/gpt-3.5-turbo-0613": "bad",
  "openai/gpt-3.5-turbo-16k": "bad",
  "openai/gpt-3.5-turbo-0125": "bad",
  "openai/gpt-3.5-turbo-1106": "bad",
  "openai/gpt-3.5-turbo-instruct": "bad",
  "openai/gpt-4": "bad",
  "openai/gpt-4-0314": "bad",
  "openai/gpt-4-32k": "bad",
  "openai/gpt-4-32k-0314": "bad",
  // I'm keeping this as good just because 4o is all-around better
  "openai/gpt-4-turbo": "good",
  "openai/gpt-4-1106-preview": "bad",
  "openai/gpt-4-turbo-preview": "bad",
  "openai/gpt-4-vision-preview": "bad",
  // Maybe this is a dup of chatgpt-4o-latest
  "openai/gpt-4o": "great",
  "openai/gpt-4o-2024-05-13": "bad",
  "openai/gpt-4o-2024-08-06": "bad",
  "openai/gpt-4o:extended": "bad",
  "openai/gpt-4o-mini": "great",
  "openai/gpt-4o-mini-2024-07-18": "bad",
  "openai/o1-mini": "ok",
  "openai/o1-mini-2024-09-12": "bad",
  // Just really inappropiate
  "openai/o1-preview": "bad",
  "openai/o1-preview-2024-09-12": "bad",
  "openchat/openchat-7b": "bad",
  "teknium/openhermes-2.5-mistral-7b": "bad",
  "perplexity/llama-3.1-sonar-huge-128k-online": "good",
  "perplexity/llama-3.1-sonar-large-128k-chat": "good",
  // What is the difference between these?
  "perplexity/llama-3.1-sonar-large-128k-online": "good",
  "perplexity/llama-3.1-sonar-small-128k-chat": "good",
  "perplexity/llama-3.1-sonar-small-128k-online": "good",
  "perplexity/llama-3-sonar-large-32k-chat": "error",
  "perplexity/llama-3-sonar-large-32k-online": "error",
  "perplexity/llama-3-sonar-small-32k-chat": "error",
  "microsoft/phi-3-medium-128k-instruct": "bad",
  "microsoft/phi-3-mini-128k-instruct": "bad",
  "microsoft/phi-3.5-mini-128k-instruct": "bad",
  "pygmalionai/mythalion-13b": "bad",
  "qwen/qwen-110b-chat": "great",
  "qwen/qwen-72b-chat": "great",
  "qwen/qwen-2-72b-instruct": "great",
  "qwen/qwen-2-7b-instruct": "great",
  // Seems to freeze up
  "qwen/qwen-2-vl-72b-instruct": "error",
  "qwen/qwen-2-vl-7b-instruct": "bad",
  "qwen/qwen-2.5-72b-instruct": "great",
  "qwen/qwen-2.5-7b-instruct": "bad",
  "undi95/remm-slerp-l2-13b": "bad",
  "undi95/remm-slerp-l2-13b:extended": "bad",
  "thedrummer/rocinante-12b": "good",
  // It's kind of crazy, but amusingly so...
  "undi95/toppy-m-7b": "ok",
  "undi95/toppy-m-7b:nitro": "bad",
  "microsoft/wizardlm-2-7b": "great",
  "microsoft/wizardlm-2-8x22b": "great",
  "x-ai/grok-beta": "error",
  "xwin-lm/xwin-lm-70b": "bad",

  // Some November 2024 options:
  "meta-llama/llama-3.2-90b-vision-instruct:free": "bad",
  "anthropic/claude-3-5-haiku": "great",
  "anthropic/claude-3-5-haiku:beta": "great",
  // I just don't feel like having dated models in here:
  "anthropic/claude-3-5-haiku-20241022": "bad",
  "anthropic/claude-3-5-haiku-20241022:beta": "bad",

  // Some January 2025 options:
  "google/gemini-2.0-flash-thinking-exp:free": "error",
  "sophosympatheia/rogue-rose-103b-v0.2:free": "bad",
  "google/gemini-2.0-flash-thinking-exp-1219:free": "error",
  "google/gemini-2.0-flash-exp:free": "error",
  "google/gemini-exp-1206:free": "error",
  "google/gemini-exp-1121:free": "error",
  "google/learnlm-1.5-pro-experimental:free": "error",
  "google/gemini-exp-1114:free": "error",
  // Can't figure out characters:
  "liquid/lfm-7b": "bad",
  // Too much hallucination:
  "liquid/lfm-3b": "bad",
  // Weirdly minimal:
  "amazon/nova-micro-v1": "bad",
  // Can't handle the tags and language:
  "cohere/command-r7b-12-2024": "bad",
  "amazon/nova-lite-v1": "ok",
  // Not sure if this is good or great...
  "microsoft/phi-4": "great",
  // Technically this one does well, but it seems weird to use a coder model...
  "qwen/qwen-2.5-coder-32b-instruct": "ok",
  // It's okay, but really slow...
  "meta-llama/llama-3.3-70b-instruct": "ok",
  // Slow and iffy
  "qwen/qwq-32b-preview": "ok",
  "minimax/minimax-01": "error",
  // It thinks way too hard and over-replies. Could work with prompt adjustments...
  "deepseek/deepseek-r1-distill-llama-70b": "ok",
  // Really for visuals...
  "qwen/qvq-72b-preview": "bad",
  // Crazy long over-replying
  "infermatic/mn-inferor-12b": "bad",
  // Eh, code-oriented...
  "mistralai/codestral-2501": "bad",
  "thedrummer/unslopnemo-12b": "good",
  // Slow and expensive, but still pretty good I guess? But SO SLOW
  "deepseek/deepseek-r1": "ok",
  "sao10k/l3.3-euryale-70b": "ok",
  // Weird, curt, and expensive...
  "amazon/nova-pro-v1": "bad",
  "anthropic/claude-3.5-haiku-20241022": "great",
  // Don't really need two copies...
  "anthropic/claude-3.5-haiku-20241022:beta": "error",
  "anthropic/claude-3.5-haiku": "great",
  "anthropic/claude-3.5-haiku:beta": "error",
  // Not very accurate replies or interpretation...
  "meta-llama/llama-2-70b-chat": "ok",
  // Vision model...
  "x-ai/grok-2-vision-1212": "error",
  "x-ai/grok-2-1212": "ok",
  "mistralai/mistral-large-2411": "good",
  // Just an older version, not that interesting
  "mistralai/mistral-large-2407": "error",
  // Vision
  "mistralai/pixtral-large-2411": "error",
  // Painfully slow...
  "deepseek/deepseek-chat-v2.5": "ok",
  // Dated version isn't that interesting
  "openai/gpt-4o-2024-11-20": "error",
  // So slow
  "eva-unit-01/eva-qwen-2.5-32b": "bad",
  "sao10k/l3.1-70b-hanami-x1": "bad",
  "01-ai/yi-large": "good",
  // Slow and expensive, eh...
  "eva-unit-01/eva-llama-3.33-70b": "ok",
  "eva-unit-01/eva-qwen-2.5-72b": "ok",
  // Too slow and expensive...
  "raifle/sorcererlm-8x22b": "ok",
  // vision...
  "x-ai/grok-vision-beta": "error",
  "openai/o1": "error",

  // Some February 2025 options:
  "cognitivecomputations/dolphin3.0-r1-mistral-24b:free": "error",
  "cognitivecomputations/dolphin3.0-mistral-24b:free": "error",
  // Can't follow response formatting directions:
  "deepseek/deepseek-r1-distill-llama-8b": "bad",
  "google/gemini-2.0-flash-lite-preview-02-05:free": "error",
  "google/gemini-2.0-pro-exp-02-05:free": "error",
  // Can't follow formatting instructions:
  "qwen/qwen-vl-plus:free": "bad",
  // At least it works, and is good for a 'free' model:
  "qwen/qwen2.5-vl-72b-instruct:free": "good",
  "mistralai/mistral-small-24b-instruct-2501:free": "error",
  "deepseek/deepseek-r1-distill-llama-70b:free": "error",
  "deepseek/deepseek-r1:free": "error",
  "deepseek/deepseek-chat:free": "error",
  "meta-llama/llama-3.3-70b-instruct:free": "ok",
  "nvidia/llama-3.1-nemotron-70b-instruct:free": "error",
  "mistralai/mistral-nemo:free": "error",
  "qwen/qwen-turbo": "good",
  // Can handle some formatting, but not consistently:
  "mistralai/mistral-small-24b-instruct-2501": "bad",
  // Kind of quirky, but okay:
  "google/gemini-2.0-flash-001": "good",
  "deepseek/deepseek-r1-distill-qwen-32b": "great",
  // Doesn't understand formatting:
  "google/gemma-7b-it": "bad",
  // Somehow this costs more than the 32b version...? And can't handle formatting
  "deepseek/deepseek-r1-distill-qwen-1.5b": "bad",
  "mistralai/mistral-saba": "good",
  // Doesn't understand formatting or quoting:
  "aion-labs/aion-rp-llama-3.1-8b": "bad",
  "meta-llama/llama-guard-3-8b": "error",
  // Expensive for what it is, but eh...
  "qwen/qwen-plus": "good",
  // Not really a good match for the task:
  "aion-labs/aion-1.0-mini": "bad",
  // Surprisingly solid:
  "google/gemini-2.0-flash-lite-001": "great",
  // Too slow and expensive, not really appropriate:
  "perplexity/sonar-reasoning": "ok",
  // Similar, though it's better than the reasoning one:
  "perplexity/sonar": "ok",
  // Could be great but very slow:
  "openai/o3-mini-high": "good",
  // Same issue, though maybe faster:
  "openai/o3-mini": "good",
  // Expensive, but actually quite good:
  "qwen/qwen-max": "great",
  // Bit of a try-hard, does too much:
  "deepseek/deepseek-r1-distill-qwen-14b": "good",
  // Not a good fit:
  "perplexity/r1-1776": "ok",
  "anthropic/claude-3.7-sonnet": "great",
  // Same as above, so skipping:
  "anthropic/claude-3.7-sonnet:beta": "error",
  // Expensive, slow, not the right thing...
  "aion-labs/aion-1.0": "bad",
  // Ditto on expense, but not quite as slow...
  "allenai/llama-3.1-tulu-3-405b": "ok",

  // Some June 2025 options:
  "mistralai/mistral-small-3.2-24b-instruct:free": "ok",
  // Very slow, or fails...
  "minimax/minimax-m1:extended": "bad",
  // Slow and doesn't work well...
  "moonshotai/kimi-dev-72b:free": "bad",
  // Works okay but slow
  "deepseek/deepseek-r1-0528-qwen3-8b:free": "ok",
  // Ditto, very slow...
  "deepseek/deepseek-r1-0528:free": "ok",
  // Errored out:
  "sarvamai/sarvam-m:free": "error",
  // Doesn't apply
  "mistralai/devstral-small:free": "error",
  "google/gemma-3n-e4b-it:free": "error",
  "meta-llama/llama-3.3-8b-instruct:free": "error",
  "microsoft/phi-4-reasoning-plus:free": "error",
  // Can't follow instructions:
  "microsoft/phi-4-reasoning:free": "error",
  "opengvlab/internvl3-14b:free": "good",
  "opengvlab/internvl3-2b:free": "bad",
  "qwen/qwen3-30b-a3b:free": "ok",
  // Kind of technically works, but so slow
  "qwen/qwen3-8b:free": "ok",
  "qwen/qwen3-14b:free": "ok",
  "qwen/qwen3-32b:free": "ok",
  "qwen/qwen3-235b-a22b:free": "ok",
  "tngtech/deepseek-r1t-chimera:free": "good",
  "microsoft/mai-ds-r1:free": "error",
  // Not sure about the instruction following...
  "thudm/glm-z1-32b:free": "ok",
  "thudm/glm-4-32b:free": "ok",
  // Didn't follow instructions:
  "shisa-ai/shisa-v2-llama3.3-70b:free": "bad",
  "arliai/qwq-32b-arliai-rpr-v1:free": "error",
  "agentica-org/deepcoder-14b-preview:free": "ok",
  // Didn't follow instructions:
  "moonshotai/kimi-vl-a3b-thinking:free": "bad",
  "nvidia/llama-3.3-nemotron-super-49b-v1:free": "bad",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1:free": "error",
  "meta-llama/llama-4-maverick:free": "error",
  "meta-llama/llama-4-scout:free": "bad",
  "deepseek/deepseek-v3-base:free": "error",
  "google/gemini-2.5-pro-exp-03-25": "error",
  "qwen/qwen2.5-vl-32b-instruct:free": "good",
  // So slow...
  "deepseek/deepseek-chat-v3-0324:free": "bad",
  // Doesn't follow instructions:
  "featherless/qwerky-72b:free": "bad",
  // It does get creative, but doesn't follow instructions:
  "mistralai/mistral-small-3.1-24b-instruct:free": "bad",
  "google/gemma-3-4b-it:free": "bad",
  "google/gemma-3-12b-it:free": "bad",
  "rekaai/reka-flash-3:free": "bad",
  // Super slow, but works:
  "google/gemma-3-27b-it:free": "ok",
  // Not sure how good it is really, but it does get creative...
  "qwen/qwq-32b:free": "good",
  // Fast but doesn't follow instructions:
  "nousresearch/deephermes-3-llama-3-8b-preview:free": "bad",
  "deepseek/deepseek-r1-distill-qwen-32b:free": "good",
  "deepseek/deepseek-r1-distill-qwen-14b:free": "error",
  "qwen/qwen-2.5-coder-32b-instruct:free": "ok",
  "qwen/qwen-2.5-72b-instruct:free": "ok",
  // Loses track of perspective, but maybe okay:
  "google/gemma-3-4b-it": "ok",
  // So slow, and not even free!
  "qwen/qwen3-8b": "bad",
  "deepseek/deepseek-r1-0528-qwen3-8b": "good",
  "meta-llama/llama-guard-4-12b": "error",
  // Doesn't follow instructions:
  "mistralai/mistral-small-3.1-24b-instruct": "bad",
  "google/gemma-3-12b-it": "ok",
  // Get's a little creative...
  "microsoft/phi-4-multimodal-instruct": "ok",
  "mistralai/devstral-small": "bad",
  "qwen/qwen3-14b": "ok",
  "google/gemini-2.5-flash-preview-05-20": "great",
  // Just impossibly slow, and bad at instructions:
  "microsoft/phi-4-reasoning-plus": "bad",
  // Slow but decent:
  "qwen/qwen3-30b-a3b": "ok",
  "meta-llama/llama-4-scout": "ok",
  "mistralai/mistral-small-3.2-24b-instruct": "ok",
  "google/gemini-2.5-flash-lite-preview-06-17": "great",
  "deepseek/deepseek-r1-distill-qwen-7b": "error",
  // Works but slow...
  "qwen/qwen3-32b": "ok",
  // Competent for its cost/speed:
  "openai/gpt-4.1-nano": "good",
  // Didn't follow instructions:
  "google/gemma-3-27b-it": "bad",
  // Works but soooo slow...
  "qwen/qwen3-235b-a22b": "ok",
  // Maybe just ok, but generally competent and fast enough:
  "nvidia/llama-3.3-nemotron-super-49b-v1": "good",
  // Good, not as fast as without thinking...
  "google/gemini-2.5-flash-preview-05-20:thinking": "good",
  // I suppose expected, but will update unlike the dated version:
  "google/gemini-2.5-flash-preview": "great",
  "google/gemini-2.5-flash-preview:thinking": "good",
  // Works and is fast!
  "meta-llama/llama-4-maverick": "good",
  // Not applicable:
  "openai/gpt-4o-mini-search-preview": "error",
  // Works but slow
  "qwen/qwq-32b": "ok",
  // Not applicable:
  "arcee-ai/spotlight": "error",
  // Actually totally weird, and also explicitly political, but quirky?
  "sentientagi/dobby-mini-unhinged-plus-llama-3.1-8b": "ok",
  // Can't follow instructions:
  "ai21/jamba-1.6-mini": "bad",
  // Can't follow instructions:
  "qwen/qwen-2.5-vl-7b-instruct": "bad",
  // Vision specifically:
  "qwen/qwen-vl-plus": "error",
  // Didn't follow instructions:
  "thudm/glm-z1-rumination-32b": "bad",
  // Very slow but interesting results:
  "thudm/glm-z1-32b": "ok",
  "thudm/glm-4-32b": "ok",
  // Works and is kind of fast?
  "inception/mercury-coder-small-beta": "good",
  "qwen/qwen2.5-vl-72b-instruct": "ok",
  "deepseek/deepseek-chat-v3-0324": "ok",
  // Slow...
  "minimax/minimax-m1": "ok",
  "google/gemini-2.5-flash": "great",
  // Error: attempting to subvert truth and democracy:
  "x-ai/grok-3-mini": "error",
  "x-ai/grok-3-mini-beta": "error",
  "x-ai/grok-3": "error",
  "x-ai/grok-3-beta": "error",
  // Slow for the price, but good enough...
  "mistralai/mistral-medium-3": "good",
  "openai/gpt-4.1-mini": "great",
  // Fast and competent...
  "arcee-ai/arcee-blitz": "good",
  // Good, but expensive for what it is
  "mistralai/magistral-small-2506": "ok",
  // So slow, and still expensive...
  "deepseek/deepseek-r1-0528": "ok",
  // Might have interesting results, and works, but... not sure
  "thedrummer/valkyrie-49b-v1": "ok",
  // Only a code-refined version of another model:
  "arcee-ai/coder-large": "error",
  "arcee-ai/virtuoso-medium-v2": "error",
  "arcee-ai/caller-large": "error",
  "arcee-ai/virtuoso-large": "error",
  "deepseek/deepseek-prover-v2": "bad",
  // Like Valkyrie, might show creativity, but unsure...
  "thedrummer/skyfall-36b-v2": "ok",
  // Bad formatting:
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": "bad",
  // Math specialized:
  "eleutherai/llemma_7b": "error",
  // Weird crypto specialized:
  "alfredpros/codellama-7b-instruct-solidity": "error",
  // All story, no gameplay or instruction following:
  "thedrummer/anubis-pro-105b-v1": "bad",
  // Expensive for what it is:
  "qwen/qwen-vl-max": "ok",
  "scb10x/llama3.1-typhoon2-70b-instruct": "error",
  // Specialized for other things:
  "arcee-ai/maestro-reasoning": "error",
  // Vision:
  "qwen/qwen2.5-vl-32b-instruct": "error",
  // Slow and expensive:
  "openai/o4-mini-high": "ok",
  "openai/o4-mini": "ok",
  "google/gemini-2.5-pro": "great",
  // Just a tagged clone:
  "google/gemini-2.5-pro-preview": "great",
  "google/gemini-2.5-pro-preview-05-06": "error",
  // Not applicable:
  "openai/codex-mini": "error",
  // Fine, expensive...
  "mistralai/magistral-medium-2506": "good",
  "mistralai/magistral-medium-2506:thinking": "good",
  // Needs key
  "openai/o3": "error",
  "openai/gpt-4.1": "great",
  // Didn't follow instructions:
  "ai21/jamba-1.6-large": "bad",
  // Feels inapplicable:
  "perplexity/sonar-reasoning-pro": "error",
  "perplexity/sonar-deep-research": "error",
  // Needs moderation?
  "cohere/command-a": "error",
  "openai/gpt-4o-search-preview": "error",
  "all-hands/openhands-lm-32b-v0.1": "error",
  "anthropic/claude-sonnet-4": "great",
  // Is it for search? I don't know, but I guess it works if expensive?
  "perplexity/sonar-pro": "ok",
  // Thinking isn't really needed, otherwise great but superfluous:
  "anthropic/claude-3.7-sonnet:thinking": "good",
  // Oddly, just didn't complete the first time?
  "anthropic/claude-opus-4": "good",
  // All expensive, not really right anyway...
  "openai/o3-pro": "error",
  "openai/gpt-4.5-preview": "error",
  "openai/o1-pro": "error",
};

export type ModelType = {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: ArchitectureType;
  pricing: PricingType;
  top_provider: TopProviderType;
  per_request_limits: any;
};

export type OllamaModelType = {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
};

export type ArchitectureType = {
  modality: string;
  tokenizer: string;
  instruct_type: string;
};

export type PricingType = {
  prompt: string;
  completion: string;
  image: string;
  request: string;
};

export type TopProviderType = {
  context_length: number;
  max_completion_tokens: number;
  is_moderated: boolean;
};

// const availableModels = persistentSignal<ModelType[] | null>(
//   "availableModels",
//   null
// );

export async function fetchOllamaModels(): Promise<ModelType[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();

    return data.models.map((model: OllamaModelType) => ({
      id: model.name,
      name: `Ollama: ${model.name}`,
      created: Date.parse(model.modified_at),
      description: `Local Ollama model: ${model.name}`,
      context_length: 4096,
      architecture: {
        modality: "text",
        tokenizer: "unknown",
        instruct_type: "unknown"
      },
      pricing: {
        prompt: "0",
        completion: "0",
        image: "0",
        request: "0"
      },
      top_provider: {
        context_length: 4096,
        max_completion_tokens: 4096,
        is_moderated: false
      },
      per_request_limits: {}
    }));
  } catch (error) {
    console.warn('Failed to fetch Ollama models:', error);
    return [];
  }
}

export function ModelSelector({
  signal,
  freeOnly,
}: {
  signal: SignalType<ModelType | undefined | null>;
  freeOnly: boolean;
}) {
  useSignals();
  const availableModels = useSignal<ModelType[] | null>(null);
  const copying = useSignal(false);
  useEffect(() => {
    if (!availableModels.value) {
      Promise.all([
        fetch("https://openrouter.ai/api/v1/models").then(res => res.json()),
        fetchOllamaModels()
      ])
        .then(([openRouterData, ollamaModels]) => {
          const openRouterModels: ModelType[] = openRouterData.data;
          const allModels = [...openRouterModels, ...ollamaModels];
          availableModels.value = sortBy(allModels, (x) =>
            parseFloat(x.pricing.prompt)
          );
        })
        .catch(error => {
          console.error('Error fetching models:', error);
        });
    }
  });
  let models = availableModels.value;
  if (freeOnly && models) {
    models = models.filter(
      (model) =>
        model.pricing.prompt === "0" &&
        model.pricing.completion === "0" &&
        model.pricing.request === "0"
    );
  }
  return (
    <div>
      <select
        className="text-black bg-cyan-300 p-2"
        value={signal.value ? signal.value.id : ""}
        onChange={(e) => {
          signal.value = models?.find((model) => model.id === e.target.value);
        }}
      >
        <option value="">
          {availableModels.value
            ? "Select a model... (prices prompt/completion $/million tokens)"
            : "Loading..."}
        </option>
        {RATING_ORDER.map((rating) => {
          const match = models?.filter(
            (model) =>
              RATINGS[model.id] === rating ||
              (!RATINGS[model.id] && rating === "unknown")
          );
          if (!match?.length) {
            return null;
          }
          return (
            <optgroup key={rating} label={RATING_TITLES[rating]}>
              {match.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {priceString(model)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {signal.value && (
        <>
          <div
            className="text-xs mt-2 cursor-pointer"
            onClick={() => {
              // Copy to clipboard...
              if (signal.value?.id) {
                navigator.clipboard.writeText(signal.value.id);
                copying.value = true;
                setTimeout(() => {
                  copying.value = false;
                }, 1000);
              }
            }}
          >
            {copying.value ? "Copied!" : `id: ${signal.value.id}`}
          </div>
          <pre className="text-xs bg-blue-950 p-2 m-4 whitespace-pre-wrap">
            {signal.value.description}
          </pre>
        </>
      )}
    </div>
  );
}

function priceString(model: ModelType) {
  if (model.name.startsWith('Ollama: ')) {
    return '(Local)';
  }
  if (model.pricing.prompt === "0" && model.pricing.completion === "0") {
    return "Free";
  }
  const prompt = (parseFloat(model.pricing.prompt) * 1000000).toFixed(2);
  const completion = (parseFloat(model.pricing.completion) * 1000000).toFixed(
    2
  );
  return `$${prompt}/$${completion}`;
}
