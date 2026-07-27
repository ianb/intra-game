# An eval that survives someone else's bad minute

Two batches died in a row: one to `OpenRouter 503: DNS resolution failure`, one
to a timeout. Neither says anything about the model being scored, and each of
them discarded every model that had not run yet — an hour of work lost to a
provider having a bad minute.

So transient failures retry, and the question is which failures those are. The
line matters in both directions: retrying a 400 wastes time on a request that
will never work, and *not* retrying a 503 records an outage as a model's score.

```ts setup
import { isTransient } from "../evals/openrouter.js";
```

## Worth trying again

The provider is busy, or the network is.

```ts
const busy = [
  "Error: OpenRouter 429: rate limited",
  "Error: OpenRouter 503: DNS resolution failure",
  "Error: OpenRouter 502: bad gateway",
  "DOMException [TimeoutError]: The operation was aborted due to timeout",
  "TypeError: fetch failed",
  "Error: getaddrinfo EAI_AGAIN openrouter.ai",
];
busy.every(isTransient);
=> true
```

## Not worth trying again

The request is wrong and will stay wrong, or the answer arrived and was
unusable — which is a fact about the model and belongs in its score.

```ts
const permanent = [
  "Error: OpenRouter 400: invalid model",
  "Error: OpenRouter 401: no auth credentials found",
  "Error: OpenRouter 404: no endpoints found for that model",
  "Error: OpenRouter returned no content: {\"id\":\"gen-1\"}",
];
permanent.some(isTransient);
=> false
```

A 404 for an unknown model is the case worth being deliberate about. It looks
like a server error and isn't one: retrying a model id that doesn't exist just
delays the report that you typed it wrong.
