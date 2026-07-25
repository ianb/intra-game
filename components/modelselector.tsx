import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import sortBy from "just-sort-by";
import { useEffect } from "react";
import type {
  ArchitectureType,
  ModelType,
  PricingType,
  TopProviderType,
} from "@/lib/llm";
import { SignalType } from "@/lib/persistentsignal";

export type { ArchitectureType, ModelType, PricingType, TopProviderType };

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

/**
 * Per-model notes from playtesting, keyed by OpenRouter model id.
 *
 * This started as a hand-curated table of ~400 models rated by actually
 * playing the game on each one. Nearly all of them have since been retired by
 * their providers, and a stale "great" on a model that no longer exists is
 * worse than no rating: the picker is fed by OpenRouter's live catalogue, so
 * unrated models still appear (under "Unknown") and nothing is lost by leaving
 * this empty. Ratings below "ok" hide a model from the list entirely, which is
 * the other reason not to guess.
 *
 * Re-populate it by playing — `pnpm playtest` drives the real engine against a
 * real model (see playtest/README.md). lib/models.ts holds the defaults the
 * game ships with.
 */
const RATINGS: Record<string, RatingType> = {};

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
  useSignals();
  const availableModels = useSignal<ModelType[] | null>(null);
  const copying = useSignal(false);
  useEffect(() => {
    if (!availableModels.value) {
      fetch("https://openrouter.ai/api/v1/models")
        .then((res) => res.json())
        .then((data) => {
          const models: ModelType[] = data.data;
          availableModels.value = sortBy(models, (x) =>
            parseFloat(x.pricing.prompt),
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
        model.pricing.request === "0",
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
              (!RATINGS[model.id] && rating === "unknown"),
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
    2,
  );
  return `$${prompt}/$${completion}`;
}
