# Talking to AI Gateway

The gateway backend had never made a real call. Everything that exercised it —
the fake provider, the streaming tests — answers whatever URL it is given, so
the URL itself was never checked, and it was wrong: it pointed at Workers AI,
which is a different service with different auth and different model ids.

Three mistakes held each other up. `api.cloudflare.com/.../ai/v1` wants an
`Authorization` header rather than `cf-aig-authorization`, it takes `@cf/...`
model ids rather than `provider/model`, and it is not a gateway, so none of the
logging or spend limits the gateway exists for would have applied. The first
real call would have failed, and the error would have been about the header
rather than about the host.

So the request itself is pinned here.

```ts setup
import { gatewayChatStream } from "../worker/aigateway.js";
import type { ChatType } from "../lib/types.js";

const ask: ChatType = {
  meta: { title: "prompt Ama" },
  messages: [{ role: "system", content: "you are Ama" }],
};

// Capture the request without making one. The response is a bare SSE stream
// carrying a single done marker, which is enough to let the call finish.
function capture(): { seen: RequestInit & { url?: string } } {
  const seen: RequestInit & { url?: string } = {};
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    Object.assign(seen, init, { url });
    return new Response("data: [DONE]\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;
  return { seen };
}
```

## The gateway is addressed by name

A gateway's name is part of its URL, so it is configuration rather than
decoration — the docs used to say the name didn't matter.

```ts
const { seen } = capture();
await gatewayChatStream({
  accountId: "acct123",
  gatewayId: "intra",
  token: "aig-token",
  model: "anthropic/claude-haiku-4-5",
})(ask, () => {});
seen.url;
=> https://gateway.ai.cloudflare.com/v1/acct123/intra/compat/chat/completions
```

Unnamed gateways are `default`, which is Cloudflare's own fallback:

``` continue
const plain = capture();
await gatewayChatStream({
  accountId: "acct123",
  token: "aig-token",
  model: "anthropic/claude-haiku-4-5",
})(ask, () => {});
plain.seen.url;
=> https://gateway.ai.cloudflare.com/v1/acct123/default/compat/chat/completions
```

## Two tokens, two headers

`cf-aig-authorization` authenticates with Cloudflare. It is ours and is never
sent to the client. When a player brings their own provider key it rides along
in `Authorization`, which the gateway passes through to the provider — so the
player pays for their own play while the gateway still records it against the
account.

``` continue
const both = capture();
await gatewayChatStream({
  accountId: "acct123",
  token: "aig-token",
  model: "anthropic/claude-haiku-4-5",
  providerKey: "sk-ant-player",
})(ask, () => {});
JSON.stringify(both.seen.headers);
=> {"content-type":"application/json","cf-aig-authorization":"Bearer aig-token","authorization":"Bearer sk-ant-player"}
```

Without one, only the gateway token goes:

``` continue
const alone = capture();
await gatewayChatStream({
  accountId: "acct123",
  token: "aig-token",
  model: "anthropic/claude-haiku-4-5",
})(ask, () => {});
Object.keys(alone.seen.headers as Record<string, string>).join(" ");
=> content-type cf-aig-authorization
```

## Models keep their provider prefix

The gateway's compat endpoint takes `provider/model`, the same shape OpenRouter
uses, which is why the model ids the game stores work against either.

``` continue
const body = capture();
await gatewayChatStream({
  accountId: "acct123",
  token: "aig-token",
  model: "anthropic/claude-haiku-4-5",
})(ask, () => {});
JSON.parse(body.seen.body as string).model;
=> anthropic/claude-haiku-4-5
```
