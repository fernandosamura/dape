import path from "path";
import { isNil } from "lodash";
import { proto } from "baileys";
import { Configuration, OpenAIApi } from "openai";

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

import { logger } from "../../utils/logger";
import { moduleAccessService as moduleAccess } from "../../dape/shared/moduleAccess.service";
import { dapleShield } from "../../dape/shield/dapleShield.service";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { uploadToR2, downloadFromR2 } from "../StorageServices/R2Service";
import { callAIProvider, AIProvider, AIMessage } from "../AIProviderService/AIProviderRouter";
import { sanitizeName, keepOnlySpecifiedChars } from "../../utils/generalHelpers";
import { getBodyMessage } from "./wbotMessageParsers";
import {
  convertTextToSpeechAndSaveToFile,
  verifyMediaMessage,
  deleteFileSync,
  verifyMessage
} from "./wbotMessageMedia";
import type { Session } from "./wbotMessageListener";

const fs = require("fs");

export const transferQueue = async (
  queueId: number,
  ticket: Ticket,
  contact: Contact
): Promise<void> => {
  await UpdateTicketService({
    ticketData: { queueId: queueId, status: "pending", userId: null, chatbot: false },
    ticketId: ticket.id,
    companyId: ticket.companyId
  });
};

async function sendWithTypingDelay(
  wbot: Session,
  jid: string,
  text: string,
  ticket: Ticket,
  contact: Contact
): Promise<void> {
  const words = text.trim().split(/\s+/).length;
  const base = Math.min(words * 60, 3600);
  const jitter = Math.floor(Math.random() * 400);
  const delayMs = Math.max(800, Math.min(base + jitter, 4000));

  await wbot.presenceSubscribe(jid);
  await wbot.sendPresenceUpdate("composing", jid);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  await wbot.sendPresenceUpdate("paused", jid);

  const sent = await wbot.sendMessage(jid, { text });
  await verifyMessage(sent!, ticket, contact);
}

export const handleOpenAi = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking = null,
  openAiSettings = null
): Promise<void> => {

  // REGRA PARA DESABILITAR O BOT PARA ALGUM CONTATO
  if (contact.disableBot) {
    return;
  }

  // Verificação de acesso ao módulo de IA por plano
  const hasIaAccess = await moduleAccess.checkAccess(ticket.companyId, 'dape_ia');
  if (!hasIaAccess) {
    logger.info(
      `[handleOpenAi] Empresa ${ticket.companyId} sem módulo dape_ia ativo — chatbot bloqueado para ticket ${ticket.id}`
    );
    return;
  }

  // DAPLE Shield — AI auto-responses are blocking
  const shieldResultAi = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "bot",
    ticketId: ticket.id,
  });
  if (!shieldResultAi.allowed) {
    logger.warn(`[DAPLE Shield] AI response blocked for ticket ${ticket.id}: ${shieldResultAi.reason}`);
    return;
  }

  const bodyMessage = getBodyMessage(msg);

  if (!bodyMessage) return;

  let { prompt } = await ShowWhatsAppService(wbot.id, ticket.companyId);

  if( openAiSettings )
    prompt = openAiSettings;

  if (!prompt && !isNil(ticket?.queue?.prompt)) {
    prompt = ticket.queue.prompt;
  }

  if (!prompt) return;

  if (msg.messageStubType) return;

  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);

  const publicFolder: string = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "public"
  );

  const aiProvider = (prompt.provider || "openai") as AIProvider;
  const aiModel = prompt.model || "gpt-3.5-turbo-1106";
  let maxMessages = prompt.maxMessages;

  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "DESC"]],
    limit: maxMessages
  });

  const queues = await Queue.findAll({ where: { companyId: ticket.companyId } });
  const queuesInfo = queues.map(q => `${q.id}=${q.name}`).join(", ");

  const promptSystem = `Nas respostas utilize o nome ${sanitizeName(
    contact.name || "Amigo(a)"
  )} para identificar o cliente.\nSua resposta deve usar no máximo ${
    prompt.maxTokens
  } tokens e cuide para não truncar o final.\nSempre que possível, mencione o nome dele para ser mais personalizado o atendimento e mais educado. Filas disponíveis: ${queuesInfo}. Quando precisar transferir o cliente, inicie sua resposta com 'Ação: Transferir para [ID]' onde [ID] é o número da fila correta para o assunto.\n
  ${prompt.prompt}\n`;

  let messagesAI: AIMessage[] = [];

  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    messagesAI = [];
    messagesAI.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesAI.push({ role: "assistant", content: message.body });
        } else {
          messagesAI.push({ role: "user", content: message.body });
        }
      }
    }
    messagesAI.push({ role: "user", content: bodyMessage! });

    let response = await callAIProvider({
      provider: aiProvider,
      apiKey: prompt.apiKey,
      model: aiModel,
      messages: messagesAI,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
      baseUrl: prompt.baseUrl
    });

    let transferToQueue1 = false;
    let targetQueueId1: number | null = null;
    const transferMatch1 = response?.match(/Ação: Transferir para (\d+)/);
    if (transferMatch1) {
      transferToQueue1 = true;
      targetQueueId1 = parseInt(transferMatch1[1]);
      response = response.replace(/Ação: Transferir para \d+/, "").trim();
    }

    if (!prompt.voice || prompt.voice === "texto") {
      // Resposta em texto com delay humanizado (typing indicator)
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
    } else {
      // Resposta em áudio OGG/Opus (compatível com WhatsApp Web/Baileys)
      const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
      try {
        await convertTextToSpeechAndSaveToFile(
          keepOnlySpecifiedChars(response!),
          `${publicFolder}/${fileNameWithOutExtension}`,
          prompt.voiceKey || "",
          prompt.voiceRegion || "",
          prompt.voice,
          prompt.ttsProvider || "azure"
        );
        const oggPath = `${publicFolder}/${fileNameWithOutExtension}.ogg`;
        const audioBuffer = fs.readFileSync(oggPath);
        const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });
        await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
        if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
          await uploadToR2(
            `${publicFolder}/${fileNameWithOutExtension}.ogg`,
            `${fileNameWithOutExtension}.ogg`,
            "audio/ogg"
          );
        }
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.ogg`);
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
      } catch (error) {
        logger.error(`[AI] Erro ao gerar resposta de áudio: ${error}`);
        // Fallback: envia como texto se TTS falhar
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: response!
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }

    if (transferToQueue1 && targetQueueId1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await transferQueue(targetQueueId1, ticket, contact);
    }

  } else if (msg.message?.audioMessage) {
    // Transcrição de áudio: Whisper (OpenAI/Manus) ou Gemini Multimodal
    const mediaUrl = mediaSent!.mediaUrl!.split("/").pop();
    const audioFilePath = `${publicFolder}/${mediaUrl}`;
    let transcribedText = "";
    let r2AudioDownloaded = false;

    // Se R2 ativo, o arquivo foi deletado do disco — baixa temporariamente
    if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
      try {
        await downloadFromR2(mediaUrl, audioFilePath);
        r2AudioDownloaded = true;
      } catch (err) {
        logger.error(`[R2] Erro ao baixar áudio para transcrição: ${err}`);
        const fallbackMsg = "Desculpe, não consegui processar o áudio enviado. Poderia escrever sua mensagem em texto? 😊";
        await sendWithTypingDelay(wbot, msg.key.remoteJid!, fallbackMsg, ticket, contact);
        return;
      }
    }

    if (aiProvider === "gemini") {
      // Gemini: transcrição via API Multimodal (base64 inline)
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const audioBuffer = fs.readFileSync(audioFilePath);
        const audioBase64 = audioBuffer.toString("base64");
        const mimeType = mediaSent!.mediaType === "audioMessage" ? "audio/ogg" : "audio/mpeg";

        const genAI = new GoogleGenerativeAI(prompt.apiKey);
        const geminiModel = genAI.getGenerativeModel({ model: aiModel });
        const result = await geminiModel.generateContent([
          { text: "Transcreva o áudio a seguir. Retorne apenas o texto transcrito, sem explicações adicionais." },
          { inlineData: { mimeType, data: audioBase64 } }
        ]);
        transcribedText = result.response.text().trim();
        logger.info(`[AI] Gemini transcreveu áudio: "${transcribedText.slice(0, 80)}..."`);
      } catch (err) {
        logger.error(`[AI] Erro na transcrição Gemini: ${err}`);
        return;
      }
    } else if (aiProvider === "openai" || aiProvider === "manus") {
      // OpenAI / Manus: transcrição via Whisper
      try {
        const file = fs.createReadStream(audioFilePath) as any;
        const whisperConfig = new Configuration({
          apiKey: prompt.apiKey,
          ...(aiProvider === "manus" && prompt.baseUrl ? { basePath: prompt.baseUrl } : {})
        });
        const openaiWhisper = new OpenAIApi(whisperConfig);
        const transcription = await openaiWhisper.createTranscription(file, "whisper-1");
        transcribedText = transcription.data.text;
      } catch (err) {
        logger.error(`[AI] Erro na transcrição Whisper: ${err}`);
        transcribedText = "";
      }
    } else {
      // Anthropic não suporta transcrição de áudio nativa
      logger.info(`[AI] Transcrição de áudio não suportada para provider: ${aiProvider}`);
      return;
    }

    // Fallback: se transcrição falhou ou retornou vazio, avisar o usuário
    if (!transcribedText || transcribedText.trim() === "") {
      const fallbackMsg = "Desculpe, não consegui ouvir o áudio enviado. Poderia escrever sua mensagem em texto para que eu possa te ajudar? 😊";
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, fallbackMsg, ticket, contact);
      if (r2AudioDownloaded) deleteFileSync(audioFilePath);
      return;
    }

    messagesAI = [];
    messagesAI.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage"
      ) {
        if (message.fromMe) {
          messagesAI.push({ role: "assistant", content: message.body });
        } else {
          messagesAI.push({ role: "user", content: message.body });
        }
      }
    }
    messagesAI.push({ role: "user", content: transcribedText });

    // Remove o arquivo baixado do R2 após leitura
    if (r2AudioDownloaded) {
      deleteFileSync(audioFilePath);
    }

    let response = await callAIProvider({
      provider: aiProvider,
      apiKey: prompt.apiKey,
      model: aiModel,
      messages: messagesAI,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
      baseUrl: prompt.baseUrl
    });

    let transferToQueue2 = false;
    let targetQueueId2: number | null = null;
    const transferMatch2 = response?.match(/Ação: Transferir para (\d+)/);
    if (transferMatch2) {
      transferToQueue2 = true;
      targetQueueId2 = parseInt(transferMatch2[1]);
      response = response.replace(/Ação: Transferir para \d+/, "").trim();
    }

    if (!prompt.voice || prompt.voice === "texto") {
      // Resposta em texto com delay humanizado (typing indicator)
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
    } else {
      const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
      try {
        await convertTextToSpeechAndSaveToFile(
          keepOnlySpecifiedChars(response!),
          `${publicFolder}/${fileNameWithOutExtension}`,
          prompt.voiceKey || "",
          prompt.voiceRegion || "",
          prompt.voice,
          prompt.ttsProvider || "azure"
        );
        const oggPath = `${publicFolder}/${fileNameWithOutExtension}.ogg`;
        const audioBuffer = fs.readFileSync(oggPath);
        const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });
        await verifyMediaMessage(sendMessage!, ticket, contact, ticketTraking, false, false, wbot);
        if (process.env.CLOUDFLARE_R2_ENABLED === "true") {
          await uploadToR2(
            `${publicFolder}/${fileNameWithOutExtension}.ogg`,
            `${fileNameWithOutExtension}.ogg`,
            "audio/ogg"
          );
        }
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.ogg`);
        deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
      } catch (error) {
        logger.error(`[AI] Erro ao gerar resposta de áudio: ${error}`);
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: response!
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    }

    if (transferToQueue2 && targetQueueId2) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await transferQueue(targetQueueId2!, ticket, contact);
    }
  } else if (msg.message?.imageMessage || msg.message?.videoMessage) {
    // Análise de imagem/vídeo: Gemini (vision nativo) ou OpenAI GPT-4V
    const mediaUrl = mediaSent?.mediaUrl?.split("/").pop();
    const mediaFilePath = mediaUrl ? `${publicFolder}/${mediaUrl}` : null;
    let visionDescription = "";

    if (mediaFilePath && fs.existsSync(mediaFilePath)) {
      try {
        if (aiProvider === "gemini") {
          const { GoogleGenerativeAI } = require("@google/generative-ai");
          const fileBuffer = fs.readFileSync(mediaFilePath);
          const fileBase64 = fileBuffer.toString("base64");
          const mimeType = msg.message?.imageMessage ? "image/jpeg" : "video/mp4";
          const genAI = new GoogleGenerativeAI(prompt.apiKey);
          const geminiModel = genAI.getGenerativeModel({ model: aiModel });
          const result = await geminiModel.generateContent([
            { text: "Descreva o conteúdo desta mídia de forma objetiva para contexto de atendimento ao cliente." },
            { inlineData: { mimeType, data: fileBase64 } }
          ]);
          visionDescription = result.response.text().trim();
          logger.info(`[AI] Gemini descreveu mídia: "${visionDescription.slice(0, 80)}..."`);
        } else if (aiProvider === "openai" || aiProvider === "manus") {
          // GPT-4V / GPT-4o via image_url (base64)
          const fileBuffer = fs.readFileSync(mediaFilePath);
          const fileBase64 = fileBuffer.toString("base64");
          const config = new Configuration({
            apiKey: prompt.apiKey,
            ...(aiProvider === "manus" && prompt.baseUrl ? { basePath: prompt.baseUrl } : {})
          });
          const openaiVision = new OpenAIApi(config);
          const visionResponse = await openaiVision.createChatCompletion({
            model: aiModel,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Descreva o conteúdo desta imagem de forma objetiva para contexto de atendimento ao cliente." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fileBase64}` } }
                ] as any
              }
            ],
            max_tokens: 300
          });
          visionDescription = visionResponse.data.choices[0]?.message?.content ?? "";
        }
      } catch (err) {
        logger.error(`[AI] Erro na análise de imagem/vídeo: ${err}`);
        visionDescription = "";
      }
    }

    // Fallback se análise falhou ou arquivo não existe
    if (!visionDescription) {
      const mediaType = msg.message?.imageMessage ? "imagem" : "vídeo";
      const fallbackMsg = `Desculpe, não consegui visualizar a ${mediaType} enviada. Poderia descrever o que precisa em texto para que eu possa te ajudar? 😊`;
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, fallbackMsg, ticket, contact);
      return;
    }

    // Contexto com descrição da mídia + histórico de texto
    const caption = msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    const userContent = caption
      ? `[Imagem/vídeo enviado — descrição: ${visionDescription}]\nLegenda do usuário: ${caption}`
      : `[Imagem/vídeo enviado — descrição: ${visionDescription}]`;

    messagesAI = [];
    messagesAI.push({ role: "system", content: promptSystem });
    for (let i = 0; i < Math.min(maxMessages, messages.length); i++) {
      const message = messages[i];
      if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
        messagesAI.push({ role: message.fromMe ? "assistant" : "user", content: message.body });
      }
    }
    messagesAI.push({ role: "user", content: userContent });

    let response = await callAIProvider({
      provider: aiProvider,
      apiKey: prompt.apiKey,
      model: aiModel,
      messages: messagesAI,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
      baseUrl: prompt.baseUrl
    });

    const transferMatchImg = response?.match(/Ação: Transferir para (\d+)/);
    if (transferMatchImg) {
      const targetQueueIdImg = parseInt(transferMatchImg[1]);
      response = response.replace(/Ação: Transferir para \d+/, "").trim();
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await transferQueue(targetQueueIdImg, ticket, contact);
    } else {
      await sendWithTypingDelay(wbot, msg.key.remoteJid!, response!, ticket, contact);
    }
  }
  messagesAI = [];
};
