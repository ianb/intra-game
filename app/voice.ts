/**
 * One spoken conversation with a character, and the small amount of state the
 * panel needs to show it.
 *
 * `VoiceSession` is the provider-neutral part: the signals the panel reads,
 * the transcript, the usage figures, and the end/fail bookkeeping. The OpenAI
 * Realtime session (WebRTC) is `VoiceConversation` below; the Gemini Live
 * session (WebSocket and raw PCM) is in geminivoice.ts. Both take every
 * browser API through a deps object, so the lifecycle runs in a test with
 * fakes.
 *
 * Kept apart from the prompt (lib/game/converse.ts) and from the panel
 * (voicepanel.tsx). Nothing here writes to the game: voice output never
 * reaches the tag parser or a turn, the transcript lives in memory in this
 * object, and the session ends when the object is ended.
 */

import { signal } from "@preact/signals-react";
import { persistentSignal } from "@/lib/persistentsignal";
import {
  redactKeys,
  sumUsage,
  turnDetectionFor,
  usageFromResponseDone,
  type ClientSecretResponse,
  type RealtimeSessionSpec,
  type ResponseUsage,
  type TurnTaking,
  type VoiceProvider,
} from "@/lib/realtime";
import type { GeminiSessionSpec } from "@/lib/geminilive";

export const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export type VoiceState =
  "idle" | "connecting" | "connected" | "ended" | "error";

export interface TranscriptLine {
  who: "player" | "character";
  text: string;
}

/** The browser, as this class needs it. `browserDeps()` is the real one. */
export interface VoiceDeps {
  getMicrophone(): Promise<MediaStream>;
  mintSecret(
    spec: RealtimeSessionSpec,
    apiKey: string,
  ): Promise<ClientSecretResponse>;
  createPeer(): RTCPeerConnection;
  /** POST the offer SDP with the client secret; resolves to the answer SDP. */
  connectCall(secret: string, offerSdp: string): Promise<string>;
  createAudio(): HTMLAudioElement;
  now(): number;
}

export type VoiceSessionSpec = RealtimeSessionSpec | GeminiSessionSpec;

export interface VoiceOptions {
  characterId: string;
  characterName: string;
  spec: VoiceSessionSpec;
  apiKey: string;
  /** Have the character say one line as soon as the channel opens. */
  openingLine?: boolean;
}

/** The instruction for the character's first line, when one is asked for. */
export function openingLineInstruction(characterName: string): string {
  return `Say one or two short sentences as ${characterName}, about what ${characterName} is doing or has noticed right now. Do not greet like a receptionist and do not offer help.`;
}

interface ServerEvent {
  type?: string;
  [key: string]: unknown;
}

/** What the panel needs from any provider's session. */
export abstract class VoiceSession {
  abstract readonly provider: VoiceProvider;
  /** Whether turn-taking can change mid-session, or needs a restart. */
  abstract readonly liveTurnTaking: boolean;

  readonly state = signal<VoiceState>("idle");
  readonly error = signal<string | null>(null);
  readonly endedBecause = signal<string | null>(null);
  readonly muted = signal(false);
  readonly transcript = signal<TranscriptLine[]>([]);
  readonly responses = signal<ResponseUsage[]>([]);
  readonly connectedAt = signal<number | null>(null);
  readonly characterSpeaking = signal(false);
  readonly playerSpeaking = signal(false);
  /** The last non-fatal complaint from the server, for the panel. */
  readonly notice = signal<string | null>(null);
  /**
   * Developer-facing trace of the connection: what was last sent, in
   * summary, and how it closed. For diagnosing a provider's refusal of
   * something this code sent, without a debugger on the player's machine.
   */
  readonly trace = signal<string[]>([]);

  protected note(line: string): void {
    const kept = this.trace.value.slice(-11);
    this.trace.value = [
      ...kept,
      `${new Date(this.clock()).toISOString().slice(11, 23)} ${line}`,
    ];
  }

  /**
   * Set once by end(), fail() or finish(), and checked after every await in
   * start(): a credential or an answer that arrives after the player ended
   * the conversation is dropped, so an ended session cannot come back.
   */
  protected closed = false;

  constructor(
    readonly options: VoiceOptions,
    protected readonly clock: () => number,
  ) {}

  abstract start(): Promise<void>;
  abstract setMuted(muted: boolean): void;
  /** No-op unless the provider supports it; see liveTurnTaking. */
  setTurnTaking(_mode: TurnTaking): void {}
  /** Let go of everything provider-specific, whatever state it is in. */
  protected abstract releaseResources(): void;

  get inProgress(): boolean {
    return (
      this.state.value === "connecting" || this.state.value === "connected"
    );
  }

  get released(): boolean {
    return this.closed;
  }

  elapsedSeconds(now = this.clock()): number {
    const from = this.connectedAt.value;
    return from === null ? 0 : Math.max(0, Math.floor((now - from) / 1000));
  }

  usage(): ResponseUsage {
    return sumUsage(this.responses.value);
  }

  /** The player ended it. Idempotent, and safe at any point of start(). */
  end(reason = "Ended."): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.release();
    if (this.state.value !== "error") {
      this.state.value = "ended";
      this.endedBecause.value = reason;
    }
  }

  protected markConnected(): void {
    this.state.value = "connected";
    this.connectedAt.value = this.clock();
  }

  protected addLine(who: TranscriptLine["who"], text: string): void {
    this.transcript.value = [...this.transcript.value, { who, text }];
  }

  protected addUsage(usage: ResponseUsage | null): void {
    if (usage) {
      this.responses.value = [...this.responses.value, usage];
    }
  }

  /** The server or the network ended it. */
  protected finish(reason: string): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.release();
    this.state.value = "ended";
    this.endedBecause.value = reason;
  }

  protected fail(message: string): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.release();
    this.error.value = message;
    this.state.value = "error";
  }

  private release(): void {
    this.characterSpeaking.value = false;
    this.playerSpeaking.value = false;
    this.releaseResources();
  }
}

/** OpenAI's Realtime API over WebRTC. */
export class VoiceConversation extends VoiceSession {
  readonly provider = "openai" as const;
  readonly liveTurnTaking = true;

  private mic: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  private partialLine = "";

  constructor(
    options: VoiceOptions,
    private readonly deps: VoiceDeps,
  ) {
    super(options, () => deps.now());
  }

  /** Call from a user gesture: the microphone prompt and audio playback need one. */
  async start(): Promise<void> {
    if (this.state.value !== "idle") {
      return;
    }
    this.state.value = "connecting";
    try {
      const mic = await this.deps.getMicrophone();
      if (this.closed) {
        stopTracks(mic);
        return;
      }
      this.mic = mic;
      if (this.options.spec.provider === "gemini") {
        throw new Error("This session is for OpenAI; the spec is for Gemini.");
      }
      const minted = await this.deps.mintSecret(
        this.options.spec,
        this.options.apiKey,
      );
      if (this.closed) {
        return;
      }
      const pc = this.deps.createPeer();
      this.pc = pc;
      const audio = this.deps.createAudio();
      this.audio = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
      };
      for (const track of mic.getAudioTracks()) {
        pc.addTrack(track, mic);
      }
      pc.onconnectionstatechange = () => {
        this.onPeerState(pc.connectionState);
      };
      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.onopen = () => {
        this.onChannelOpen();
      };
      dc.onmessage = (event) => {
        this.handleServerEvent(parseEvent(event.data));
      };
      dc.onclose = () => {
        this.finish("The connection closed.");
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (this.closed) {
        return;
      }
      const answer = await this.deps.connectCall(
        minted.secret,
        offer.sdp ?? "",
      );
      if (this.closed) {
        return;
      }
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (e) {
      if (!this.closed) {
        this.fail(describeStartError(e));
      }
    }
  }

  /**
   * Change how long the character waits before answering, mid-session.
   * Turn detection is one of the few session fields the API lets a live
   * session change, so this does not need a restart.
   */
  override setTurnTaking(mode: TurnTaking): void {
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        audio: { input: { turn_detection: turnDetectionFor(mode) } },
      },
    });
  }

  setMuted(muted: boolean): void {
    this.muted.value = muted;
    for (const track of this.mic?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  /**
   * One event from the server. Public so a test can feed events without a
   * data channel; the panel never calls it.
   */
  handleServerEvent(event: ServerEvent): void {
    if (this.closed) {
      return;
    }
    switch (event.type) {
      case "error": {
        const detail = (event.error as { message?: unknown } | undefined)
          ?.message;
        const message =
          typeof detail === "string"
            ? redactKeys(detail)
            : "The server reported an error.";
        // Not every error ends the session (asking for a response while one
        // is running is an error too). The connection state says when it is
        // really over; this only shows the message.
        this.notice.value = message;
        return;
      }
      case "input_audio_buffer.speech_started":
        this.playerSpeaking.value = true;
        this.characterSpeaking.value = false;
        return;
      case "input_audio_buffer.speech_stopped":
        this.playerSpeaking.value = false;
        return;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.characterSpeaking.value = true;
        this.partialLine += typeof event.delta === "string" ? event.delta : "";
        return;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text =
          typeof event.transcript === "string"
            ? event.transcript
            : this.partialLine;
        this.partialLine = "";
        if (text.trim()) {
          this.addLine("character", text.trim());
        }
        return;
      }
      case "conversation.item.input_audio_transcription.completed": {
        if (typeof event.transcript === "string" && event.transcript.trim()) {
          this.addLine("player", event.transcript.trim());
        }
        return;
      }
      case "response.done": {
        this.characterSpeaking.value = false;
        this.addUsage(usageFromResponseDone(event));
        const response = event.response as
          | {
              status?: string;
              status_details?: { error?: { message?: string } };
            }
          | undefined;
        if (response?.status === "failed") {
          this.notice.value = redactKeys(
            response.status_details?.error?.message ?? "The response failed.",
          );
        }
        return;
      }
      default:
        return;
    }
  }

  private onChannelOpen(): void {
    if (this.closed) {
      return;
    }
    this.markConnected();
    if (this.options.openingLine) {
      this.send({
        type: "response.create",
        response: {
          instructions: openingLineInstruction(this.options.characterName),
        },
      });
    }
  }

  private onPeerState(state: RTCPeerConnectionState): void {
    if (state === "failed") {
      this.fail("The connection to OpenAI failed.");
    } else if (state === "disconnected" || state === "closed") {
      this.finish("The connection ended.");
    }
  }

  private send(event: Record<string, unknown>): void {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(event));
    }
  }

  protected releaseResources(): void {
    const { dc, pc, mic, audio } = this;
    this.dc = null;
    this.pc = null;
    this.mic = null;
    this.audio = null;
    try {
      dc?.close();
    } catch {
      // Already closed.
    }
    try {
      pc?.close();
    } catch {
      // Already closed.
    }
    if (mic) {
      stopTracks(mic);
    }
    if (audio) {
      try {
        audio.pause();
      } catch {
        // Nothing was playing.
      }
      audio.srcObject = null;
    }
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function parseEvent(data: unknown): ServerEvent {
  if (typeof data !== "string") {
    return {};
  }
  try {
    return JSON.parse(data) as ServerEvent;
  } catch {
    return {};
  }
}

/** A sentence for what stopped the conversation from starting. */
export function describeStartError(e: unknown): string {
  const name = (e as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was denied. Allow the microphone and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found.";
  }
  if (name === "NotReadableError") {
    return "The microphone is in use by something else.";
  }
  const message = e instanceof Error ? e.message : String(e);
  return redactKeys(message || "Could not start the conversation.");
}

/** The real browser. */
export function browserDeps(): VoiceDeps {
  return {
    getMicrophone: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    mintSecret: async (spec, apiKey) => {
      const response = await fetch("/api/realtime/secret", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, ...spec }),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<
        ClientSecretResponse & { error: string }
      >;
      if (!response.ok || !data.secret) {
        throw new Error(
          data.error || `Could not get a session token (${response.status}).`,
        );
      }
      return data as ClientSecretResponse;
    },
    createPeer: () => new RTCPeerConnection(),
    connectCall: async (secret, offerSdp) => {
      const response = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        body: offerSdp,
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/sdp",
        },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `OpenAI refused the call: ${response.status} ${redactKeys(text).slice(0, 200)}`.trim(),
        );
      }
      return response.text();
    },
    createAudio: () => {
      const audio = new Audio();
      audio.autoplay = true;
      return audio;
    },
    now: () => Date.now(),
  };
}

// --- Page-level state ---------------------------------------------------------

/**
 * The player's OpenAI key, kept in this browser's localStorage so it survives
 * a reload. It goes nowhere else: not into a save, an export, the event log,
 * or a server session. "Clear key" in the panel removes it.
 */
export const openaiKey = persistentSignal("openaiKey", "");

/** Google's key, kept the same way. */
export const geminiKey = persistentSignal("geminiKey", "");

/** Which provider the panel starts sessions on; remembered in this browser. */
export const voiceProvider = persistentSignal<VoiceProvider>(
  "voiceProvider",
  "gemini",
);

/** The one conversation allowed at a time, or null. */
export const activeConversation = signal<VoiceSession | null>(null);

/** Whether a voice session is connecting or connected right now. */
export function conversationInProgress(): boolean {
  return activeConversation.value?.inProgress ?? false;
}

/**
 * Make a session the active one and start it, ending whatever was running
 * first. Two sessions at once would mean two microphones and two characters
 * talking over each other. The caller constructs the session, because which
 * class to build depends on the provider and this module does not import
 * the Gemini one.
 */
export function adoptConversation<T extends VoiceSession>(session: T): T {
  activeConversation.value?.end("Replaced by a new conversation.");
  activeConversation.value = session;
  void session.start();
  return session;
}

export function endConversation(reason = "Ended."): void {
  activeConversation.value?.end(reason);
}
