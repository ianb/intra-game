export class SoundtrackPlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private nextAudio: HTMLAudioElement | null = null;
  private fadeTimeout: NodeJS.Timeout | null = null;
  private paused: boolean = true;
  private fadeDuration: number = 2000; // Fade duration in milliseconds
  private pendingUrl: string | null = null;

  constructor() {}

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

    // Clear any existing fade timeout
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    if (url) {
      // Create a new Audio element
      const audioElement = new Audio(url);
      audioElement.loop = true;
      audioElement.volume = 0; // Start muted

      // Start playing the audio element
      try {
        await audioElement.play();
      } catch (error) {
        console.error("Playback failed:", error);
      }

      // If there's a current track, cross-fade between them
      if (this.currentAudio) {
        this.nextAudio = audioElement;
        this.crossFade();
      } else {
        // No current track, just fade in the new one
        this.currentAudio = audioElement;
        this.fadeIn(audioElement);
      }
    } else {
      // No new track to play, fade out current
      if (this.currentAudio) {
        this.fadeOut(this.currentAudio);
      }
      this.currentAudio = null;
      this.nextAudio = null;
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
    if (this.nextAudio) {
      this.nextAudio.pause();
    }

    // Clear any pending fade timeout
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
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
   * Cross-fades between current and next audio tracks.
   */
  private crossFade(): void {
    if (!this.currentAudio || !this.nextAudio) return;

    const steps = 20; // Number of volume steps for smooth fade
    const stepDuration = this.fadeDuration / steps;
    let step = 0;

    const fadeStep = () => {
      if (step >= steps) {
        // Fade complete
        this.currentAudio!.pause();
        this.currentAudio!.currentTime = 0;
        this.currentAudio = this.nextAudio;
        this.nextAudio = null;
        return;
      }

      const progress = step / steps;
      const currentVolume = 1 - progress;
      const nextVolume = progress;

      this.currentAudio!.volume = Math.max(0, currentVolume);
      this.nextAudio!.volume = Math.min(1, nextVolume);

      step++;
      this.fadeTimeout = setTimeout(fadeStep, stepDuration);
    };

    fadeStep();
  }

  /**
   * Fades in an audio track.
   */
  private fadeIn(audio: HTMLAudioElement): void {
    const steps = 20;
    const stepDuration = this.fadeDuration / steps;
    let step = 0;

    const fadeStep = () => {
      if (step >= steps) {
        audio.volume = 1;
        return;
      }

      const progress = step / steps;
      audio.volume = progress;

      step++;
      this.fadeTimeout = setTimeout(fadeStep, stepDuration);
    };

    fadeStep();
  }

  /**
   * Fades out an audio track and stops it.
   */
  private fadeOut(audio: HTMLAudioElement): void {
    const steps = 20;
    const stepDuration = this.fadeDuration / steps;
    let step = 0;

    const fadeStep = () => {
      if (step >= steps) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
        return;
      }

      const progress = step / steps;
      audio.volume = 1 - progress;

      step++;
      this.fadeTimeout = setTimeout(fadeStep, stepDuration);
    };

    fadeStep();
  }
}
