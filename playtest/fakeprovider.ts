import { createServer } from "node:http";

/**
 * A stand-in for OpenRouter, on localhost.
 *
 * The Worker's streaming path — SSE framing, delta forwarding, the usage chunk,
 * cost and cached-token accounting — could otherwise only be exercised by
 * spending real money at a real provider, which is why it went unverified for
 * as long as it did. This speaks the same protocol and lies about the numbers,
 * so the plumbing can be tested for free and on demand.
 *
 *     pnpm fakeprovider                     # listens on 8799
 *
 * Then point the Worker at it, in .dev.vars, with DEV_FAKE_LLM commented out:
 *
 *     OPENROUTER_API_KEY=sk-or-anything
 *     OPENROUTER_BASE_URL=http://127.0.0.1:8799/v1/chat/completions
 *
 * It logs what each request actually contained, which is the half that matters:
 * that the right model was chosen for the prompt's tier, that the key went in
 * the right header, and that `stream_options` and `usage` were asked for at all.
 *
 * The token counts and cost it returns are invented. Nothing here says anything
 * about what a real provider charges.
 */

const PORT = Number(process.env.PORT ?? 8799);

/** Well-formed protocol output, so the engine folds it like a real reply. */
function reply(title: string | undefined): string {
  if (title === "player input") {
    return `<dialog character="PLAYER">Hello.</dialog>`;
  }
  return `<context>ok</context>\n<dialog character="Ama">A fake reply, from a fake provider.</dialog>`;
}

const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  const parsed = JSON.parse(body || "{}") as {
    model?: string;
    messages?: { role: string; content: string }[];
    stream_options?: unknown;
    usage?: unknown;
  };
  const auth = request.headers.authorization ?? "(none)";
  const system = parsed.messages?.[0]?.content ?? "";
  const title = /playing the part of a character named "(\w+)"/.exec(system)
    ? "prompt"
    : "player input";
  console.log(
    `model=${parsed.model} auth=${auth.slice(0, 16)}… ` +
      `stream_options=${JSON.stringify(parsed.stream_options)} ` +
      `usage=${JSON.stringify(parsed.usage)} messages=${parsed.messages?.length}`,
  );

  response.writeHead(200, { "content-type": "text/event-stream" });
  const text = reply(title);
  // Chunked mid-tag, so the streaming parser's chunk-boundary handling is
  // exercised rather than bypassed.
  for (let i = 0; i < text.length; i += 9) {
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 9) } }] })}\n\n`,
    );
  }
  // The usage chunk, which only arrives because stream_options asked for it.
  response.write(
    `data: ${JSON.stringify({
      choices: [],
      usage: {
        prompt_tokens: Math.round(system.length / 4),
        completion_tokens: Math.round(text.length / 4),
        prompt_tokens_details: { cached_tokens: 0 },
        cost: 0.00123,
      },
    })}\n\n`,
  );
  response.write("data: [DONE]\n\n");
  response.end();
});

server.listen(PORT, () => {
  console.log(`fake provider on http://127.0.0.1:${PORT}/v1/chat/completions`);
});
