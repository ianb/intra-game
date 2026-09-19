/**
 * The voice-conversation panel: pick a provider, model and voice, supply a
 * key, talk with one character, and see what it cost.
 *
 * A prototype for listening to the cast. It sits over the game and, while a
 * session is connecting or connected, the game refuses turns (see playTurn),
 * so nothing behind it can move. Closing it returns to the same game state.
 */

import { useEffect } from "react";
import { signal } from "@preact/signals-react";
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
  PROVIDER_NAMES,
  REALTIME_MODELS,
  REALTIME_VOICES,
  SESSION_LIMIT_MINUTES,
  TURN_TAKING,
  VOICE_PROVIDERS,
  isRealtimeModel,
  isRealtimeVoice,
  isTurnTaking,
  isVoiceProvider,
  type RealtimeModel,
  type RealtimeVoice,
  type ResponseUsage,
  type TurnTaking,
} from "@/lib/realtime";
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  GEMINI_VOICES,
  isGeminiModel,
  isGeminiVoice,
  type GeminiModel,
  type GeminiVoice,
} from "@/lib/geminilive";
import { model } from "./model";
import {
  activeConversation,
  adoptConversation,
  browserDeps,
  endConversation,
  geminiKey,
  openaiKey,
  voiceProvider,
  VoiceConversation,
  type VoiceSession,
  type VoiceSessionSpec,
} from "./voice";
import { GeminiVoiceConversation, geminiBrowserDeps } from "./geminivoice";

/** Which character the panel is open for, or null when closed. */
export const voicePanelFor = signal<string | null>(null);

/**
 * Choices kept across characters for the page session, so auditioning the
 * cast on one setup does not mean re-picking it for each person.
 */
const openaiModel = signal<RealtimeModel>(DEFAULT_REALTIME_MODEL);
const geminiModel = signal<GeminiModel>(DEFAULT_GEMINI_MODEL);
const openaiVoice = signal<RealtimeVoice>("alloy");
const geminiVoice = signal<GeminiVoice>("Schedar");
const transcribeInput = signal(false);
const openingLine = signal(true);
const turnTaking = signal<TurnTaking>(DEFAULT_TURN_TAKING);
/** Gemini only: the model may decide not to answer. */
const proactiveAudio = signal(true);
/** Gemini only: delivery follows the player's tone. */
const affectiveDialog = signal(true);
/** What is typed in the key field and not yet submitted; Start accepts it too. */
const keyDraft = signal("");
/** Why the last Start did nothing, shown beside the button. */
const startNotice = signal<string | null>(null);

const TURN_TAKING_LABELS: Record<TurnTaking, string> = {
  quick: "quick (answers half a second into a pause)",
  patient: "patient (waits for the end of a thought)",
  unhurried: "unhurried (waits a second and a half of silence)",
};

function keySignal() {
  return voiceProvider.value === "gemini" ? geminiKey : openaiKey;
}

/** Open the panel for a character, ending any conversation with another. */
export function openVoicePanel(person: Person): void {
  const wasTalking = activeConversation.value?.inProgress ?? false;
  if (voicePanelFor.value !== person.id) {
    endConversation("Switched character.");
    const voices = voiceForPerson(person.id);
    openaiVoice.value = voices.voice;
    geminiVoice.value = voices.geminiVoice;
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

function buildSpec(person: Person): VoiceSessionSpec {
  const instructions = converseInstructions(person);
  if (voiceProvider.value === "gemini") {
    return {
      provider: "gemini",
      model: geminiModel.value,
      voice: geminiVoice.value,
      instructions,
      transcribeInput: transcribeInput.value,
      turnTaking: turnTaking.value,
      proactiveAudio: proactiveAudio.value,
      affectiveDialog: affectiveDialog.value,
    };
  }
  return {
    provider: "openai",
    model: openaiModel.value,
    voice: openaiVoice.value,
    instructions,
    transcribeInput: transcribeInput.value,
    turnTaking: turnTaking.value,
  };
}

/** Start (or restart) the session for a character with the current choices. */
function begin(person: Person): void {
  const key = keySignal();
  // A key typed into the field but not yet submitted counts: pressing Start
  // was the intent, and a Start that silently does nothing looks broken.
  if (!key.value.trim() && keyDraft.value.trim()) {
    key.value = keyDraft.value.trim();
    keyDraft.value = "";
  }
  const apiKey = key.value.trim();
  if (!apiKey) {
    startNotice.value = `Enter your ${PROVIDER_NAMES[voiceProvider.value]} key first.`;
    return;
  }
  startNotice.value = null;
  const options = {
    characterId: person.id,
    characterName: person.name,
    apiKey,
    openingLine: openingLine.value,
    spec: buildSpec(person),
  };
  adoptConversation(
    options.spec.provider === "gemini"
      ? new GeminiVoiceConversation(options, geminiBrowserDeps())
      : new VoiceConversation(options, browserDeps()),
  );
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
        <Options person={person} conversation={mine} />
        <KeyEntry />
        <Controls person={person} conversation={mine} />
        {mine && <Transcript conversation={mine} />}
        {mine && <UsageSummary conversation={mine} />}
      </div>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  accept,
  onChange,
  labels,
}: {
  label: string;
  value: T;
  options: readonly T[];
  accept: (value: unknown) => value is T;
  onChange: (value: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-gray-400 text-xs">{label}</span>
      <select
        className="bg-gray-800 p-1"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (accept(next)) {
            onChange(next);
          }
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels ? labels[option] : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-300">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}

/** Provider, model, voice and behaviour choices. Changing one mid-session restarts it. */
function Options({
  person,
  conversation,
}: {
  person: Person;
  conversation: VoiceSession | null;
}) {
  useSignals();
  const busy = conversation?.inProgress ?? false;
  const restartIfBusy = () => {
    if (busy) {
      begin(person);
    }
  };
  const gemini = voiceProvider.value === "gemini";
  const defaults = voiceForPerson(person.id);
  return (
    <div className="flex flex-wrap gap-4 mb-3 items-end">
      <Select
        label="Provider"
        value={voiceProvider.value}
        options={VOICE_PROVIDERS}
        accept={isVoiceProvider}
        labels={PROVIDER_NAMES}
        onChange={(value) => {
          voiceProvider.value = value;
          restartIfBusy();
        }}
      />
      {gemini ? (
        <Select
          label="Model"
          value={geminiModel.value}
          options={GEMINI_MODELS}
          accept={isGeminiModel}
          onChange={(value) => {
            geminiModel.value = value;
            restartIfBusy();
          }}
        />
      ) : (
        <Select
          label="Model"
          value={openaiModel.value}
          options={REALTIME_MODELS}
          accept={isRealtimeModel}
          onChange={(value) => {
            openaiModel.value = value;
            restartIfBusy();
          }}
        />
      )}
      {gemini ? (
        <Select
          label={`Voice (default for ${person.name}: ${defaults.geminiVoice})`}
          value={geminiVoice.value}
          options={GEMINI_VOICES}
          accept={isGeminiVoice}
          onChange={(value) => {
            geminiVoice.value = value;
            restartIfBusy();
          }}
        />
      ) : (
        <Select
          label={`Voice (default for ${person.name}: ${defaults.voice})`}
          value={openaiVoice.value}
          options={REALTIME_VOICES}
          accept={isRealtimeVoice}
          onChange={(value) => {
            openaiVoice.value = value;
            restartIfBusy();
          }}
        />
      )}
      <Select
        label="Turn-taking"
        value={turnTaking.value}
        options={TURN_TAKING}
        accept={isTurnTaking}
        labels={TURN_TAKING_LABELS}
        onChange={(value) => {
          turnTaking.value = value;
          if (conversation?.liveTurnTaking) {
            conversation.setTurnTaking(value);
          } else {
            restartIfBusy();
          }
        }}
      />
      <Check
        label="Transcribe my speech (billed separately on OpenAI)"
        value={transcribeInput.value}
        disabled={busy}
        onChange={(value) => {
          transcribeInput.value = value;
        }}
      />
      <Check
        label="Character speaks first"
        value={openingLine.value}
        disabled={busy}
        onChange={(value) => {
          openingLine.value = value;
        }}
      />
      {gemini && (
        <Check
          label="May stay silent (proactive audio)"
          value={proactiveAudio.value}
          onChange={(value) => {
            proactiveAudio.value = value;
            restartIfBusy();
          }}
        />
      )}
      {gemini && (
        <Check
          label="Reacts to my tone (affective dialog)"
          value={affectiveDialog.value}
          onChange={(value) => {
            affectiveDialog.value = value;
            restartIfBusy();
          }}
        />
      )}
    </div>
  );
}

function KeyEntry() {
  useSignals();
  const provider = voiceProvider.value;
  const who = PROVIDER_NAMES[provider];
  const key = keySignal();
  if (key.value) {
    return (
      <div className="mb-3 text-xs text-gray-300 flex items-center gap-2">
        <span>
          {who} key set (ends in {key.value.slice(-4)}), saved in this browser.
        </span>
        <Button
          className="p-1 text-xs bg-gray-700 hover:bg-gray-600"
          onClick={() => {
            key.value = "";
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
        Voice conversations run on your own {who} account and are billed to it.
        The key is saved in this browser only; the game server uses it once per
        conversation to open the connection and does not keep it. Nothing about
        it goes into saved games. This is separate from any OpenRouter key.
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          placeholder={provider === "gemini" ? "AIza..." : "sk-..."}
          className="flex-1 bg-gray-800 p-1"
          value={keyDraft.value}
          onInput={(event) => {
            keyDraft.value = (event.target as HTMLInputElement).value;
          }}
        />
        <Button
          className="p-1"
          disabled={!keyDraft.value.trim()}
          onClick={() => {
            key.value = keyDraft.value.trim();
            keyDraft.value = "";
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
  conversation: VoiceSession | null;
}) {
  useSignals();
  const hasKey = !!keySignal().value.trim() || !!keyDraft.value.trim();
  const state = conversation?.state.value ?? "idle";
  const start = (
    <span className="flex items-center gap-2">
      <Button
        className={twMerge("bg-blue-700", !hasKey && "opacity-50")}
        disabled={!hasKey}
        title={hasKey ? "" : "Enter a key first"}
        onClick={() => {
          begin(person);
        }}
      >
        {state === "idle" ? "🎙 Start talking" : "🎙 Start again"}
      </Button>
      {!hasKey && (
        <span className="text-xs text-gray-400">
          Enter your key above first.
        </span>
      )}
      {startNotice.value && (
        <span className="text-xs text-yellow-300">{startNotice.value}</span>
      )}
    </span>
  );
  if (!conversation || state === "idle") {
    return <div className="mb-3">{start}</div>;
  }
  if (state === "connecting") {
    return (
      <div className="mb-3 flex items-center gap-3">
        <span className="text-yellow-300">
          Connecting to {PROVIDER_NAMES[conversation.provider]}...
        </span>
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
          {PROVIDER_NAMES[conversation.provider]} ·{" "}
          {conversation.options.spec.model} · {conversation.options.spec.voice}
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
        {conversation.provider === "openai"
          ? `Sessions end on their own after ${SESSION_LIMIT_MINUTES} minutes.`
          : "Google may end a long session on its own; it warns first."}
      </div>
      {start}
    </div>
  );
}

/** Ticks once a second while a timer is on screen; 0 means not yet read. */
const clock = signal(0);

function Elapsed({ conversation }: { conversation: VoiceSession }) {
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

function Transcript({ conversation }: { conversation: VoiceSession }) {
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

function UsageSummary({ conversation }: { conversation: VoiceSession }) {
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
        Usage: {responses.length} report{responses.length === 1 ? "" : "s"},{" "}
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
        As reported by the API, one row per report. Connected time above is not
        a dollar figure.
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
