/**
 * Raw PCM in and out of the browser, for providers that speak WebSocket
 * rather than WebRTC (Gemini Live).
 *
 * Capture: an AudioWorklet reads the microphone, resamples to the target
 * rate, converts to 16-bit little-endian, and posts chunks of about 100 ms.
 * Playback: chunks are decoded to AudioBuffers and scheduled back to back on
 * an AudioContext at the provider's output rate; flush() drops what has not
 * played yet, which is how an interruption is honoured.
 *
 * Both are behind small interfaces so the session can be tested with fakes.
 */

export interface PcmCapture {
  stop(): void;
  /** Muted capture posts nothing, so a muted player costs no input tokens. */
  setMuted(muted: boolean): void;
}

export interface PcmPlayer {
  /** Queue one base64 chunk of 16-bit PCM at the player's rate. */
  play(base64: string): void;
  /** Drop everything queued and stop what is playing. */
  flush(): void;
  close(): void;
}

/**
 * The worklet's processor, as source text: it runs in the audio thread and
 * has to be loaded from a URL, so it cannot share code with this module.
 * Linear resampling is enough for speech going to a recogniser.
 */
const CAPTURE_PROCESSOR = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = options.processorOptions.targetRate;
    this.ratio = sampleRate / this.target;
    this.chunk = Math.round(this.target / 10);
    this.pending = new Int16Array(this.chunk);
    this.filled = 0;
    this.position = 0;
    this.last = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) {
      return true;
    }
    let pos = this.position;
    while (pos < input.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = i > 0 ? input[i - 1] : this.last;
      const b = input[i];
      const sample = a + (b - a) * frac;
      const clamped = Math.max(-1, Math.min(1, sample));
      this.pending[this.filled++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.filled === this.chunk) {
        this.port.postMessage(this.pending.buffer, [this.pending.buffer]);
        this.pending = new Int16Array(this.chunk);
        this.filled = 0;
      }
      pos += this.ratio;
    }
    this.position = pos - input.length;
    this.last = input[input.length - 1];
    return true;
  }
}
registerProcessor("pcm-capture", PcmCaptureProcessor);
`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

export async function startPcmCapture(
  stream: MediaStream,
  targetRate: number,
  onChunk: (base64: string) => void,
): Promise<PcmCapture> {
  // The context runs at the device's own rate; the worklet resamples. Asking
  // the context for the target rate is not honoured for microphone sources
  // in every browser.
  const context = new AudioContext();
  const url = URL.createObjectURL(
    new Blob([CAPTURE_PROCESSOR], { type: "application/javascript" }),
  );
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "pcm-capture", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    processorOptions: { targetRate },
  });
  let muted = false;
  node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
    if (!muted) {
      onChunk(toBase64(event.data));
    }
  };
  source.connect(node);
  await context.resume();
  return {
    stop: () => {
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
      } catch {
        // Already gone.
      }
      void context.close();
    },
    setMuted: (value) => {
      muted = value;
    },
  };
}

export function createPcmPlayer(rate: number): PcmPlayer {
  const context = new AudioContext({ sampleRate: rate });
  void context.resume();
  let nextTime = 0;
  const playing = new Set<AudioBufferSourceNode>();
  return {
    play: (base64) => {
      const samples = fromBase64(base64);
      if (!samples.length) {
        return;
      }
      const buffer = context.createBuffer(1, samples.length, rate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        channel[i] = samples[i]! / 0x8000;
      }
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.connect(context.destination);
      const at = Math.max(context.currentTime, nextTime);
      node.start(at);
      nextTime = at + buffer.duration;
      playing.add(node);
      node.onended = () => {
        playing.delete(node);
      };
    },
    flush: () => {
      for (const node of playing) {
        try {
          node.stop();
        } catch {
          // Not started, or already stopped.
        }
      }
      playing.clear();
      nextTime = 0;
    },
    close: () => {
      for (const node of playing) {
        try {
          node.stop();
        } catch {
          // Already stopped.
        }
      }
      playing.clear();
      void context.close();
    },
  };
}
