import { Configuration, OpenAIApi } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as Sentry from "@sentry/node";

export type AIProvider = "openai" | "anthropic" | "gemini" | "manus";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRequestOptions {
  provider: AIProvider;
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
  baseUrl?: string;
}

export async function callAIProvider(opts: AIRequestOptions): Promise<string> {
  const { provider, apiKey, model, messages, maxTokens, temperature, baseUrl } = opts;

  try {
    switch (provider) {
      case "openai":
        return await callOpenAI({ apiKey, model, messages, maxTokens, temperature });

      case "manus":
        return await callOpenAI({ apiKey, model, messages, maxTokens, temperature, basePath: baseUrl });

      case "anthropic":
        return await callAnthropic({ apiKey, model, messages, maxTokens, temperature });

      case "gemini":
        return await callGemini({ apiKey, model, messages, maxTokens, temperature });

      default:
        return await callOpenAI({ apiKey, model, messages, maxTokens, temperature });
    }
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

// ─── OpenAI v3 / Manus (OpenAI-compatible) ────────────────────────────────
async function callOpenAI(opts: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
  basePath?: string;
}): Promise<string> {
  const config = new Configuration({
    apiKey: opts.apiKey,
    ...(opts.basePath ? { basePath: opts.basePath } : {})
  });
  const openai = new OpenAIApi(config);

  const response = await openai.createChatCompletion({
    model: opts.model,
    messages: opts.messages as any,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature
  });

  return response.data.choices[0]?.message?.content ?? "";
}

// ─── Anthropic / Claude ────────────────────────────────────────────────────
async function callAnthropic(opts: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const client = new Anthropic({ apiKey: opts.apiKey });

  const systemMsg = opts.messages.find(m => m.role === "system");
  const chatMessages = opts.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));

  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: Math.min(opts.temperature, 1),
    ...(systemMsg ? { system: systemMsg.content } : {}),
    messages: chatMessages
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

// ─── Google Gemini ─────────────────────────────────────────────────────────
async function callGemini(opts: {
  apiKey: string;
  model: string;
  messages: AIMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(opts.apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model: opts.model,
    generationConfig: {
      maxOutputTokens: opts.maxTokens,
      temperature: opts.temperature
    }
  });

  const systemMsg = opts.messages.find(m => m.role === "system");
  const nonSystem = opts.messages.filter(m => m.role !== "system");

  const history = nonSystem.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const lastMsg = nonSystem[nonSystem.length - 1];
  const userText = systemMsg
    ? `${systemMsg.content}\n\n${lastMsg?.content ?? ""}`
    : (lastMsg?.content ?? "");

  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessage(userText);
  return result.response.text();
}

/** Modelos disponíveis por provider */
export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai:    ["gpt-3.5-turbo", "gpt-3.5-turbo-1106", "gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  anthropic: ["claude-3-haiku-20240307", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"],
  gemini: [
    // Gemini 1.5
    "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro",
    // Gemini 2.0
    "gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.0-flash-lite",
    "gemini-2.0-flash-thinking-exp",
    // Gemini 2.5
    "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro", "gemini-2.5-pro-preview",
    // Gemini 3.1
    "gemini-3.1-flash-lite", "gemini-3.1-flash", "gemini-3.1-flash-tts",
    "gemini-3.1-pro", "gemini-3.1-pro-preview",
    // Gemini Live (streaming multimodal)
    "gemini-2.0-flash-live", "gemini-3.1-flash-live",
    // Gemini 3.x adicionais
    "gemini-3-flash-preview", "gemini-3.5-flash",
  ],
  manus:     ["manus-default"]
};
