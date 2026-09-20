# Voice conversations (experiment)

A **Converse (voice)** row in the side panel's "here" tab starts a spoken
conversation with a character, on the player's own key, over either Google's
Gemini Live API (the default) or OpenAI's Realtime API. It exists to hear what
the cast sounds like. It has no effect on the game: nothing said out loud is
parsed as an action, the game refuses turns while a session is running, and
closing the panel returns to the same state.

## Where the pieces are

| Path                   | What                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `lib/game/converse.ts` | The character's spoken-session prompt, the voice maps, who is eligible |
| `lib/realtime.ts`      | Shared types, turn-taking modes, OpenAI shapes, usage figures          |
| `lib/geminilive.ts`    | Gemini Live shapes: token request, setup message, reading messages     |
| `worker/realtime.ts`   | `POST /api/realtime/secret`: the player's key in, a credential out     |
| `app/voice.ts`         | The provider-neutral session, and the OpenAI (WebRTC) session          |
| `app/geminivoice.ts`   | The Gemini (WebSocket) session                                         |
| `app/pcmaudio.ts`      | Raw PCM capture and playback in the browser, for Gemini                |
| `app/voicepanel.tsx`   | The panel and the Converse buttons                                     |
| `test/*.doctest.md`    | `converse`, `realtime`, `voice`, `geminilive`, `geminivoice`           |

The prompt and the media lifecycle do not know about each other. The panel
builds a session spec from the prompt and hands it to whichever session class
the provider needs.

## How a session runs

1. The panel asks for a key for the chosen provider if it has none. Keys are
   kept in this browser's localStorage (`openaiKey` and `geminiKey` in
   `app/voice.ts`) so they survive a reload, and nowhere else: not a save, an
   export, the log, or a server session. "Clear key" removes one.
2. **Start talking** requests the microphone, then posts the key and the
   session choices to `/api/realtime/secret`. The Worker makes one upstream
   call with the key and returns only a short-lived credential: an OpenAI
   client secret (which carries the session configuration), or a Gemini
   ephemeral token (single use, two-minute window to connect). The router
   logs method and path, never the body, and there is no fallback to the
   deployment's own credentials.
3. **OpenAI:** the browser opens a `RTCPeerConnection`, puts the mic track on
   it, opens a data channel named `oai-events`, and posts its SDP offer to
   `https://api.openai.com/v1/realtime/calls` with the secret. Audio comes
   back on the peer connection and plays through an `Audio` element.
   **Gemini:** the browser opens a WebSocket with the token, sends the setup
   (model, voice, the prompt as system instruction, transcription, activity
   detection, context compression), and on `setupComplete` starts an
   AudioWorklet that streams the microphone up as 16 kHz PCM. The character's
   voice comes back as 24 kHz PCM chunks and is scheduled on an AudioContext.
   An `interrupted` message flushes whatever has not played.
4. Server messages drive the transcript, the speaking indicators and the
   usage summary. The **Turn-taking** picker sets how long the character
   waits before answering; both APIs' defaults answer about half a second
   into any pause, which sounds like an assistant filling silence, so the
   default here is `patient`. OpenAI can change it mid-session; Gemini
   restarts the session, because activity detection is part of setup. Gemini
   also offers **proactive audio** (the model may decide not to answer) and
   **affective dialog** (delivery follows the player's tone), both on by
   default.
5. **End**, the close button, Escape, a character switch, or a provider,
   model or voice change ends the session: mic tracks stopped, sockets and
   peers closed, audio silenced. Nothing reconnects on its own. OpenAI
   sessions end at 60 minutes; Gemini sends a go-away warning before it
   closes a long session, which the panel shows.

Defaults: Google, `gemini-3.8-live`, with `gemini-3.8-live-extended-thinking`
selectable; OpenAI `gpt-realtime-2.1-mini`, with `gpt-realtime-2.1`
selectable. Anything the account cannot use is reported as such; nothing is
substituted.

## The prompt

`converseInstructions(person)` in `lib/game/converse.ts` builds the system
instruction from the character's description and roleplay instructions, an
optional per-character `persona` block (how they behave in conversation,
where the text prompt's instructions come out sounding like a help desk), a
delivery note, the situation (time, room, what Intra and the character are
doing, who else is here, the character's private attitudes), and a plain
transcript of what the character witnessed recently. Nothing from the text
engine's tag protocol is in it, and mystery hints are left out on purpose
(they carry `<set>` instructions and, in one case, the text of the thing the
player is looking for).

The voice maps, delivery notes and personas are drafts for auditioning and
are meant to be rewritten. Add a `persona` for any character who comes out
sounding like an assistant.

## Running it locally

```bash
cp .dev.vars.example .dev.vars   # if you have not already
pnpm dev                          # http://localhost:8787
```

`DEV_IDENTITY` in `.dev.vars` is enough: the secret endpoint sits behind the
same identity gate as the rest of `/api`, and local dev satisfies it. The game
itself can run on `DEV_FAKE_LLM`; the voice session does not go through the
game's model at all, so the text game being canned does not matter here.

Use a real browser tab (not a headless run) with a microphone, and expect a
permission prompt. Localhost counts as a secure context, so `getUserMedia`,
WebRTC and AudioWorklets work without HTTPS.

## Manual test script

Do these in order. Each one is a thing that has to hold before the experiment
means anything.

1. **Open the panel.** In the side panel's "here" tab, click 🎙 Ama. The panel
   should show the provider, model and voice pickers, the key field with its
   billing note, and a dimmed Start button with a hint.
2. **Enter a key.** Pick the provider, paste a real key for it (OpenAI's start with
   `sk-`; Google's vary), click Use key or just
   Start. The field is replaced by "… key set (ends in ····)" and a Clear
   button. Reload the page and confirm the key is still set; click Clear key
   and confirm it is gone from Application → Local Storage.
3. **Start.** Click Start talking, allow the microphone. Expect "Connecting
   to …" then "● Connected 0:00" with a running timer, and (with "Character
   speaks first" on) an opening line in Ama's voice within a couple of
   seconds. The browser tab shows its microphone indicator.
4. **Talk.** Ask her something. Ask her to give you an item, or to open a door,
   or what year it is. She should answer in character and not claim anything
   happened. Interrupt her mid-sentence: she should stop.
5. **Mute.** Click Mute, speak, nothing happens. Unmute, speak, she answers.
6. **Usage.** Open the Usage line under the transcript. Each report adds a
   row with input, cached, output and audio-output tokens. The timer is not a
   cost figure.
7. **End.** Click End conversation. The tab's microphone indicator goes away
   and the panel offers Start again. Click Start again and confirm a fresh
   session starts (timer from 0:00, empty transcript).
8. **Switch voice while connected.** Pick a different voice. The session ends
   and a new one starts with the new voice. Same for the model and the
   provider: try both providers on the same character, and
   `gemini-3.8-live-extended-thinking` or `gpt-realtime-2.1` for comparison,
   or confirm the panel reports a model as unavailable if the account lacks
   it.
9. **Switch character.** Walk (in text play) to a room with someone in it, or
   start from `?checkpoint=briefed` and go to the café. Click 🎙 on a person
   while a session with Ama is running. Ama's session ends and theirs begins.
   There must never be two microphone indicators or two voices at once.
10. **Cancel during connection.** Click Start, then Cancel before it connects.
    The microphone indicator must go away and the panel must show the ended
    state. Close during connection (× or Escape) must do the same.
11. **Deny the microphone.** With the browser set to block the mic, Start
    should show "Microphone access was denied" and the game should remain
    playable after closing the panel.
12. **The game did not move.** Note the clock, the room, the quest list and the
    last few transcript lines before a session. After ending it they are
    identical, and the next text turn works as usual. While a session is
    connecting or connected the panel covers the composer, and `playTurn`
    refuses with "End the voice conversation before playing a turn." if
    anything reaches it.
13. **Key hygiene.** With the panel open and a session running: in DevTools,
    the `/api/realtime/secret` request body carries the key and the response
    does not; on OpenAI the `/v1/realtime/calls` request uses an `ek_` bearer,
    and on Google the WebSocket URL carries an `auth_tokens/…` value, never
    the key. `wrangler dev`'s console shows `POST /api/realtime/secret` and
    nothing else about it. Save the game and grep the save for `sk-` and
    your Google key's first characters.
14. **Bad key.** Clear the key, enter `sk-invalid` (or a mangled Google key), Start. Expect "… rejected that API key" without the key repeated,
    and a released mic.
15. **Gemini specifics.** If "Connecting to Google..." shows a yellow note
    that Google does not accept some option for this model, that is the
    session dropping a setup field the server refused and reconnecting
    without it; the same field is left out for the rest of the page session.
    With Google selected: interrupt her mid-sentence and
    confirm playback stops at once (the `interrupted` flush). Leave a long
    pause with "May stay silent" on and confirm she does not fill it. Watch
    the usage rows: Google reports usage per message, so rows are more
    frequent than OpenAI's per-response rows. If the socket closes before
    the session starts with a message about the token or the method, the API
    version in `lib/geminilive.ts` (`GEMINI_API_VERSION`) is the first thing
    to try flipping between `v1beta` and `v1alpha`.

## Things left out on purpose

- **Mystery hints are not in the voice prompt.** See "The prompt" above.
- **No persistent memory.** A session starts from the game as it stands and
  its transcript is discarded with it.
- **No consequences.** By design for this branch; the eventual integration is
  a separate decision.
- **No session resumption.** Gemini can resume a session across reconnects;
  this prototype ends and offers Start again instead.
