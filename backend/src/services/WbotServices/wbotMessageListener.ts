import { uploadToR2, downloadFromR2 } from "../StorageServices/R2Service";
import path, { join } from "path";
import { promisify } from "util";
import { readFile, writeFile } from "fs";
import * as Sentry from "@sentry/node";
import { isNil, isNull, head } from "lodash";
import { extension as mimeExtension } from "mime-types";

import {
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  jidNormalizedUser,
  MessageUpsertType,
  proto,
  WAMessage,
  WAMessageStubType,
  WAMessageUpdate,
  WASocket
} from "baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import { moduleAccessService as moduleAccess } from "../../dape/shared/moduleAccess.service";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import formatBody from "../../helpers/Mustache";
import { Store } from "../../libs/store";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import moment from "moment";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import VerifyCurrentSchedule from "../CompanyService/VerifyCurrentSchedule";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { Op } from "sequelize";
import { campaignQueue, parseToMilliseconds, randomValue } from "../../queues";
import User from "../../models/User";
import Setting from "../../models/Setting";
import { cacheLayer } from "../../libs/cache";
import { provider } from "./providers";
import { debounce } from "../../helpers/Debounce";
import { Configuration, OpenAIApi } from "openai";
import { callAIProvider, AIProvider, AIMessage } from "../AIProviderService/AIProviderRouter";
import ffmpeg from "fluent-ffmpeg";
import {
  SpeechConfig,
  SpeechSynthesizer,
  AudioConfig
} from "microsoft-cognitiveservices-speech-sdk";
import { execSync } from "child_process";
import typebotListener from "../TypebotServices/typebotListener";
import QueueIntegrations from "../../models/QueueIntegrations";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";

import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowDefaultModel } from "../../models/FlowDefault";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { IOpenAi } from "../../@types/openai";
import { dapleShield } from "../../dape/shield/dapleShield.service";

import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { ActionsWebhookService } from "../WebhookService/ActionsWebhookService";
import { WebhookModel } from "../../models/Webhook";

import {differenceInMilliseconds} from "date-fns";
import Whatsapp from "../../models/Whatsapp";
import {
  isNumeric,
  validaCpfCnpj,
  sleep,
  makeid,
  sanitizeName,
  keepOnlySpecifiedChars
} from "../../utils/generalHelpers";
import {
  getTypeMessage,
  hasCaption,
  getBodyButton,
  msgLocation,
  getBodyMessage,
  getQuotedMessage,
  getQuotedMessageId,
  getMeSocket,
  getSenderMessage,
  getContactMessage,
  isValidMsg,
  filterMessages
} from "./wbotMessageParsers";
import {
  sendMessageImage,
  sendMessageLink,
  downloadMedia,
  resolveLidToPhone,
  verifyContact,
  verifyQuotedMessage,
  convertToOggOpus,
  convertTextToSpeechAzure,
  convertTextToSpeechGoogle,
  convertTextToSpeechAndSaveToFile,
  deleteFileSync,
  verifyMessage,
  verifyMediaMessage
} from "./wbotMessageMedia";
import { handleOpenAi, transferQueue } from "./wbotMessageAI";
import { handleMessageIntegration } from "./wbotMessageFlowBuilder";
import {
  verifyQueue,
  verifyRating,
  handleRating,
  handleChartbot
} from "./wbotMessageMenu";
import { BaileysChannel } from "../MessageChannel/BaileysChannel";

const request = require("request");

const fs = require("fs");

export type Session = WASocket & {
  id?: number;
  store?: Store;
};



interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

export interface IMe {
  name: string;
  id: string;
}

interface IMessage {
  messages: WAMessage[];
  isLatest: boolean;
}

const writeFileAsync = promisify(writeFile);

const Push = (msg: proto.IWebMessageInfo) => {
  return msg.pushName;
};

// Classifica a mensagem Baileys pro motor de IA (handleOpenAi, #031 Fase C) -
// mesma logica de deteccao de tipo que a funcao ja fazia internamente antes
// da extracao, agora explicita pro chamador poder passar pros dois
// transportes (Baileys e Cloud API).
const classifyBaileysMsgForAI = (
  msg: proto.IWebMessageInfo
): { messageKind: "text" | "audio" | "image_video" | "other"; caption: string } => {
  if (msg.message?.audioMessage) return { messageKind: "audio", caption: "" };
  if (msg.message?.imageMessage || msg.message?.videoMessage) {
    return {
      messageKind: "image_video",
      caption:
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        ""
    };
  }
  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    return { messageKind: "text", caption: "" };
  }
  return { messageKind: "other", caption: "" };
};

const handleMessage = async (
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<void> => {
  let mediaSent: Message | undefined;
  const channel = new BaileysChannel();

  if (!isValidMsg(msg)) return;

  try {
    let msgContact: IMe;
    let groupContact: Contact | undefined;

    const isGroup = msg.key.remoteJid?.endsWith("@g.us");

    const msgIsGroupBlock = await Setting.findOne({
      where: {
        companyId,
        key: "CheckMsgIsGroup"
      }
    });

    const bodyMessage = getBodyMessage(msg);
    const msgType = getTypeMessage(msg);

    const hasMedia =
      msg.message?.audioMessage ||
      msg.message?.imageMessage ||
      msg.message?.videoMessage ||
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage ||
      msg.message.stickerMessage;
    if (msg.key.fromMe) {
      if (/\u200e/.test(bodyMessage)) return;

      if (
        !hasMedia &&
        msgType !== "conversation" &&
        msgType !== "extendedTextMessage" &&
        msgType !== "vcard"
      )
        return;
      msgContact = await getContactMessage(msg, wbot);
    } else {
      msgContact = await getContactMessage(msg, wbot);
    }

    if (msgIsGroupBlock?.value === "enabled" && isGroup) return;

    if (isGroup) {
      const grupoMeta = await wbot.groupMetadata(msg.key.remoteJid);
      const msgGroupContact = {
        id: grupoMeta.id,
        name: grupoMeta.subject
      };
      groupContact = await verifyContact(msgGroupContact, wbot, companyId);
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!, companyId);
    const contact = await verifyContact(msgContact, wbot, companyId);

    let unreadMessages = 0;

    if (msg.key.fromMe) {
      await cacheLayer.set(`contacts:${contact.id}:unreads`, "0");
    } else {
      const unreads = await cacheLayer.get(`contacts:${contact.id}:unreads`);
      unreadMessages = +unreads + 1;
      await cacheLayer.set(
        `contacts:${contact.id}:unreads`,
        `${unreadMessages}`
      );
    }

    const lastMessage = await Message.findOne({
      where: {
        contactId: contact.id,
        companyId
      },
      order: [["createdAt", "DESC"]]
    });

    if (
      unreadMessages === 0 &&
      whatsapp.complationMessage &&
      formatBody(whatsapp.complationMessage, contact).trim().toLowerCase() ===
        lastMessage?.body.trim().toLowerCase()
    ) {
      return;
    }

    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!,
      unreadMessages,
      companyId,
      groupContact
    );

    await provider(ticket, msg, companyId, contact, wbot as WASocket);

    // voltar para o menu inicial

    if (bodyMessage == "#") {
      await ticket.update({
        queueOptionId: null,
        chatbot: false,
        queueId: null
      });
      await verifyQueue(
        channel,
        ticket,
        ticket.contact,
        bodyMessage,
        msg.key.fromMe,
        mediaSent,
        { wbot, msg }
      );
      return;
    }

    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId,
      whatsappId: whatsapp?.id
    });

    try {
      if (!msg.key.fromMe) {

        if (ticketTraking !== null && verifyRating(ticketTraking)) {
          handleRating(parseFloat(bodyMessage), ticket, ticketTraking);
          return;
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    // Atualiza o ticket se a ultima mensagem foi enviada por mim, para que possa ser finalizado.
    try {
      await ticket.update({
        fromMe: msg.key.fromMe
      });
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (hasMedia) {
      mediaSent = await verifyMediaMessage(msg, ticket, contact);
    } else {
      await verifyMessage(msg, ticket, contact);
    }

    // Non-blocking SDR qualification for first message from a contact
    if (!msg.key.fromMe && unreadMessages === 1) {
      try {
        const { SDRAgent } = await import('../../dape/agents/SDRAgent');
        const sdrAgent = new SDRAgent(companyId);
        const msgBody = getBodyMessage(msg) || '';
        sdrAgent.qualifyLead(contact.id, msgBody).then(result => {
          if (result) {
            console.log(`[wbotMessageListener] SDR qualification for contact ${contact.id}:`, result);
          }
        }).catch(err => {
          console.error('[wbotMessageListener] SDR qualification error (non-blocking):', err);
        });
      } catch (err) {
        // completely non-blocking — never throw
      }
    }

    // Non-blocking Pipeline stage analysis every 5 inbound messages
    if (!msg.key.fromMe && unreadMessages > 0 && unreadMessages % 5 === 0) {
      (async () => {
        try {
          const { PipelineAgent } = await import('../../dape/agents/PipelineAgent');
          const agent = new PipelineAgent(companyId);
          const result = await agent.analyzeConversationAndSuggestStage(
            contact.id,
            ticket.id,
            companyId
          );

          if (result && result.shouldAdvance && result.confidence === 'high') {
            // Auto-advance the deal stage
            const DapeDeal = (await import('../../models/DapeDeal')).default;
            await DapeDeal.update(
              { stage: result.suggestedStage },
              { where: { id: result.dealId, companyId, status: 'open' } }
            );
            console.log(
              `[PipelineAgent] Auto-advanced deal ${result.dealId} from "${result.currentStage}" to "${result.suggestedStage}" — ${result.reasoning}`
            );
          } else if (result && result.shouldAdvance && result.confidence === 'medium') {
            // Log suggestion for human review (don't auto-update)
            console.log(
              `[PipelineAgent] Stage suggestion (medium confidence) for deal ${result.dealId}: "${result.currentStage}" → "${result.suggestedStage}" — ${result.reasoning} [human review needed]`
            );
          }
        } catch (err) {
          console.error('[wbotMessageListener] PipelineAgent error (non-blocking):', err);
        }
      })();
    }

    const currentSchedule = await VerifyCurrentSchedule(companyId);
    const scheduleType = await Setting.findOne({
      where: {
        companyId,
        key: "scheduleType"
      }
    });

    // DAPLE Shield — non-blocking check for out-of-hours / greeting auto-responses
    const shieldAutoResponse = await dapleShield.evaluate({
      companyId: ticket.companyId,
      whatsappId: ticket.whatsappId,
      source: "bot",
      ticketId: ticket.id,
      contactNumber: contact.number
    });
    if (!shieldAutoResponse.allowed) {
      logger.warn(`[DapleShield] Alerta Shield (saudação/fora-horário, envio permitido): ${shieldAutoResponse.reason}`);
      // non-blocking: continue execution
    }

    try {
      if (!msg.key.fromMe && scheduleType) {
        /**
         * Tratamento para envio de mensagem quando a empresa está fora do expediente
         */
        if (
          scheduleType.value === "company" &&
          !isNil(currentSchedule) &&
          (!currentSchedule || currentSchedule.inActivity === false)
        ) {
          const body = `\u200e ${whatsapp.outOfHoursMessage}`;

          const debouncedSentMessage = debounce(
            async () => {
              await wbot.sendMessage(
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`,
                {
                  text: body
                }
              );
            },
            3000,
            ticket.id
          );
          debouncedSentMessage();
          return;
        }

        if (scheduleType.value === "queue" && ticket.queueId !== null) {
          /**
           * Tratamento para envio de mensagem quando a fila está fora do expediente
           */
          const queue = await Queue.findByPk(ticket.queueId);

          const { schedules }: any = queue;
          const now = moment();
          const weekday = now.format("dddd").toLowerCase();
          let schedule = null;

          if (Array.isArray(schedules) && schedules.length > 0) {
            schedule = schedules.find(
              s =>
                s.weekdayEn === weekday &&
                s.startTime !== "" &&
                s.startTime !== null &&
                s.endTime !== "" &&
                s.endTime !== null
            );
          }

          if (
            scheduleType.value === "queue" &&
            queue.outOfHoursMessage !== null &&
            queue.outOfHoursMessage !== "" &&
            !isNil(schedule)
          ) {
            const startTime = moment(schedule.startTime, "HH:mm");
            const endTime = moment(schedule.endTime, "HH:mm");

            if (now.isBefore(startTime) || now.isAfter(endTime)) {
              const body = `${queue.outOfHoursMessage}`;
              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(
                    `${ticket.contact.number}@${
                      ticket.isGroup ? "g.us" : "s.whatsapp.net"
                    }`,
                    {
                      text: body
                    }
                  );
                },
                3000,
                ticket.id
              );
              debouncedSentMessage();
              return;
            }
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    const flow = await FlowBuilderModel.findOne({
      where: {
        id: ticket.flowStopped
      }
    });

    let isMenu = false;
    let isOpenai = false;
    let isQuestion = false;

    if (flow) {
      isMenu =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "menu";
      isOpenai =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "openai";
      isQuestion =
        flow.flow["nodes"].find((node: any) => node.id === ticket.lastFlowId)
          ?.type === "question";
    }

    if (!isNil(flow) && isQuestion && !msg.key.fromMe) {
      console.log(
        "|============= QUESTION =============|",
        JSON.stringify(flow, null, 4)
      );
      const body = getBodyMessage(msg);
      if (body) {
        const nodes: INodes[] = flow.flow["nodes"];
        const nodeSelected = flow.flow["nodes"].find(
          (node: any) => node.id === ticket.lastFlowId
        );

        const connections: IConnections[] = flow.flow["connections"];

        const { message, answerKey } = nodeSelected.data.typebotIntegration;
        const oldDataWebhook = ticket.dataWebhook;

        const nodeIndex = nodes.findIndex(node => node.id === nodeSelected.id);

        const lastFlowId = nodes[nodeIndex + 1].id;
        await ticket.update({
          lastFlowId: lastFlowId,
          dataWebhook: {
            variables: {
              [answerKey]: body
            }
          }
        });

        await ticket.save();

        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };

        await ActionsWebhookService(
          whatsapp.id,
          parseInt(ticket.flowStopped),
          ticket.companyId,
          nodes,
          connections,
          lastFlowId,
          null,
          "",
          "",
          "",
          ticket.id,
          mountDataContact,
          msg
        );
      }

      return;
    }

    if (isOpenai && !isNil(flow) && !ticket.queue) {
      const nodeSelected = flow.flow["nodes"].find(
        (node: any) => node.id === ticket.lastFlowId
      );
      let {
        name,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens,
        temperature,
        apiKey,
        queueId,
        maxMessages
      } = nodeSelected.data.typebotIntegration as IOpenAi;

      let openAiSettings = {
        name,
        prompt,
        voice,
        voiceKey,
        voiceRegion,
        maxTokens: parseInt(maxTokens),
        temperature: parseInt(temperature),
        apiKey,
        queueId: parseInt(queueId),
        maxMessages: parseInt(maxMessages)
      };

      {
        const { messageKind, caption } = classifyBaileysMsgForAI(msg);
        await handleOpenAi(
          channel,
          ticket,
          contact,
          mediaSent,
          bodyMessage,
          messageKind,
          caption,
          ticketTraking,
          openAiSettings,
          { wbot, msg }
        );
      }

      return;
    }

    //openai na conexao
    if (
      !ticket.queue &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(whatsapp.promptId)
    ) {
      const { messageKind, caption } = classifyBaileysMsgForAI(msg);
      await handleOpenAi(
        channel,
        ticket,
        contact,
        mediaSent,
        bodyMessage,
        messageKind,
        caption,
        undefined,
        undefined,
        { wbot, msg }
      );
    }

    //integraçao na conexao
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      ticket.chatbot &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu
      );

      return;
    }

    //openai na fila
    if (
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      !isNil(ticket.promptId) &&
      ticket.useIntegration &&
      ticket.queueId
    ) {
      const { messageKind, caption } = classifyBaileysMsgForAI(msg);
      await handleOpenAi(
        channel,
        ticket,
        contact,
        mediaSent,
        bodyMessage,
        messageKind,
        caption,
        undefined,
        undefined,
        { wbot, msg }
      );
    }

    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.userId &&
      ticket.integrationId &&
      ticket.useIntegration &&
      ticket.queue
    ) {
      console.log("entrou no type 1974");
      const integrations = await ShowQueueIntegrationService(
        ticket.integrationId,
        companyId
      );

      const isFirstMsg = await Ticket.findOne({
        where: {
          contactId: groupContact ? groupContact.id : contact.id,
          companyId,
          whatsappId: whatsapp.id
        },
        order: [["id", "DESC"]]
      });

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    if (
      !ticket.queue &&
      !ticket.isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1 &&
      !ticket.useIntegration
    ) {
      await verifyQueue(
        channel,
        ticket,
        contact,
        bodyMessage,
        msg.key.fromMe,
        mediaSent,
        { wbot, msg }
      );

      if (ticketTraking && ticketTraking.chatbotAt === null) {
        await ticketTraking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    const isFirstMsg = await Ticket.findOne({
      where: {
        contactId: groupContact ? groupContact.id : contact.id,
        companyId,
        whatsappId: whatsapp.id
      },
      order: [["id", "DESC"]]
    });

    // integração flowbuilder
    if (
      !msg.key.fromMe &&
      !ticket.isGroup &&
      !ticket.queue &&
      !ticket.user &&
      !isNil(whatsapp.integrationId) &&
      !ticket.useIntegration
    ) {

      const integrations = await ShowQueueIntegrationService(
        whatsapp.integrationId,
        companyId
      );

      await handleMessageIntegration(
        msg,
        wbot,
        integrations,
        ticket,
        companyId,
        isMenu,
        whatsapp,
        contact,
        isFirstMsg
      );
    }

    const dontReadTheFirstQuestion = ticket.queue === null;

    await ticket.reload();

    try {
      //Fluxo fora do expediente
      if (!msg.key.fromMe && scheduleType && ticket.queueId !== null) {
        /**
         * Tratamento para envio de mensagem quando a fila está fora do expediente
         */
        const queue = await Queue.findByPk(ticket.queueId);

        const { schedules }: any = queue;
        const now = moment();
        const weekday = now.format("dddd").toLowerCase();
        let schedule = null;

        if (Array.isArray(schedules) && schedules.length > 0) {
          schedule = schedules.find(
            s =>
              s.weekdayEn === weekday &&
              s.startTime !== "" &&
              s.startTime !== null &&
              s.endTime !== "" &&
              s.endTime !== null
          );
        }

        if (
          scheduleType.value === "queue" &&
          queue.outOfHoursMessage !== null &&
          queue.outOfHoursMessage !== "" &&
          !isNil(schedule)
        ) {
          const startTime = moment(schedule.startTime, "HH:mm");
          const endTime = moment(schedule.endTime, "HH:mm");

          if (now.isBefore(startTime) || now.isAfter(endTime)) {
            const body = queue.outOfHoursMessage;
            const debouncedSentMessage = debounce(
              async () => {
                await wbot.sendMessage(
                  `${ticket.contact.number}@${
                    ticket.isGroup ? "g.us" : "s.whatsapp.net"
                  }`,
                  {
                    text: body
                  }
                );
              },
              3000,
              ticket.id
            );
            debouncedSentMessage();
            return;
          }
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.log(e);
    }

    if (
      !whatsapp?.queues?.length &&
      !ticket.userId &&
      !isGroup &&
      !msg.key.fromMe
    ) {
      const lastMessage = await Message.findOne({
        where: {
          ticketId: ticket.id,
          fromMe: true
        },
        order: [["createdAt", "DESC"]]
      });

      if (lastMessage && lastMessage.body.includes(whatsapp.greetingMessage)) {
        return;
      }

      if (whatsapp.greetingMessage) {
        const debouncedSentMessage = debounce(
          async () => {
            await wbot.sendMessage(
              `${ticket.contact.number}@${
                ticket.isGroup ? "g.us" : "s.whatsapp.net"
              }`,
              {
                text: whatsapp.greetingMessage
              }
            );
          },
          1000,
          ticket.id
        );
        debouncedSentMessage();
        return;
      }
    }

    if (whatsapp.queues.length == 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(ticket, bodyMessage, channel, false, { wbot, msg });
      }
    }

    if (whatsapp.queues.length > 1 && ticket.queue) {
      if (ticket.chatbot && !msg.key.fromMe) {
        await handleChartbot(
          ticket,
          bodyMessage,
          channel,
          dontReadTheFirstQuestion,
          { wbot, msg }
        );
      }
    }

  } catch (err) {
    console.log(err);
    Sentry.captureException(err);
    logger.error(`Error handling whatsapp message: Err: ${err}`);
  }
};

const handleMsgAck = async (
  msg: WAMessage,
  chat: number | null | undefined
) => {
  await new Promise(r => setTimeout(r, 500));
  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(msg.key.id, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });

    if (!messageToUpdate) return;
    await messageToUpdate.update({ ack: chat });
    io.to(messageToUpdate.ticketId.toString()).emit(
      `company-${messageToUpdate.companyId}-appMessage`,
      {
        action: "update",
        message: messageToUpdate
      }
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack. Err: ${err}`);
  }
};

const verifyCampaignMessageAndCloseTicket = async (
  message: proto.IWebMessageInfo,
  companyId: number
) => {
  const io = getIO();
  const body = getBodyMessage(message);
  const isCampaign = /\u200c/.test(body);
  if (message.key.fromMe && isCampaign) {
    const messageRecord = await Message.findOne({
      where: { id: message.key.id!, companyId }
    });
    const ticket = await Ticket.findByPk(messageRecord.ticketId);
    await ticket.update({ status: "closed" });

    io.to(`company-${ticket.companyId}-open`)
      .to(`queue-${ticket.queueId}-open`)
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "delete",
        ticket,
        ticketId: ticket.id
      });

    io.to(`company-${ticket.companyId}-${ticket.status}`)
      .to(`queue-${ticket.queueId}-${ticket.status}`)
      .to(ticket.id.toString())
      .emit(`company-${ticket.companyId}-ticket`, {
        action: "update",
        ticket,
        ticketId: ticket.id
      });
  }
};

const wbotMessageListener = async (
  wbot: Session,
  companyId: number
): Promise<void> => {
  try {
    wbot.ev.on("messages.upsert", async (messageUpsert: ImessageUpsert) => {
      const messages = messageUpsert.messages
        .filter(filterMessages)
        .map(msg => msg);

      if (!messages) return;

      for (const message of messages) {
        const messageExists = await Message.count({
          where: { id: message.key.id!, companyId }
        });

        if (!messageExists) {
          await handleMessage(message, wbot, companyId);
          await verifyCampaignMessageAndCloseTicket(message, companyId);
        }
      }
    });

    wbot.ev.on("messages.update", (messageUpdate: WAMessageUpdate[]) => {
      if (messageUpdate.length === 0) return;
      messageUpdate.forEach(async (message: WAMessageUpdate) => {
        (wbot as WASocket)!.readMessages([message.key]);

        handleMsgAck(message, message.update.status);
      });
    });

    // wbot.ev.on("messages.set", async (messageSet: IMessage) => {
    //   messageSet.messages.filter(filterMessages).map(msg => msg);
    // });
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Error handling wbot message listener. Err: ${error}`);
  }
};

// Re-exportadas aqui pra nao quebrar os imports externos existentes
// (isNumeric, sleep, validaCpfCnpj, makeid, sanitizeName, keepOnlySpecifiedChars
// agora moram em utils/generalHelpers.ts - ver #031 Fase 1)
export {
  isNumeric,
  validaCpfCnpj,
  sleep,
  makeid,
  sanitizeName,
  keepOnlySpecifiedChars
};

// idem para as funcoes de parsing de mensagem - #031 Fase 2
// (getBodyMessage e usada por providers.ts, typebotListener.ts e OpenAiService.ts;
// as demais nao tem consumidor externo hoje, mas ja estavam exportadas)
export {
  getTypeMessage,
  hasCaption,
  getBodyButton,
  msgLocation,
  getBodyMessage,
  getQuotedMessage,
  getQuotedMessageId,
  getMeSocket,
  getSenderMessage,
  getContactMessage,
  isValidMsg,
  filterMessages
};

// idem para midia/TTS - #031 Fase 3
// (sendMessageImage, sendMessageLink, verifyMessage e verifyMediaMessage tem
// consumidor externo real - MkAuth/Ixc/AsaasIntegrationService, wbotClosedTickets,
// UpdateTicketService, OpenAiService. verifyMessage e verifyMediaMessage moraram
// aqui junto pra evitar dependencia circular real em runtime com
// sendMessageImage/sendMessageLink, que chamam verifyMessage)
export {
  sendMessageImage,
  sendMessageLink,
  downloadMedia,
  resolveLidToPhone,
  verifyContact,
  verifyQuotedMessage,
  convertToOggOpus,
  convertTextToSpeechAzure,
  convertTextToSpeechGoogle,
  convertTextToSpeechAndSaveToFile,
  deleteFileSync,
  verifyMessage,
  verifyMediaMessage
};

// idem para o motor de IA - #031 Fase 4
// (transferQueue tem consumidor externo real - OpenAiService.ts;
// handleOpenAi nao tem consumidor externo hoje mas ja estava exportado)
export { handleOpenAi, transferQueue };

// idem para o motor de Flow Builder - #031 Fase 5
// (flowbuilderIntegration e flowBuilderQueue nunca foram exportadas -
// so handleMessageIntegration, sem consumidor externo hoje mas ja estava)
export { handleMessageIntegration };

// idem para o motor de Menu/Chatbot - #031 Fase 6
// (verifyQueue, verifyRating, handleRating e handleChartbot nao tem
// consumidor externo hoje, mas ja estavam exportadas)
export { verifyQueue, verifyRating, handleRating, handleChartbot };

export { wbotMessageListener, handleMessage };
