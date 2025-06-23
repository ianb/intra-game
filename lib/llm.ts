import { ModelType } from "@/components/modelselector";
import { openrouterCode } from "@/components/openrouter";
import { signal } from "@preact/signals-react";
import OpenAI from "openai";
import { persistentSignal } from "./persistentsignal";
import { ChatType, LlmLogType } from "./types";

export const DEFAULT_PRO_MODEL = "openai/gpt-4o";
export const DEFAULT_FLASH_MODEL = "google/gemini-2.5-flash-preview-05-20";
export const DEFAULT_MODEL = DEFAULT_PRO_MODEL;

export const customEndpoint = persistentSignal<string | null>(
  "customEndpoint",
  null
);
export const openrouterModel = persistentSignal<ModelType | null>(
  "openrouter",
  null
);

export const logSignal = signal<LlmLogType[]>([]);

export const lastLlmError = signal<string | null>(null);

export async function chat(request: ChatType) {
  request = upliftInstructions(request);
  const log = {
    request,
  };
  const lastIndex = logSignal.value.length
    ? logSignal.value[0].request.meta.index
    : 0;
  request.meta.index = (lastIndex || 0) + 1;
  request.meta.start = Date.now();
  let model: string = DEFAULT_MODEL;
  if (!request.model) {
    model = DEFAULT_MODEL;
  } else if (request.model === "pro") {
    model = DEFAULT_PRO_MODEL;
  } else if (request.model === "flash") {
    model = DEFAULT_FLASH_MODEL;
  }
  logSignal.value = [log, ...logSignal.value.slice(0, 20)];
  let text = "";
  try {
    let openai: OpenAI;

    if (customEndpoint.value) {
      // Use custom endpoint
      openai = new OpenAI({
        baseURL: customEndpoint.value,
        apiKey: "dummy", // Required but not used for custom endpoints
        dangerouslyAllowBrowser: true,
      });
    } else {
      // Use OpenRouter
      if (!openrouterModel.value) {
        throw new Error(
          "No OpenRouter model selected. Please select a model first."
        );
      }
      if (!openrouterCode.value) {
        throw new Error(
          "No OpenRouter API key found. Please connect to OpenRouter first."
        );
      }

      openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: openrouterCode.value,
        defaultHeaders: {
          "X-Title": "Intra",
          "HTTP-Referer": location.origin,
        },
        dangerouslyAllowBrowser: true,
      });
    }

    const messages = request.messages;

    const completion = await openai.chat.completions.create({
      model: openrouterModel.value?.id || model,
      messages,
    });

    if (!completion.choices[0]?.message?.content) {
      console.error("Bad Response", completion);
      lastLlmError.value = `Bad response from LLM: no content in choices`;
      throw new Error("Bad response from LLM: no content in choices");
    }

    text = completion.choices[0].message.content;
  } catch (e) {
    const newLog = {
      ...log,
      end: Date.now(),
      errorMessage: `${e}`,
    };
    logSignal.value = logSignal.value.map((l) => (l === log ? newLog : l));
    lastLlmError.value = `Unexpected LLM error: ${e}`;
    throw e;
  }
  const newLog = {
    ...log,
    end: Date.now(),
    response: text,
  };
  logSignal.value = logSignal.value.map((l) => (l === log ? newLog : l));
  return text as string;
}

function upliftInstructions(chat: ChatType): ChatType {
  const newChat = { ...chat };
  const allInstructions: string[] = [];

  // Process system messages for instructions
  newChat.messages = newChat.messages.map((message) => {
    if (message.role === "system") {
      const { repl, instructions } = parseInstructions(message.content);
      allInstructions.push(...instructions);
      return { ...message, content: repl };
    }
    return message;
  });

  // Process user and assistant messages for instructions
  newChat.messages = newChat.messages.map((message) => {
    if (message.role === "user" || message.role === "assistant") {
      const { repl, instructions } = parseInstructions(message.content);
      allInstructions.push(...instructions);
      return { ...message, content: repl };
    }
    return message;
  });

  // If we found instructions, insert them into the first system message or create one
  if (allInstructions.length > 0) {
    const systemMessages = newChat.messages.filter(
      (msg) => msg.role === "system"
    );
    if (systemMessages.length > 0) {
      // Insert into the first system message
      const firstSystemIndex = newChat.messages.findIndex(
        (msg) => msg.role === "system"
      );
      const firstSystem = newChat.messages[firstSystemIndex];
      if (firstSystem.content.includes("<insert-system />")) {
        newChat.messages[firstSystemIndex] = {
          ...firstSystem,
          content: firstSystem.content.replace(
            /<insert-system\s*\/>/i,
            allInstructions.join("\n")
          ),
        };
      } else {
        throw new Error(
          "Instructions were not inserted into system instruction"
        );
      }
    } else {
      // Create a new system message at the beginning
      newChat.messages.unshift({
        role: "system",
        content: allInstructions.join("\n"),
      });
    }
  }

  return newChat;
}

function parseInstructions(system: string): {
  repl: string;
  instructions: string[];
} {
  const instructions: string[] = [];
  const instructionRegex = /<system>([^]*?)<\/system>\s*/gi;
  const repl = system.replace(instructionRegex, (match, contents) => {
    instructions.push(contents.trim());
    return "";
  });
  return { repl, instructions };
}
