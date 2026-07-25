/**
 * The help overlay — the closest thing the game has to instructions.
 */

import {
  customEndpoint,
  lastLlmError,
  lastLlmErrorType,
  openrouterModel,
} from "@/lib/llm";
import { openHelp, openSettings } from "./uistate";
import { openrouterCode, OpenRouterConnect } from "@/components/openrouter";
import { useSignals } from "@preact/signals-react/runtime";

export function Help() {
  useSignals();
  return (
    <div className="w-full h-full bg-blue-900 text-white py-4 px-8 border-white border-8 overflow-scroll">
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1 text-left text-sm">
          <a
            className="text-cyan-300 hover:underline"
            href="https://github.com/ianb/intra-game"
            target="_blank"
            rel="noopener"
          >
            github
          </a>
        </div>
        <div className="flex-1 text-center">░░▒▒▓▓ Intra ▓▓▒▒░░</div>
        <div className="flex-1 text-right text-sm">
          <a
            className="text-cyan-300 hover:underline"
            href="https://ianbicking.org"
            target="_blank"
            rel="noopener"
          >
            by Ian Bicking
          </a>
        </div>
      </div>
      <div className="mb-4">
        Welcome to the Intra Complex! Everything here is just perfect. No need
        to worry about a thing... except figuring out where you are. But don't
        worry, you're in good hands.
      </div>
      <div className="mb-4">
        You will play a character from a time not unlike today, except maybe
        with more smart fridges that talk back. You decide your name and
        profession - don't overthink it, just pick something and keep an eye out
        for suspiciously friendly fridges.
      </div>
      <div className="mb-4">
        This is a text adventure (or as it's now more fashionably called,
        "interactive fiction"). Whether you're exploring strange rooms,
        questioning fellow citizens, or trying to outwit the AI, type whatever
        comes to mind. The system is smart enough to figure it out (most of the
        time).
      </div>
      <div className="mb-4">
        <span
          title={
            "And one secret command:\n  /roll 10\ncauses a roll of 10 on your next attempt"
          }
        >
          You can use these special commands:{" "}
        </span>
        <code className="text-cyan-300">/undo</code> and{" "}
        <code className="text-cyan-300">/redo</code> and{" "}
        <code className="text-cyan-300">/restart</code>
      </div>
      <div className="mb-4">
        When someone asks you to do something it lands on your{" "}
        <code className="text-cyan-300">todo</code> list, in the panel on the
        right. Nobody makes you do any of it.
      </div>
      <div className="flex justify-center mb-4">
        <pre>
          {"+-------------------------+\n"}
          {"| story         | map     |\n"}
          {"| ...           |         |\n"}
          {"| ...           |         |\n"}
          {"| ...           +---------|\n"}
          {"+---------------+ rooms & |\n"}
          {"| TYPE HERE     | people  |\n"}
          {"+---------------+---------+\n"}
        </pre>
      </div>
      <div className="flex justify-center">
        <button className="done bg-green-800 hover:bg-green-600 cursor-pointer px-4">
          DONE
        </button>
      </div>
      {(!openrouterCode.value || !openrouterModel.value) && (
        <div className="flex justify-center mt-4">
          <button
            className="done bg-green-800 hover:bg-green-600 cursor-pointer px-4"
            onClick={() => {
              openSettings.value = true;
              openHelp.value = false;
            }}
          >
            ⚙ Open settings to configure LLM access
          </button>
        </div>
      )}
    </div>
  );
}
