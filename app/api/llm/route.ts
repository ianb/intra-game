import { NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";

// This is the maximum free tier duration for a single request:
export const maxDuration = 60;

const generator = new GoogleGenerativeAI(process.env.GEMINI_KEY as string);

export async function POST(request: Request) {
  if (process.env.PROXY_LLM) {
    // Proxy the request to the URL specified in process.env.PROXY_LLM
    const proxyUrl = process.env.PROXY_LLM;
    console.info("Proxying request to", proxyUrl);
    const body = await request.text();
    const headers = new Headers(request.headers);
    // Remove 'Accept-Encoding' to prevent the server from compressing the response
    headers.set("Accept-Encoding", "identity");
    const init: RequestInit = {
      method: "POST",
      headers,
      body: body,
      redirect: "manual",
    };
    const proxyResponse = await fetch(proxyUrl, init);
    return proxyResponse;
  }

  const data = await request.json();
  console.log("sending with key", process.env.GEMINI_KEY);
  // threshold:
  // BLOCK_LOW_AND_ABOVE	Content with NEGLIGIBLE will be allowed.
  // BLOCK_MEDIUM_AND_ABOVE	Content with NEGLIGIBLE and LOW will be allowed.
  // BLOCK_ONLY_HIGH	Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed.
  // BLOCK_NONE	All content will be allowed.

  // category:
  // HARM_CATEGORY_HARASSMENT	Gemini - Harassment content.
  // HARM_CATEGORY_HATE_SPEECH	Gemini - Hate speech and content.
  // HARM_CATEGORY_SEXUALLY_EXPLICIT	Gemini - Sexually explicit content.
  // HARM_CATEGORY_DANGEROUS_CONTENT	Gemini - Dangerous content.
  // HARM_CATEGORY_CIVIC_INTEGRITY	Gemini - Content that may be used to harm civic integrity.
  const model = generator.getGenerativeModel({
    model: data.model,
    systemInstruction: data.systemInstruction,
    safetySettings: [
      // You're allowed to be kind of mean to the other characters (MEDIUM is only a little mean)
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
        // threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        // threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
      },
    ],
  });
  const chat = model.startChat({
    history: data.history,
  });
  const result = await chat.sendMessage(data.message);
  try {
    const text = result.response.text();
    return NextResponse.json({ response: text });
  } catch (e) {
    console.error("Gemini error:", e);
    return NextResponse.json({ candidates: result.response.candidates });
  }
}
