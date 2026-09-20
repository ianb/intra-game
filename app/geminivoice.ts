/**
 * A spoken conversation over Gemini Live: a WebSocket carrying JSON, with
 * the player's microphone streamed up as 16 kHz PCM and the character's
 * voice streamed down as 24 kHz PCM. See app/voice.ts for the shared part and
 * app/pcmaudio.ts for the audio plumbing.
 */

import { redactKeys, type ClientSecretResponse } from "@/lib/realtime";
import {
  GEMINI_INPUT_RATE,
  GEMINI_OPTIONAL_SETUP_FIELDS,
  GEMINI_OUTPUT_RATE,
  GEMINI_SETUP_FIELD_LABELS,
  geminiAudioMessage,
  geminiSetupMessage,
  geminiSocketUrl,
  geminiTextTurn,
  readGeminiMessage,
  unknownSetupField,
  type GeminiSessionSpec,
} from "@/lib/geminilive";
import {
  createPcmPlayer,
  startPcmCapture,
  type PcmCapture,
  type PcmPlayer,
} from "./pcmaudio";
import {
  describeStartError,
  openingLineInstruction,
  VoiceSession,
  type VoiceOptions,
} from "./voice";

/** The part of a WebSocket this class uses, so a test can fake one. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onerror: (() => void) | null;
}

export interface GeminiDeps {
  getMicrophone(): Promise<MediaStream>;
  mintSecret(
    spec: GeminiSessionSpec,
    apiKey: string,
  ): Promise<ClientSecretResponse>;
  openSocket(url: string): SocketLike;
  startCapture(
    stream: MediaStream,
    onChunk: (base64: string) => void,
  ): Promise<PcmCapture>;
  createPlayer(): PcmPlayer;
  now(): number;
}

/**
 * Setup fields Google has refused during this page session, so later
 * sessions leave them out from the start instead of paying the reconnect.
 * Which fields a model or the ephemeral-token method accepts is not
 * documented reliably; the server's own refusal is the source of truth.
 */
export const rejectedSetupFields = new Set<string>();

export class GeminiVoiceConversation extends VoiceSession {
  readonly provider = "gemini" as const;
  /** Activity detection is part of setup; changing it means a new session. */
  readonly liveTurnTaking = false;

  private mic: MediaStream | null = null;
  private socket: SocketLike | null = null;
  private capture: PcmCapture | null = null;
  private player: PcmPlayer | null = null;
  private setupDone = false;
  /** Reconnects after a refused setup field; bounded so a bad model cannot loop. */
  private reconnects = 0;
  private partialCharacter = "";
  private partialPlayer = "";
  /** Messages are handled in order even when one arrives as a Blob. */
  private inbound: Promise<void> = Promise.resolve();

  constructor(
    options: VoiceOptions,
    private readonly deps: GeminiDeps,
  ) {
    super(options, () => deps.now());
  }

  private get spec(): GeminiSessionSpec {
    if (this.options.spec.provider !== "gemini") {
      throw new Error("This session is for Gemini; the spec is for OpenAI.");
    }
    return this.options.spec;
  }

  async start(): Promise<void> {
    if (this.state.value !== "idle") {
      return;
    }
    this.state.value = "connecting";
    try {
      const spec = this.spec;
      const mic = await this.deps.getMicrophone();
      if (this.closed) {
        stopTracks(mic);
        return;
      }
      this.mic = mic;
      await this.connect(spec);
    } catch (e) {
      if (!this.closed) {
        this.fail(describeStartError(e));
      }
    }
  }

  /**
   * Mint a token and open the socket. Called once by start(), and again if
   * Google refuses a setup field: the token is single-use, so a retry needs
   * a fresh one, and the microphone is kept across the retry.
   */
  private async connect(spec: GeminiSessionSpec): Promise<void> {
    const minted = await this.deps.mintSecret(spec, this.options.apiKey);
    if (this.closed) {
      return;
    }
    const socket = this.deps.openSocket(geminiSocketUrl(minted.secret));
    this.socket = socket;
    socket.onopen = () => {
      if (!this.closed && this.socket === socket) {
        socket.send(
          JSON.stringify(geminiSetupMessage(spec, rejectedSetupFields)),
        );
      }
    };
    socket.onmessage = (event) => {
      if (this.socket === socket) {
        this.inbound = this.inbound.then(() => this.receive(event.data));
      }
    };
    socket.onerror = () => {
      if (!this.closed && this.socket === socket) {
        this.notice.value = "The connection to Google reported an error.";
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) {
        return;
      }
      const why = event.reason ? redactKeys(event.reason) : "";
      if (this.setupDone) {
        this.finish(
          why ? `The connection ended: ${why}` : "The connection ended.",
        );
        return;
      }
      const field = unknownSetupField(event.reason);
      if (
        field &&
        GEMINI_OPTIONAL_SETUP_FIELDS.has(field) &&
        !rejectedSetupFields.has(field) &&
        this.reconnects < 3
      ) {
        rejectedSetupFields.add(field);
        this.reconnects += 1;
        this.notice.value = `Google does not accept ${GEMINI_SETUP_FIELD_LABELS[field] ?? field} for this model; continuing without it.`;
        this.socket = null;
        this.connect(spec).catch((e: unknown) => {
          if (!this.closed) {
            this.fail(describeStartError(e));
          }
        });
        return;
      }
      this.fail(
        `Google closed the connection before the session started${event.code ? ` (${event.code}${why ? `: ${why}` : ""})` : ""}.`,
      );
    };
  }

  setMuted(muted: boolean): void {
    this.muted.value = muted;
    this.capture?.setMuted(muted);
    for (const track of this.mic?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  /** One message from the server, string or Blob. Public for tests. */
  async receive(data: unknown): Promise<void> {
    if (this.closed) {
      return;
    }
    let text: string;
    if (typeof data === "string") {
      text = data;
    } else if (data && typeof (data as Blob).text === "function") {
      text = await (data as Blob).text();
    } else {
      return;
    }
    if (this.closed) {
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    await this.handle(message);
  }

  private async handle(message: unknown): Promise<void> {
    const event = readGeminiMessage(message);
    if (event.setupComplete && !this.setupDone) {
      this.setupDone = true;
      await this.beginStreaming();
      return;
    }
    if (event.interrupted) {
      this.player?.flush();
      this.characterSpeaking.value = false;
      this.partialCharacter = "";
    }
    if (event.audio.length && this.player) {
      if (!this.characterSpeaking.value) {
        this.commitPlayerLine();
      }
      this.characterSpeaking.value = true;
      for (const chunk of event.audio) {
        this.player.play(chunk);
      }
    }
    if (event.outputTranscript) {
      this.partialCharacter += event.outputTranscript;
    }
    if (event.inputTranscript) {
      this.partialPlayer += event.inputTranscript;
      this.playerSpeaking.value = true;
    }
    if (event.turnComplete) {
      this.characterSpeaking.value = false;
      this.commitCharacterLine();
    }
    this.addUsage(event.usage);
    if (event.goAwaySeconds !== null) {
      this.notice.value = `Google will end this session in about ${Math.round(event.goAwaySeconds)} seconds.`;
    }
  }

  /** Setup is acknowledged: start the microphone stream and the speaker. */
  private async beginStreaming(): Promise<void> {
    const mic = this.mic;
    const socket = this.socket;
    if (!mic || !socket || this.closed) {
      return;
    }
    this.player = this.deps.createPlayer();
    const capture = await this.deps.startCapture(mic, (base64) => {
      if (!this.closed && this.socket === socket) {
        socket.send(JSON.stringify(geminiAudioMessage(base64)));
      }
    });
    if (this.closed) {
      capture.stop();
      return;
    }
    this.capture = capture;
    capture.setMuted(this.muted.value);
    this.markConnected();
    if (this.options.openingLine) {
      socket.send(
        JSON.stringify(
          geminiTextTurn(
            `(${openingLineInstruction(this.options.characterName)})`,
          ),
        ),
      );
    }
  }

  private commitCharacterLine(): void {
    const text = this.partialCharacter.trim();
    this.partialCharacter = "";
    if (text) {
      this.addLine("character", text);
    }
  }

  private commitPlayerLine(): void {
    const text = this.partialPlayer.trim();
    this.partialPlayer = "";
    this.playerSpeaking.value = false;
    if (text) {
      this.addLine("player", text);
    }
  }

  protected releaseResources(): void {
    const { socket, capture, player, mic } = this;
    this.socket = null;
    this.capture = null;
    this.player = null;
    this.mic = null;
    try {
      capture?.stop();
    } catch {
      // Already stopped.
    }
    try {
      player?.close();
    } catch {
      // Already closed.
    }
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // Already closed.
      }
    }
    if (mic) {
      stopTracks(mic);
    }
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/** The real browser. */
export function geminiBrowserDeps(): GeminiDeps {
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
    openSocket: (url) => {
      // Adapted rather than used directly: WebSocket's handlers carry a
      // `this` type that SocketLike deliberately does not.
      const ws = new WebSocket(url);
      const shim: SocketLike = {
        send: (data) => ws.send(data),
        close: () => ws.close(),
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
      };
      ws.onopen = () => shim.onopen?.();
      ws.onmessage = (event) => shim.onmessage?.({ data: event.data });
      ws.onclose = (event) =>
        shim.onclose?.({ code: event.code, reason: event.reason });
      ws.onerror = () => shim.onerror?.();
      return shim;
    },
    startCapture: (stream, onChunk) =>
      startPcmCapture(stream, GEMINI_INPUT_RATE, onChunk),
    createPlayer: () => createPcmPlayer(GEMINI_OUTPUT_RATE),
    now: () => Date.now(),
  };
}
