# Two dialects behind one endpoint

Both backends speak "OpenAI-compatible", which covers the messages, the model,
the SSE framing and the usage chunk. Every optional parameter beyond that is
per-provider, and the two ends disagree about what to do with one they don't
recognise: OpenRouter ignores it, OpenAI returns a 400 and no turn.

Two OpenRouter spellings reached the gateway that way, a week apart. `usage:
{include: true}` gave `400 Unknown parameter: 'usage'`, and once that was gone
`reasoning: {effort}` gave `400 Unknown parameter: 'reasoning'`. Both were found
by a player, because the only provider any test had ever called was OpenRouter —
the fake provider accepts any body at all, so it agrees with whatever is sent.

This file is the substitute for a real call: the exact body each backend puts on
the wire, so a third spelling fails here rather than live.

```ts setup
import { gatewayChatStream } from "../worker/aigateway.js";
import { openRouterChatStream } from "../worker/openrouter.js";
import { requestExtras } from "../worker/openaistream.js";
import type { ChatType } from "../lib/types.js";

const ask: ChatType = {
  meta: { title: "prompt Ama" },
  messages: [{ role: "system", content: "you are Ama" }],
};

function capture(): { body: () => Record<string, unknown> } {
  let sent = "";
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = init.body as string;
    return new Response("data: [DONE]\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;
  return { body: () => JSON.parse(sent) as Record<string, unknown> };
}
```

## What the gateway is sent

Only what OpenAI defines. `stream_options` is standard and is where the token
counts come from; `reasoning_effort` is a top-level string, which is the Chat
Completions spelling.

```ts
const gateway = capture();
await gatewayChatStream({
  accountId: "acct123",
  gatewayId: "intra",
  token: "aig-token",
  model: "openai/gpt-5.4-nano",
  reasoningEffort: "medium",
})(ask, () => {});
Object.keys(gateway.body()).sort().join(" ");
=> messages model reasoning_effort stream stream_options
```

The value is the bare string, not an object:

``` continue
JSON.stringify(gateway.body().reasoning_effort);
=> "medium"
```

Nothing at all when the deployment doesn't ask for an effort — a model that
takes no direction on it should be sent none:

``` continue
const plain = capture();
await gatewayChatStream({
  accountId: "acct123",
  token: "aig-token",
  model: "anthropic/claude-haiku-4-5",
})(ask, () => {});
Object.keys(plain.body()).sort().join(" ");
=> messages model stream stream_options
```

## What OpenRouter is sent

Its own two extensions, and it is the only backend that gets them. `usage`
is what makes it report the price it charged, which is why the OpenRouter path
needs no configured per-token prices and the gateway path does.

``` continue
const router = capture();
await openRouterChatStream({
  apiKey: "sk-or-test",
  model: "openai/gpt-5.4-nano",
  reasoningEffort: "medium",
})(ask, () => {});
Object.keys(router.body()).sort().join(" ");
=> messages model reasoning stream stream_options usage
```

``` continue
JSON.stringify(router.body().reasoning);
=> {"effort":"medium"}
```

## The default is the strict dialect

A backend added later gets OpenAI's spellings unless it says otherwise, so
forgetting to declare a dialect fails safe rather than 400ing at a provider.

``` continue
JSON.stringify(requestExtras({ reasoningEffort: "high" }));
=> {"reasoning_effort":"high"}
```

``` continue
JSON.stringify(requestExtras({}));
=> {}
```
