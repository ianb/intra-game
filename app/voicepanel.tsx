/**
 * The voice-conversation panel: pick a model and a voice, supply an OpenAI
 * key, talk with one character, and see what it cost.
 *
 * A prototype for listening to the cast. It sits over the game and, while a
 * session is connecting or connected, the game refuses turns (see playTurn),
 * so nothing behind it can move. Closing it returns to the same game state.
 */

import { useEffect } from "react";
import { signal, useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/input";
import type { Person } from "@/lib/game/classes";
import {
  conversablePeople,
  converseInstructions,
  voiceForPerson,
} from "@/lib/game/converse";
import {
  DEFAULT_REALTIME_MODEL,
  DEFAULT_TURN_TAKING,
  REALTIME_MODELS,
  REALTIME_VOICES,
  SESSION_LIMIT_MINUTES,
  TURN_TAKING,
  isRealtimeModel,
  isRealtimeVoice,
  isTurnTaking,
  type RealtimeModel,
  type RealtimeVoice,
  type ResponseUsage,
  type TurnTaking,
} from "@/lib/realtime";
import { model } from "./model";
import {
  activeConversation,
  endConversation,
  openaiKey,
  startConversation,
  type VoiceConversation,
} from "./voice";

/** Which character the panel is open for, or null when closed. */
export const voicePanelFor = signal<string | null>(null);

/**
 * Choices kept across characters for the page session, so auditioning the
 * cast on one model does not mean re-picking it for each person.
 */
const selectedModel = signal<RealtimeModel>(DEFAULT_REALTIME_MODEL);
const selectedVoice = signal<RealtimeVoice>("alloy");
const transcribeInput = signal(false);
const openingLine = signal(true);
const turnTaking = signal<TurnTaking>(DEFAULT_TURN_TAKING);

const TURN_TAKING_LABELS: Record<TurnTaking, string> = {
  quick: "quick (answers half a second into a pause)",
  patient: "patient (waits for the end of a thought)",
  unhurried: "unhurried (waits a second and a half of silence)",
};

/** Open the panel for a character, ending any conversation with another. */
export function openVoicePanel(person: Person): void {
  const wasTalking = activeConversation.value?.inProgress ?? false;
  if (voicePanelFor.value !== person.id) {
    endConversation("Switched character.");
    selectedVoice.value = voiceForPerson(person.id).voice;
  }
  voicePanelFor.value = person.id;
  if (wasTalking) {
    begin(person);
  }
}

export function closeVoicePanel(): void {
  endConversation("Closed.");
  voicePanelFor.value = null;
}

/** Start (or restart) the session for a character with the current choices. */
function begin(person: Person): void {
  const key = openaiKey.value.trim();
  if (!key) {
    return;
  }
  startConversation({
    characterId: person.id,
    characterName: person.name,
    apiKey: key,
    openingLine: openingLine.value,
    spec: {
      model: selectedModel.value,
      voice: selectedVoice.value,
      instructions: converseInstructions(person),
      transcribeInput: transcribeInput.value,
      turnTaking: turnTaking.value,
    },
  });
}

/** The row of people the player can talk with out loud, for the side panel. */
export function ConverseButtons() {
  useSignals();
  void model.updates.value;
  const people = conversablePeople(model.world);
  return (
    <div className="mt-2 text-sm">
      <span className="text-gray-400">Converse (voice): </span>
      {people.map((person) => (
        <Button
          key={person.id}
          className={twMerge(
            "p-0 mr-2 bg-inherit hover:bg-gray-700",
            person.color,
          )}
          title={`Talk with ${person.name} out loud`}
          onClick={() => {
            openVoicePanel(person);
          }}
        >
          🎙 {person.name}
        </Button>
      ))}
    </div>
  );
}

export function VoicePanel() {
  useSignals();
  const id = voicePanelFor.value;
  const conversation = activeConversation.value;
  useEffect(() => {
    if (!id) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeVoicePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [id]);
  if (!id) {
    return null;
  }
  const person = model.world.getPerson(id);
  if (!person) {
    return null;
  }
  // A conversation object outlives a character switch only until the next
  // start; one for a different character is shown as nothing.
  const mine =
    conversation && conversation.options.characterId === id
      ? conversation
      : null;
  const busy = mine?.inProgress ?? false;
  const restartIfBusy = () => {
    if (busy) {
      begin(person);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border border-gray-600 rounded p-4 text-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="text-lg">
            Talking with <span className={person.color}>{person.name}</span>
          </div>
          <button
            className="text-2xl px-2 hover:text-red-400"
            title="End and close"
            onClick={closeVoicePanel}
          >
            &times;
          </button>
        </div>

        <div className="flex flex-wrap gap-4 mb-3 items-end">
          <label className="flex flex-col">
            <span className="text-gray-400 text-xs">Model</span>
            <select
              className="bg-gray-800 p-1"
              value={selectedModel.value}
              onChange={(event) => {
                const value = event.target.value;
                if (isRealtimeModel(value)) {
                  selectedModel.value = value;
                  restartIfBusy();
                }
              }}
            >
              {REALTIME_MODELS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-gray-400 text-xs">
              Voice (default for {person.name}: {voiceForPerson(id).voice})
            </span>
            <select
              className="bg-gray-800 p-1"
              value={selectedVoice.value}
              onChange={(event) => {
                const value = event.target.value;
                if (isRealtimeVoice(value)) {
                  selectedVoice.value = value;
                  restartIfBusy();
                }
              }}
            >
              {REALTIME_VOICES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-gray-400 text-xs">Turn-taking</span>
            <select
              className="bg-gray-800 p-1"
              value={turnTaking.value}
              onChange={(event) => {
                const value = event.target.value;
                if (isTurnTaking(value)) {
                  turnTaking.value = value;
                  // Changeable live, unlike model and voice.
                  mine?.setTurnTaking(value);
                }
              }}
            >
              {TURN_TAKING.map((mode) => (
                <option key={mode} value={mode}>
                  {TURN_TAKING_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={transcribeInput.value}
              disabled={busy}
              onChange={(event) => {
                transcribeInput.value = event.target.checked;
              }}
            />
            Transcribe my speech (billed separately)
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={openingLine.value}
              disabled={busy}
              onChange={(event) => {
                openingLine.value = event.target.checked;
              }}
            />
            Character speaks first
          </label>
        </div>

        <KeyEntry />

        <Controls person={person} conversation={mine} />

        {mine && <Transcript conversation={mine} />}
        {mine && <UsageSummary conversation={mine} />}
      </div>
    </div>
  );
}

function KeyEntry() {
  useSignals();
  const draft = useSignal("");
  const key = openaiKey.value;
  if (key) {
    return (
      <div className="mb-3 text-xs text-gray-300 flex items-center gap-2">
        <span>
          OpenAI key set (ends in {key.slice(-4)}), kept in memory until this
          page reloads.
        </span>
        <Button
          className="p-1 text-xs bg-gray-700 hover:bg-gray-600"
          onClick={() => {
            openaiKey.value = "";
          }}
        >
          Clear key
        </Button>
      </div>
    );
  }
  return (
    <div className="mb-3 border border-gray-700 rounded p-2">
      <div className="text-xs text-gray-300 mb-1">
        Voice conversations run on your own OpenAI account and are billed to it.
        The key stays in this page&apos;s memory; the game server uses it once
        to open the connection and does not save it. Nothing about it goes into
        saved games. This is separate from any OpenRouter key.
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          placeholder="sk-..."
          className="flex-1 bg-gray-800 p-1"
          value={draft.value}
          onInput={(event) => {
            draft.value = (event.target as HTMLInputElement).value;
          }}
        />
        <Button
          className="p-1"
          disabled={!draft.value.trim()}
          onClick={() => {
            openaiKey.value = draft.value.trim();
            draft.value = "";
          }}
        >
          Use key
        </Button>
      </div>
    </div>
  );
}

function Controls({
  person,
  conversation,
}: {
  person: Person;
  conversation: VoiceConversation | null;
}) {
  useSignals();
  const hasKey = !!openaiKey.value.trim();
  const state = conversation?.state.value ?? "idle";
  const start = (
    <Button
      className="bg-blue-700"
      disabled={!hasKey}
      title={hasKey ? "" : "Enter an OpenAI key first"}
      onClick={() => {
        begin(person);
      }}
    >
      {state === "idle" ? "🎙 Start talking" : "🎙 Start again"}
    </Button>
  );
  if (!conversation || state === "idle") {
    return <div className="mb-3">{start}</div>;
  }
  if (state === "connecting") {
    return (
      <div className="mb-3 flex items-center gap-3">
        <span className="text-yellow-300">Connecting...</span>
        <Button
          className="bg-gray-700"
          onClick={() => {
            conversation.end("Cancelled.");
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }
  if (state === "connected") {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-green-300">
          ● Connected <Elapsed conversation={conversation} />
        </span>
        <span className="text-xs text-gray-400">
          {conversation.playerSpeaking.value
            ? "hearing you"
            : conversation.characterSpeaking.value
              ? `${person.name} is speaking`
              : "listening"}
        </span>
        <Button
          className={conversation.muted.value ? "bg-yellow-700" : "bg-gray-700"}
          onClick={() => {
            conversation.setMuted(!conversation.muted.value);
          }}
        >
          {conversation.muted.value ? "Unmute" : "Mute"}
        </Button>
        <Button
          className="bg-red-800"
          onClick={() => {
            conversation.end("Ended.");
          }}
        >
          End conversation
        </Button>
        {conversation.notice.value && (
          <span className="text-xs text-yellow-300 w-full">
            {conversation.notice.value}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="mb-3">
      <div
        className={twMerge(
          "mb-2",
          state === "error" ? "text-red-400" : "text-gray-300",
        )}
      >
        {state === "error"
          ? conversation.error.value
          : `Conversation over: ${conversation.endedBecause.value ?? ""}`}
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Sessions end on their own after {SESSION_LIMIT_MINUTES} minutes.
      </div>
      {start}
    </div>
  );
}

/** Ticks once a second while a timer is on screen; 0 means not yet read. */
const clock = signal(0);

function Elapsed({ conversation }: { conversation: VoiceConversation }) {
  useSignals();
  useEffect(() => {
    clock.value = Date.now();
    const timer = setInterval(() => {
      clock.value = Date.now();
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  const total = clock.value ? conversation.elapsedSeconds(clock.value) : 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return (
    <span className="tabular-nums" title="Connected time; not a cost meter">
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}

function Transcript({ conversation }: { conversation: VoiceConversation }) {
  useSignals();
  const lines = conversation.transcript.value;
  if (!lines.length) {
    return null;
  }
  return (
    <div className="mb-3 max-h-48 overflow-y-auto border border-gray-800 rounded p-2 text-xs">
      <div className="text-gray-500 mb-1">
        Transcript, for this session only. Not part of the game.
      </div>
      {lines.map((line, i) => (
        <div key={i} className={line.who === "player" ? "text-gray-300" : ""}>
          <span className="text-gray-500">
            {line.who === "player" ? "you" : conversation.options.characterName}
            :
          </span>{" "}
          {line.text}
        </div>
      ))}
    </div>
  );
}

function UsageSummary({ conversation }: { conversation: VoiceConversation }) {
  useSignals();
  const responses = conversation.responses.value;
  if (!responses.length) {
    return null;
  }
  const total = conversation.usage();
  const cell = (label: string, value: number) => (
    <span className="mr-3">
      <span className="text-gray-500">{label}</span> {value}
    </span>
  );
  return (
    <details className="text-xs text-gray-300">
      <summary className="cursor-pointer text-gray-400">
        Usage: {responses.length} response{responses.length === 1 ? "" : "s"},{" "}
        {total.inputTokens} in / {total.outputTokens} out tokens
      </summary>
      <div className="mt-1">
        {cell("input", total.inputTokens)}
        {cell("cached", total.cachedTokens)}
        {cell("input text", total.inputText)}
        {cell("input audio", total.inputAudio)}
        {cell("output", total.outputTokens)}
        {cell("output text", total.outputText)}
        {cell("output audio", total.outputAudio)}
      </div>
      <div className="mt-1 text-gray-500">
        As reported by the API per response. Connected time above is not a
        dollar figure.
      </div>
      <table className="mt-1">
        <tbody>
          {responses.map((usage: ResponseUsage, i) => (
            <tr key={i}>
              <td className="pr-2 text-gray-500">#{i + 1}</td>
              <td className="pr-2">in {usage.inputTokens}</td>
              <td className="pr-2">cached {usage.cachedTokens}</td>
              <td className="pr-2">out {usage.outputTokens}</td>
              <td>audio out {usage.outputAudio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
