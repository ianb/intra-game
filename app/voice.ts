/**
 * One spoken conversation with a character, over WebRTC to OpenAI's Realtime
 * API, and the small amount of state the panel needs to show it.
 *
 * Kept apart from the prompt (lib/game/converse.ts) and from the panel
 * (voicepanel.tsx): this file owns the microphone, the peer connection, the
 * data channel and the audio element, and nothing else does. Every browser
 * API it touches comes in through `VoiceDeps`, so the lifecycle can be run in
 * a test with fakes.
 *
 * Nothing here writes to the game. Voice output never reaches the tag parser
 * or a turn, the transcript lives in memory in this object, and the session
 * ends when the object is ended.
 */

import { signal } from "@preact/signals-react";
import {
  redactKeys,
  sumUsage,
  usageFromResponseDone,
  type ClientSecretResponse,
  type RealtimeSessionSpec,
  type ResponseUsage,
} from "@/lib/realtime";

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

export interface VoiceOptions {
  characterId: string;
  characterName: string;
  spec: RealtimeSessionSpec;
  apiKey: string;
  /** Have the character say one line as soon as the channel opens. */
  openingLine?: boolean;
}

interface ServerEvent {
  type?: string;
  [key: string]: unknown;
}

export class VoiceConversation {
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

  private mic: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  /**
   * Set once by end(), fail() or finish(), and checked after every await in
   * start(): a secret or an SDP answer that arrives after the player ended the
   * conversation is dropped, so an ended session cannot come back.
   */
  private closed = false;
  private partialLine = "";

  constructor(
    readonly options: VoiceOptions,
    private readonly deps: VoiceDeps,
  ) {}

  get inProgress(): boolean {
    return (
      this.state.value === "connecting" || this.state.value === "connected"
    );
  }

  get released(): boolean {
    return this.closed;
  }

  elapsedSeconds(now = this.deps.now()): number {
    const from = this.connectedAt.value;
    return from === null ? 0 : Math.max(0, Math.floor((now - from) / 1000));
  }

  usage(): ResponseUsage {
    return sumUsage(this.responses.value);
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

  setMuted(muted: boolean): void {
    this.muted.value = muted;
    for (const track of this.mic?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
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
        const usage = usageFromResponseDone(event);
        if (usage) {
          this.responses.value = [...this.responses.value, usage];
        }
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
    this.state.value = "connected";
    this.connectedAt.value = this.deps.now();
    if (this.options.openingLine) {
      this.send({
        type: "response.create",
        response: {
          instructions: `Say one short line to PLAYER to pick the conversation up, as ${this.options.characterName}.`,
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

  private addLine(who: TranscriptLine["who"], text: string): void {
    this.transcript.value = [...this.transcript.value, { who, text }];
  }

  /** The server or the network ended it. */
  private finish(reason: string): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.release();
    this.state.value = "ended";
    this.endedBecause.value = reason;
  }

  private fail(message: string): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.release();
    this.error.value = message;
    this.state.value = "error";
  }

  /** Let go of everything, whatever state it is in. */
  private release(): void {
    this.characterSpeaking.value = false;
    this.playerSpeaking.value = false;
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
 * The player's OpenAI key, for this page load only.
 *
 * A plain signal, not a persistentSignal: it must not reach localStorage, a
 * save, or an export. Reloading the page forgets it, which is the intent.
 */
export const openaiKey = signal("");

/** The one conversation allowed at a time, or null. */
export const activeConversation = signal<VoiceConversation | null>(null);

/** Whether a voice session is connecting or connected right now. */
export function conversationInProgress(): boolean {
  return activeConversation.value?.inProgress ?? false;
}

/**
 * Start a conversation, ending whatever was running first. Two sessions at
 * once would mean two microphones and two characters talking over each other.
 */
export function startConversation(
  options: VoiceOptions,
  deps: VoiceDeps = browserDeps(),
): VoiceConversation {
  activeConversation.value?.end("Replaced by a new conversation.");
  const conversation = new VoiceConversation(options, deps);
  activeConversation.value = conversation;
  void conversation.start();
  return conversation;
}

export function endConversation(reason = "Ended."): void {
  activeConversation.value?.end(reason);
}
