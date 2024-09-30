import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const generator = new GoogleGenerativeAI(process.env.GEMINI_KEY as string);

export async function POST(request: Request) {
  const data = await request.json();
  console.log("sending with key", process.env.GEMINI_KEY);
  const model = generator.getGenerativeModel({
    model: data.model,
    systemInstruction: data.systemInstruction,
  });
  const chat = model.startChat({
    history: data.history,
  });
  const result = await chat.sendMessage(data.message);
  console.log("sent with...", data.history, data.message);
  try {
    const text = result.response.text();
    return NextResponse.json({ response: text });
  } catch (e) {
    console.error("Gemini error:", e);
    return NextResponse.json({ candidates: result.response.candidates });
  }
}
