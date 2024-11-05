import { persistentSignal, SignalType } from "@/lib/persistentsignal";
import { useSignal } from "@preact/signals-react";
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

export function ModelSelector({
  signal,
  freeOnly,
}: {
  signal: SignalType<ModelType | undefined | null>;
  freeOnly: boolean;
}) {
  const availableModels = useSignal<ModelType[] | null>(null);
  const copying = useSignal(false);
  useEffect(() => {
    if (!availableModels.value) {
      fetch("https://openrouter.ai/api/v1/models")
        .then((res) => res.json())
        .then((data) => {
          const models: ModelType[] = data.data;
          availableModels.value = sortBy(models, (x) =>
            parseFloat(x.pricing.prompt)
          );
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
  if (model.pricing.prompt === "0" && model.pricing.completion === "0") {
    return "Free";
  }
  const prompt = (parseFloat(model.pricing.prompt) * 1000000).toFixed(2);
  const completion = (parseFloat(model.pricing.completion) * 1000000).toFixed(
    2
  );
  return `$${prompt}/$${completion}`;
}
