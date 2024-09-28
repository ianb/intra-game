import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const generator = new GoogleGenerativeAI(process.env.GEMINI_KEY as string);

export async function POST(request: Request) {
  const data = await request.json();
  const model = generator.getGenerativeModel({ model: data.model });
  const chat = model.startChat({ history: data.history });
  const result = await chat.sendMessage(data.message);
  return NextResponse.json({ response: result.response.text() });
}
