export class SoundtrackPlayer {
  private _audioContext?: AudioContext;
  private currentAudio: HTMLAudioElement | null = null;
  private currentGainNode: GainNode | null = null;
  private paused: boolean = true;
  private fadeDuration: number = 2; // Fade duration in seconds
  private pendingUrl: string | null = null;

  constructor() {}

  get audioContext() {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    return this._audioContext;
  }

  /**
   * Plays a new soundtrack from the given URL with a fade transition.
   * @param url The URL of the new soundtrack to play. If null, stops playback.
   */
  public async playUrl(url: string | null): Promise<void> {
    this.pendingUrl = url;

    if (this.paused) {
      // Do not start playback if paused
      return;
    }

    // Fade out the current track if playing
    if (this.currentGainNode) {
      this.fadeOutAndStop(this.currentGainNode, this.currentAudio!);
    }

    if (url) {
      // Create a new Audio element
      const audioElement = new Audio(url);
      audioElement.loop = true;

      // Create a MediaElementSourceNode
      const source = this.audioContext.createMediaElementSource(audioElement);

      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime); // Start muted

      // Connect the nodes
      source.connect(gainNode).connect(this.audioContext.destination);

      // Start playing the audio element
      try {
        await audioElement.play();
      } catch (error) {
        console.error("Playback failed:", error);
      }

      // Fade in the new track
      gainNode.gain.linearRampToValueAtTime(
        1,
        this.audioContext.currentTime + this.fadeDuration
      );

      // Set as the current audio and gain node
      this.currentAudio = audioElement;
      this.currentGainNode = gainNode;
    } else {
      // No new track to play
      this.currentAudio = null;
      this.currentGainNode = null;
    }
  }

  /**
   * Pauses the playback.
   */
  public pause(): void {
    this.paused = true;

    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resumes playback if paused.
   */
  public async unpause(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (this.pendingUrl) {
      await this.playUrl(this.pendingUrl);
    }
  }

  /**
   * Fades out the given audio and stops it.
   * @param gainNode The gain node controlling the volume.
   * @param audioElement The audio element to stop after fading out.
   */
  private async fadeOutAndStop(
    gainNode: GainNode,
    audioElement: HTMLAudioElement
  ): Promise<void> {
    const currentTime = this.audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + this.fadeDuration);

    // Wait for the fade-out to complete
    await this.wait(this.fadeDuration * 1000);

    // Stop the audio
    audioElement.pause();
    audioElement.currentTime = 0;

    // Disconnect the nodes
    gainNode.disconnect();
  }

  /**
   * Utility function to wait for a given number of milliseconds.
   * @param ms Milliseconds to wait.
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
