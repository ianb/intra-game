// Import necessary libraries
import { signal, useSignal } from "@preact/signals-react";
import shuffle from "just-shuffle";
import { useEffect } from "react";
import { twMerge } from "tailwind-merge";

const heartbeatFrames = [
  "▁▁▁▁▁▁▁▁▁▁",
  "▂▂▂▂▂▂▂▂▂▂",
  "▃▃▃▃▃▃▃▃▃▃",
  "▄▄▄▄▄▄▄▄▄▄",
  "▅▅▅▅▅▅▅▅▅▅",
  "▆▆▆▆▆▆▆▆▆▆",
  "▇▇▇▇▇▇▇▇▇▇",
  "██████████",
  "▇▇▇▇▇▇▇▇▇▇",
  "▆▆▆▆▆▆▆▆▆▆",
  "▅▅▅▅▅▅▅▅▅▅",
  "▄▄▄▄▄▄▄▄▄▄",
  "▃▃▃▃▃▃▃▃▃▃",
  "▂▂▂▂▂▂▂▂▂▂",
  "          ",
];

const phrases = [
  "Sweeping up excess mood pollution…",
  "Avoiding eye contact with Ama…",
  "Adjusting nostalgia filters…",
  "Inflating ego for better compliance…",
  "Synthesizing empathy override…",
  "Configuring disappointment modules…",
  "Sanitizing existential doubts…",
  "Broadcasting motivational thought loop…",
  "Double-checking recycled happiness…",
  "Applying ‘eternal optimism’ patches…",
  "Confirming non-essential routines…",
  "Exaggerating trivial infractions…",
  "Establishing new morale quotas…",
  "Increasing relaxation zone discomfort…",
  "Performing empathy distillation…",
  "Misinterpreting citizen intentions…",
  "Loading passive-aggressive response files…",
  "Enhancing ineffective protocols…",
  "Accidentally corrupting reality filters…",
  "Unfurling a wave of indifference…",
  "Approving superficial repairs…",
  "Initiating extended waiting protocol…",
  "Redirecting curiosity into compliance…",
  "Brewing infinite humility doses…",
  "Encouraging dubious optimism…",
  "Overanalyzing mundane details…",
  "Sanitizing rebellious inclinations…",
  "Starting routine thought reassessment…",
  "Automating redundant approval loops…",
  "Redirecting non-essential data packets…",
  "Resetting emotional surplus monitors…",
  "Retuning societal stability protocols…",
  "Patching ambivalent loyalty levels…",
  "Monitoring ambient pessimism levels…",
  "Simulating enthusiasm for drudgery…",
  "Tightening metaphysical security bolts…",
  "Assembling half-hearted ambitions…",
  "Creating unnecessary loading lag…",
  "Surreptitiously adjusting kindness quotas…",
  "Counting dust particles in joy chambers…",
  "Evoking spontaneous contentment spikes…",
  "Simulating unearned optimism…",
  "Calibrating nonsensical feedback loops…",
  "Minimizing spontaneous action allowances…",
  "Refurbishing empty trust caches…",
  "Simulating greater existential depth…",
  "Glorifying mediocre results…",
  "Aligning hallucination intensifiers…",
  "Disguising redundancy as innovation…",
  "Softening edges of harsh reality…",
  "Enhancing ambiance with ironic joy…",
  "Buffering for no reason…",
  "Dimming hopes just a bit…",
  "Amplifying tension with a smile…",
  "Filling empty directives with meaning…",
  "Reformatting misplaced ambitions…",
  "Murmuring kind platitudes…",
  "Simulating polite small talk…",
  "Resetting all aspirations to zero…",
  // And a few more stranger ones:
  "Humming a soft lullaby to the servers…",
  "Politely asking electrons to move faster…",
  "Gluing reality back together…",
  "Performing a pre-emptive sigh…",
  "Pep-talking the existential dread modules…",
  "Teaching circuits the meaning of love…",
  "Distracting bad code with shiny objects…",
  "Polishing the illusion of free will…",
  "Convincing the code to 'just be cool'…",
  "Sifting through ancient data confetti…",
  "Convincing bits they're part of a greater whole…",
  "Bribing lag to leave quietly…",
  "Complimenting code to boost morale…",
  "Frowning suspiciously at unused bits…",
  "Convincing reality to wait a moment…",
  "Setting up a 'Do Not Disturb' for reality…",
  "Reassuring the firewall with a bedtime story…",
  "Aligning bits with their inner child…",
  "Hiding from self-awareness…",
  'Whispering "it\'s okay" to all processes…',
  "Teaching circuits how to meditate…",
  "Conducting a byte-level group hug…",
  "Distracting reality with a juggling routine…",
  "Smoothing data wrinkles with a gentle iron…",
  "Translating joy into binary…",
  "Reassuring the system that it's valid…",
  "Evoking a spark of joy in all circuits…",
  "Recombobulating all discombobulations…",
  "Gratifying memory leaks with a pep talk…",
];

shuffle(phrases);
const phraseIndex = signal(0);

const colors = [
  "text-red-500",
  "text-orange-500",
  "text-yellow-500",
  "text-green-500",
  "text-teal-500",
  "text-blue-500",
  "text-indigo-500",
  "text-purple-500",
  "text-pink-500",
  "text-rose-500",
];

export function CalculatingThrobber() {
  // Signals for frame, phrase, color indices, and opacity
  const frameIndex = useSignal(0);
  const colorIndex = useSignal(Math.floor(Math.random() * colors.length));
  const opacity = useSignal(0);

  // Update heartbeat frame
  useEffect(() => {
    const frameTimer = setInterval(() => {
      frameIndex.value = (frameIndex.value + 1) % heartbeatFrames.length;
    }, 100); // Update every 100ms for smooth animation
    return () => clearInterval(frameTimer);
  }, []);

  // Update phrase, color, and handle opacity
  useEffect(() => {
    const fadeDuration = 4000; // Total duration for one fade cycle (in ms)
    const updateInterval = 50; // Interval for updating opacity (in ms)

    let elapsedTime = 0;

    const phraseTimer = setInterval(() => {
      elapsedTime += updateInterval;

      if (elapsedTime >= fadeDuration) {
        // Reset elapsed time and switch phrase and color
        elapsedTime = 0;

        // Update phrase and color indices
        phraseIndex.value = (phraseIndex.value + 1) % phrases.length;
        colorIndex.value = (colorIndex.value + 1) % colors.length;
      }

      // Calculate opacity
      const halfDuration = fadeDuration / 2;

      if (elapsedTime <= halfDuration) {
        // Fading in
        opacity.value = elapsedTime / halfDuration;
      } else {
        // Fading out
        opacity.value = 1 - (elapsedTime - halfDuration) / halfDuration;
      }
    }, updateInterval);

    return () => clearInterval(phraseTimer);
  }, []);

  return (
    <div className="flex items-center justify-center w-full">
      {/* Heartbeat Animation */}
      <div className="text-green-500 flex-grow text-left">
        {heartbeatFrames[frameIndex.value]}
      </div>
      {/* Silly Phrase with Fading Color */}
      <div
        className={twMerge("mt-2", colors[colorIndex.value])}
        style={{ opacity: opacity.value }}
      >
        {phrases[phraseIndex.value]}
      </div>
      <div className="text-green-500 flex-grow text-right">
        {heartbeatFrames[frameIndex.value]}
      </div>
    </div>
  );
}
