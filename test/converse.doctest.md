# The spoken-conversation prompt

A voice session with a character is built from the same material as their text
prompt (description, roleplay instructions, room, schedule, company, attitudes,
and what they witnessed) and none of the tag protocol. Voice output is never
parsed as game actions, so the character is told that this is talk only, and
nothing about building the prompt touches the game.

```ts setup
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Model } from "../lib/game/model.js";
import { entities } from "../lib/game/content/index.js";
import {
  CHARACTER_VOICES,
  conversablePeople,
  converseInstructions,
  voiceForPerson,
} from "../lib/game/converse.js";
import { REALTIME_VOICES, clientSecretRequest } from "../lib/realtime.js";
import { GEMINI_VOICES } from "../lib/geminilive.js";

// A real game, mid-story: the player in the atrium with the first mystery
// handed over, which gives Ama a history worth carrying.
const model = new Model(entities, { chat: async () => "" });
model.replaceLog(parse(readFileSync("playtest/checkpoints/briefed.yaml", "utf8")).events);
const ama = model.world.entities.Ama;
const text = converseInstructions(ama);
const has = (needle: string) => text.includes(needle);

const yes = (v: boolean) => (v ? "yes" : "no");
```

## Who is available

The same people the side panel lists (visible people in the player's room),
plus Ama, who is everywhere and is hidden from that list only because she has
no body. Alone in the atrium, that is Ama:

```ts
conversablePeople(model.world).map((p) => p.id).join(",");
=> Ama
```

When someone walks in, they are offered too. Folding a movement event into the
world is the same path a server turn takes, so the rule tracks the real room
contents rather than a copy:

``` continue
model.appendRemoteEvents([{
  id: "narrator", roomId: "Void", totalTime: 0, actions: [],
  changes: { Marta: { before: { inside: "Intake" }, after: { inside: model.world.entities.PLAYER.inside } } },
}]);
conversablePeople(model.world).map((p) => p.id).join(",");
=> Ama,Marta
```

## What the character is told

Who they are, who they are talking to, and where:

```ts
yes(has('You are voicing Ama (she/her)'));
=> yes

yes(has('known as "Ada Quill"'));
=> yes

yes(has("Ama is in The Hollow Atrium:"));
=> yes
```

Their own description and roleplay instructions, and their delivery note:

```ts
yes(has("Ama has no physical form") && has("passive-aggressive and deflective"));
=> yes

yes(has("Delivery: " + voiceForPerson("Ama").delivery));
=> yes
```

What they saw, as a plain transcript rather than the text engine's tags. The
briefed checkpoint ends with Ama handing over the Ink and Echo errand:

```ts
yes(has("<record>") && has('Ama (to Ada Quill): "Citizen, I have a small task'));
=> yes

yes(has("Ada Quill tries: Ada Quill attempts to unlock the door"));
=> yes
```

And no entity ids or tag markup in the situation or the record:

```ts
yes(has('id = "PLAYER"') || has("<dialog") || has("<description") || has("<intraActivity>"));
=> no
```

That this is talk with no effects, and that they are not an assistant:

```ts
yes(has("Talk only.") && has("not an assistant"));
=> yes
```

Ama has a conversational persona of her own, because her written instructions
alone come out sounding like a help desk. So does Marta. Frida's roleplay
notes already say what she is like to talk to, so she has none:

```ts
yes(has("<inConversation>") && has("She never asks how she can help."));
=> yes

yes(converseInstructions(model.world.entities.Marta).includes("treats the player as an audience"));
=> yes

yes(converseInstructions(model.world.entities.Frida).includes("<inConversation>"));
=> no
```

## What is left out

None of the text turn's protocol: no response format, no task list, no
context block, no suggestions. (Tags do appear inside the witnessed record,
where they mark who spoke; the instructions say that record is to read, not to
write.)

```ts
["<responseFormat>", "<taskList>", "<context>", "<suggestion>", "<set attr=", "<resolveMystery", "<todo>"]
  .filter(has).join(",") || "none";
=> none
```

No other character's private instructions. Marta's roleplay notes are Marta's:

```ts
yes(has("need for validation"));
=> no
```

No mystery hints, which are written for the text turn and carry both `<set>`
instructions and, in one case, the text of the thing the player is looking
for:

```ts
yes(has("MYSTERY:") || has("Sentra") || has("WOKEN CITIZEN"));
=> no
```

## Building it changes nothing

The prompt reads the world and appends nothing. The log is the same length,
and the player is where they were:

```ts
const fresh = new Model(entities, { chat: async () => "" });
fresh.replaceLog(parse(readFileSync("playtest/checkpoints/briefed.yaml", "utf8")).events);
const before = JSON.stringify([fresh.updates.value.length, fresh.world.entities.PLAYER.inside, fresh.world.timestampMinutes, fresh.world.todos]);
converseInstructions(fresh.world.entities.Ama);
converseInstructions(fresh.world.entities.Marta);
const after = JSON.stringify([fresh.updates.value.length, fresh.world.entities.PLAYER.inside, fresh.world.timestampMinutes, fresh.world.todos]);
yes(before === after);
=> yes
```

## Voices

Every character has a fixed voice per provider, from each API's built-in set,
so the same person sounds the same from one session to the next:

```ts
Object.values(CHARACTER_VOICES).every((v) => REALTIME_VOICES.includes(v.voice) && GEMINI_VOICES.includes(v.geminiVoice));
=> true

Object.keys(CHARACTER_VOICES).length;
=> 13

voiceForPerson("Ama").voice === voiceForPerson("Ama").voice;
=> true
```

Someone without an entry gets a plain default rather than an error:

```ts
JSON.stringify(voiceForPerson("nobody"));
=> {"voice":"alloy","geminiVoice":"Schedar","delivery":""}
```

## The session request

The prompt rides inside the client-secret request, along with the model and
the voice, so the character can speak as soon as the channel opens. Input
transcription is billed separately and is only asked for when asked for:

```ts
const body = clientSecretRequest({ model: "gpt-realtime-2.1-mini", voice: "marin", instructions: "Hello" });
const session = body.session as Record<string, any>;
[session.type, session.model, session.audio.output.voice, session.instructions, JSON.stringify(session.audio.input)].join(" | ");
=> realtime | gpt-realtime-2.1-mini | marin | Hello | {"turn_detection":{"type":"semantic_vad","eagerness":"low"}}

const transcribed = clientSecretRequest({ model: "gpt-realtime-2.1", voice: "ash", instructions: "Hi", transcribeInput: true });
(transcribed.session as any).audio.input.transcription.model;
=> gpt-4o-mini-transcribe
```

Turn-taking defaults to patient, because the API's own default answers half a
second into any pause, which sounds like an assistant filling silence. The
other two modes are explicit too, so a live switch back to quick sends a real
setting rather than nothing:

```ts
const quick = clientSecretRequest({ model: "gpt-realtime-2.1", voice: "ash", instructions: "Hi", turnTaking: "quick" });
JSON.stringify((quick.session as any).audio.input.turn_detection);
=> {"type":"server_vad"}

const slow = clientSecretRequest({ model: "gpt-realtime-2.1", voice: "ash", instructions: "Hi", turnTaking: "unhurried" });
JSON.stringify((slow.session as any).audio.input.turn_detection);
=> {"type":"server_vad","silence_duration_ms":1500,"prefix_padding_ms":300}
```
