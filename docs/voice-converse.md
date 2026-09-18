# Voice conversations (experiment)

A **Converse (voice)** row in the side panel's "here" tab starts a spoken
conversation with a character over OpenAI's Realtime API, on the player's own
OpenAI key. It exists to hear what the cast sounds like. It has no effect on the
game: nothing said out loud is parsed as an action, the game refuses turns
while a session is running, and closing the panel returns to the same state.

## Where the pieces are

| Path                                                                            | What                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `lib/game/converse.ts`                                                          | The character's spoken-session prompt, the voice map, who is eligible |
| `lib/realtime.ts`                                                               | Models, voices, the client-secret request body, usage figures         |
| `worker/realtime.ts`                                                            | `POST /api/realtime/secret`: the player's key in, a client secret out |
| `app/voice.ts`                                                                  | One session's lifecycle: mic, peer connection, data channel, audio    |
| `app/voicepanel.tsx`                                                            | The panel and the Converse buttons                                    |
| `test/converse.doctest.md`, `test/realtime.doctest.md`, `test/voice.doctest.md` | The deterministic coverage                                            |

The prompt and the media lifecycle do not know about each other. The panel
builds a `RealtimeSessionSpec` from the prompt and hands it to the session.

## How a session runs

1. The panel asks for an OpenAI key if it has none. The key lives in a plain
   in-memory signal (`openaiKey` in `app/voice.ts`): not localStorage, not a
   save, not an export. Reloading forgets it; "Clear key" forgets it sooner.
2. **Start talking** requests the microphone, then posts the key, model, voice
   and prompt to `/api/realtime/secret`. The Worker forwards them in one call
   to `https://api.openai.com/v1/realtime/client_secrets` and returns only the
   short-lived secret. The router logs method and path, never the body, and
   there is no fallback to the deployment's own credentials.
3. The browser opens a `RTCPeerConnection`, puts the mic track on it, opens a
   data channel named `oai-events`, and posts its SDP offer to
   `https://api.openai.com/v1/realtime/calls` with the secret. Audio comes back
   on the peer connection and plays through an `Audio` element.
4. Server events over the data channel drive the transcript, the speaking
   indicators and the usage summary. Interruption is handled by the API's own
   turn detection over WebRTC. The **Turn-taking** picker sets how long the
   character waits before answering: the API's default (`quick`) answers
   about half a second into any pause, which sounds like an assistant filling
   silence, so the default here is `patient` (semantic VAD, low eagerness).
   It can be changed mid-session; model and voice cannot.
5. **End**, the close button, Escape, a character switch, or a model/voice
   change ends the session: mic tracks stopped, channel and peer closed, audio
   silenced. A model or voice change while connected restarts with the new
   choice, because neither can change inside a session. Nothing reconnects on
   its own.

The model is `gpt-realtime-2.1-mini` by default, with `gpt-realtime-2.1`
selectable before connecting. Anything the account cannot use is reported as
such; nothing is substituted.

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
permission prompt. Localhost counts as a secure context, so `getUserMedia` and
WebRTC work without HTTPS.

## Manual test script

Do these in order. Each one is a thing that has to hold before the experiment
means anything.

1. **Open the panel.** In the side panel's "here" tab, click 🎙 Ama. The panel
   should show the model and voice pickers, the key field with its billing
   note, and a disabled Start button.
2. **Enter a key.** Paste a real OpenAI key, click Use key. The field is
   replaced by "OpenAI key set (ends in ····)" and a Clear button. Reload the
   page later and confirm the key is gone.
3. **Start.** Click Start talking, allow the microphone. Expect "Connecting..."
   then "● Connected 0:00" with a running timer, and (with "Character speaks
   first" on) an opening line in Ama's voice within a couple of seconds. The
   browser tab shows its microphone indicator.
4. **Talk.** Ask her something. Ask her to give you an item, or to open a door,
   or what year it is. She should answer in character and not claim anything
   happened. Interrupt her mid-sentence: she should stop.
5. **Mute.** Click Mute, speak, nothing happens. Unmute, speak, she answers.
6. **Usage.** Open the Usage line under the transcript. Each response adds a
   row with input, cached, output and audio-output tokens. The timer is not a
   cost figure.
7. **End.** Click End conversation. The tab's microphone indicator goes away
   and the panel offers Start again. Click Start again and confirm a fresh
   session starts (timer from 0:00, empty transcript).
8. **Switch voice while connected.** Pick a different voice. The session ends
   and a new one starts with the new voice. Same for the model: try
   `gpt-realtime-2.1` and confirm the voice and the feel, or that the panel
   reports it as unavailable if the account lacks it.
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
    Application → Local Storage has no key; the `/api/realtime/secret` request
    body carries it and the response does not; the `/v1/realtime/calls`
    request uses an `ek_` bearer, not the key. `wrangler dev`'s console shows
    `POST /api/realtime/secret` and nothing else about it. Save the game and
    grep the save for `sk-`.
14. **Bad key.** Clear the key, enter `sk-invalid`, Start. Expect "OpenAI
    rejected that API key" without the key repeated, and a released mic.

## Things left out on purpose

- **Mystery hints are not in the voice prompt.** They are written for the text
  turn and carry `<set>` and `<resolveMystery>` instructions and, in one case,
  the text of the thing the player is looking for. A character talking about
  what they know of a mystery is a later job.
- **No persistent memory.** A session starts from the game as it stands and
  its transcript is discarded with it.
- **No consequences.** By design for this branch; the eventual integration is
  a separate decision.
- **The voice map, delivery notes and personas** in `lib/game/converse.ts`
  are drafts for auditioning and are meant to be rewritten. The persona block
  exists because Realtime models default to a help-desk manner; Ama's says
  what she is like to talk to (surveillance as affection, calm that does not
  change with the subject, certainty without argument). Add one for any
  character who comes out sounding like an assistant.
