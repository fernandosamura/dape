import { head, isNil } from "lodash";
import moment from "moment";
import { proto } from "baileys";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import Setting from "../../models/Setting";
import UserRating from "../../models/UserRating";

import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import { dapleShield } from "../../dape/shield/dapleShield.service";
import formatBody from "../../helpers/Mustache";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import { handleOpenAi } from "./wbotMessageAI";
import { handleMessageIntegration } from "./wbotMessageFlowBuilder";
import type { Session } from "./wbotMessageListener";
import { MessageChannel } from "../MessageChannel/MessageChannelTypes";
import { getMessageChannel } from "../MessageChannel/getMessageChannel";
import { sendAndPersistText } from "../MessageChannel/sendAndPersist";

// Contexto so preenchido quando a mensagem veio de uma sessao Baileys - usado
// so pra repassar pros motores de IA/Flow Builder (ainda Baileys-only,
// pendentes das Fases C/D). Numa conexao Cloud API isso fica undefined, e as
// chamadas a esses motores sao puladas com um aviso claro em vez de quebrar.
export interface BaileysBotContext {
  wbot: Session;
  msg: proto.IWebMessageInfo;
}

const verifyQueue = async (
  channel: MessageChannel,
  ticket: Ticket,
  contact: Contact,
  messageBody: string,
  fromMe: boolean,
  mediaSent?: Message | undefined,
  baileysCtx?: BaileysBotContext
) => {
  const companyId = ticket.companyId;

  // DAPLE Shield — automated queue/greeting messages are blocking
  const shieldResultQueue = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "bot",
    ticketId: ticket.id,
  });
  if (!shieldResultQueue.allowed) {
    logger.warn(`[DAPLE Shield] Queue/greeting message blocked for ticket ${ticket.id}: ${shieldResultQueue.reason}`);
    return;
  }

  const { queues, greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    await ShowWhatsAppService(ticket.whatsappId, ticket.companyId);

  if (queues.length === 1) {
    const sendGreetingMessageOneQueues = await Setting.findOne({
      where: {
        key: "sendGreetingMessageOneQueues",
        companyId: ticket.companyId
      }
    });

    if (
      greetingMessage.length > 1 &&
      sendGreetingMessageOneQueues?.value === "enabled"
    ) {
      const body = formatBody(`${greetingMessage}`, contact);
      await sendAndPersistText(channel, ticket, body);
    }

    const firstQueue = head(queues);
    let chatbot = false;
    if (firstQueue?.options) {
      chatbot = firstQueue.options.length > 0;
    }

    //inicia integração dialogflow/n8n
    if (!fromMe && !ticket.isGroup && !isNil(queues[0]?.integrationId)) {
      if (baileysCtx) {
        const integrations = await ShowQueueIntegrationService(
          queues[0].integrationId,
          companyId
        );

        await handleMessageIntegration(
          baileysCtx.msg,
          baileysCtx.wbot,
          integrations,
          ticket,
          companyId
        );

        await ticket.update({
          useIntegration: true,
          integrationId: queues[0].integrationId
        });
      } else {
        logger.warn(
          `[MetaCloud] Integração de fila (n8n/webhook) ainda não suportada para tickets Cloud API — pendente Fase D (ticket ${ticket.id})`
        );
      }
      // return;
    }
    //inicia integração openai
    if (!fromMe && !ticket.isGroup && !isNil(queues[0]?.promptId)) {
      if (baileysCtx) {
        await handleOpenAi(
          baileysCtx.msg,
          baileysCtx.wbot,
          ticket,
          contact,
          mediaSent
        );

        await ticket.update({
          useIntegration: true,
          promptId: queues[0]?.promptId
        });
      } else {
        logger.warn(
          `[MetaCloud] IA ainda não suportada para tickets Cloud API — pendente Fase C (ticket ${ticket.id})`
        );
      }
      // return;
    }

    await UpdateTicketService({
      ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    return;
  }

  const selectedOption = messageBody;
  const choosenQueue = queues[+selectedOption - 1];

  const buttonActive = await Setting.findOne({
    where: {
      key: "chatBotType",
      companyId
    }
  });

  const botText = async () => {
    let options = "";

    queues.forEach((queue, index) => {
      options += `*[ ${index + 1} ]* - ${queue.name}\n`;
    });

    const body = formatBody(`\u200e${greetingMessage}\n\n${options}`, contact);
    await sendAndPersistText(channel, ticket, body);
  };

  if (choosenQueue) {
    let chatbot = false;
    if (choosenQueue?.options) {
      chatbot = choosenQueue.options.length > 0;
    }

    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id, chatbot },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    /* Tratamento para envio de mensagem quando a fila está fora do expediente */
    if (choosenQueue.options.length === 0) {
      const queue = await Queue.findByPk(choosenQueue.id);
      const { schedules }: any = queue;
      const now = moment();
      const weekday = now.format("dddd").toLowerCase();
      let schedule;
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
        queue.outOfHoursMessage !== null &&
        queue.outOfHoursMessage !== "" &&
        !isNil(schedule)
      ) {
        const startTime = moment(schedule.startTime, "HH:mm");
        const endTime = moment(schedule.endTime, "HH:mm");

        if (now.isBefore(startTime) || now.isAfter(endTime)) {
          const body = formatBody(
            `\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`,
            ticket.contact
          );
          await sendAndPersistText(channel, ticket, body);
          await UpdateTicketService({
            ticketData: { queueId: null, chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId
          });
          return;
        }
      }

      //inicia integração dialogflow/n8n
      if (!fromMe && !ticket.isGroup && choosenQueue.integrationId) {
        if (baileysCtx) {
          const integrations = await ShowQueueIntegrationService(
            choosenQueue.integrationId,
            companyId
          );

          await handleMessageIntegration(
            baileysCtx.msg,
            baileysCtx.wbot,
            integrations,
            ticket,
            companyId
          );

          await ticket.update({
            useIntegration: true,
            integrationId: choosenQueue.integrationId
          });
        } else {
          logger.warn(
            `[MetaCloud] Integração de fila (n8n/webhook) ainda não suportada para tickets Cloud API — pendente Fase D (ticket ${ticket.id})`
          );
        }
        // return;
      }

      //inicia integração openai
      if (!fromMe && !ticket.isGroup && !isNil(choosenQueue?.promptId)) {
        if (baileysCtx) {
          await handleOpenAi(
            baileysCtx.msg,
            baileysCtx.wbot,
            ticket,
            contact,
            mediaSent
          );

          await ticket.update({
            useIntegration: true,
            promptId: choosenQueue?.promptId
          });
        } else {
          logger.warn(
            `[MetaCloud] IA ainda não suportada para tickets Cloud API — pendente Fase C (ticket ${ticket.id})`
          );
        }
        // return;
      }

      if (choosenQueue.greetingMessage) {
        const body = formatBody(
          `\u200e${choosenQueue.greetingMessage}`,
          ticket.contact
        );
        await sendAndPersistText(channel, ticket, body);
      }
    }
  } else {
    if (
      maxUseBotQueues &&
      maxUseBotQueues !== 0 &&
      ticket.amountUsedBotQueues >= maxUseBotQueues
    ) {
      // await UpdateTicketService({
      //   ticketData: { queueId: queues[0].id },
      //   ticketId: ticket.id
      // });

      return;
    }

    //Regra para desabilitar o chatbot por x minutos/horas após o primeiro envio
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId: ticket.id,
      companyId
    });
    let dataLimite = new Date();
    let Agora = new Date();

    if (ticketTraking.chatbotAt !== null) {
      dataLimite.setMinutes(
        ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
      );

      if (
        ticketTraking.chatbotAt !== null &&
        Agora < dataLimite &&
        timeUseBotQueues !== "0" &&
        ticket.amountUsedBotQueues !== 0
      ) {
        return;
      }
    }
    await ticketTraking.update({
      chatbotAt: null
    });

    if (buttonActive.value === "text") {
      return botText();
    }
  }
};

export const verifyRating = (ticketTraking: TicketTraking) => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    ticketTraking.userId !== null &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
) => {
  const io = getIO();

  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  let finalRate = rate;

  if (rate < 1) {
    finalRate = 1;
  }
  if (rate > 5) {
    finalRate = 5;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  if (complationMessage) {
    const channel = await getMessageChannel(ticket);
    const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
    await sendAndPersistText(channel, ticket, body);
  }

  await ticketTraking.update({
    finishedAt: moment().toDate(),
    rated: true
  });

  await ticket.update({
    queueId: null,
    chatbot: null,
    queueOptionId: null,
    userId: null,
    status: "closed"
  });

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
};

export const handleChartbot = async (
  ticket: Ticket,
  messageBody: string,
  channel: MessageChannel,
  dontReadTheFirstQuestion: boolean = false,
  baileysCtx?: BaileysBotContext
) => {
  // DAPLE Shield — chatbot responses are blocking
  const shieldResultBot = await dapleShield.evaluate({
    companyId: ticket.companyId,
    whatsappId: ticket.whatsappId,
    source: "bot",
    ticketId: ticket.id,
  });
  if (!shieldResultBot.allowed) {
    logger.warn(`[DAPLE Shield] Chatbot response blocked for ticket ${ticket.id}: ${shieldResultBot.reason}`);
    return;
  }

  const queue = await Queue.findByPk(ticket.queueId, {
    include: [
      {
        model: QueueOption,
        as: "options",
        where: { parentId: null },
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"]
        ]
      }
    ]
  });

  if (messageBody == "#") {
    // voltar para o menu inicial
    await ticket.update({ queueOptionId: null, chatbot: false, queueId: null });
    await verifyQueue(channel, ticket, ticket.contact, messageBody, false, undefined, baileysCtx);
    return;
  }

  // voltar para o menu anterior
  if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody == "0") {
    const option = await QueueOption.findByPk(ticket.queueOptionId);
    await ticket.update({ queueOptionId: option?.parentId });

    // escolheu uma opção
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const count = await QueueOption.count({
      where: { parentId: ticket.queueOptionId }
    });
    let option: any = {};
    if (count == 1) {
      option = await QueueOption.findOne({
        where: { parentId: ticket.queueOptionId }
      });
    } else {
      option = await QueueOption.findOne({
        where: {
          option: messageBody || "",
          parentId: ticket.queueOptionId
        }
      });
    }
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }

    // não linha a primeira pergunta
  } else if (
    !isNil(queue) &&
    isNil(ticket.queueOptionId) &&
    !dontReadTheFirstQuestion
  ) {
    const option = queue?.options.find(o => o.option == messageBody);
    if (option) {
      await ticket.update({ queueOptionId: option?.id });
    }
  }

  await ticket.reload();

  if (!isNil(queue) && isNil(ticket.queueOptionId)) {
    const queueOptions = await QueueOption.findAll({
      where: { queueId: ticket.queueId, parentId: null },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    const companyId = ticket.companyId;

    const buttonActive = await Setting.findOne({
      where: {
        key: "chatBotType",
        companyId
      }
    });

    const botButton = async () => {
      const buttons = [];
      queueOptions.forEach((option, i) => {
        buttons.push({
          buttonId: `${option.option}`,
          buttonText: { displayText: option.title },
          type: 4
        });
      });
      buttons.push({
        buttonId: `#`,
        buttonText: { displayText: "Menu inicial *[ 0 ]* Menu anterior" },
        type: 4
      });

      // Botoes interativos so existem no Baileys - na Cloud API, cai pro
      // texto simples (botText) ate a Fase E revisitar UI rica de campanha
      // e templates. Fora isso, mesmo texto/legenda de sempre.
      const body = formatBody(`\u200e${queue.greetingMessage}`, ticket.contact);
      await sendAndPersistText(channel, ticket, body);
    };

    const botText = async () => {
      let options = "";

      queueOptions.forEach((option, i) => {
        options += `*[ ${option.option} ]* - ${option.title}\n`;
      });
      //options += `\n*[ 0 ]* - Menu anterior`;
      options += `\n*[ # ]* - Menu inicial`;

      const body = formatBody(
        `\u200e${queue.greetingMessage}\n\n${options}`,
        ticket.contact
      );
      await sendAndPersistText(channel, ticket, body);
    };

    if (buttonActive.value === "button" && QueueOption.length <= 4) {
      return botButton();
    }

    if (buttonActive.value === "text") {
      return botText();
    }

    if (buttonActive.value === "button" && QueueOption.length > 4) {
      return botText();
    }
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const currentOption = await QueueOption.findByPk(ticket.queueOptionId);
    const queueOptions = await QueueOption.findAll({
      where: { parentId: ticket.queueOptionId },
      order: [
        ["option", "ASC"],
        ["createdAt", "ASC"]
      ]
    });

    if (queueOptions.length > -1) {
      const companyId = ticket.companyId;
      const buttonActive = await Setting.findOne({
        where: {
          key: "chatBotType",
          companyId
        }
      });

      const botList = async () => {
        const body = formatBody(`\u200e${currentOption.message}`, ticket.contact);
        await sendAndPersistText(channel, ticket, body);
      };

      const botButton = async () => {
        const body = formatBody(`\u200e${currentOption.message}`, ticket.contact);
        await sendAndPersistText(channel, ticket, body);
      };

      const botText = async () => {
        let options = "";

        queueOptions.forEach((option, i) => {
          options += `*[ ${option.option} ]* - ${option.title}\n`;
        });
        options += `\n*[ 0 ]* - Menu anterior`;
        options += `\n*[ # ]* - Menu inicial`;
        const body = formatBody(
          `\u200e${currentOption.message}\n\n${options}`,
          ticket.contact
        );
        await sendAndPersistText(channel, ticket, body);
      };

      if (buttonActive.value === "list") {
        return botList();
      }

      if (buttonActive.value === "button" && QueueOption.length <= 4) {
        return botButton();
      }

      if (buttonActive.value === "text") {
        return botText();
      }

      if (buttonActive.value === "button" && QueueOption.length > 4) {
        return botText();
      }
    }
  }
};

export { verifyQueue };
