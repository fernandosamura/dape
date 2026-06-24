import { proto, WASocket } from "baileys";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import { getBodyMessage } from "./wbotMessageListener";
import { handleMkAuthBoleto } from "../IntegrationServices/MkAuthIntegrationService";
import { handleAsaasBoleto } from "../IntegrationServices/AsaasIntegrationService";
import { handleIxcBoleto, handleIxcReligue } from "../IntegrationServices/IxcIntegrationService";

const parseCpfCnpj = (raw: string): string => {
  let cpfcnpj = raw;
  cpfcnpj = cpfcnpj.replace(/\./g, '');
  cpfcnpj = cpfcnpj.replace('-', '')
  cpfcnpj = cpfcnpj.replace('/', '')
  cpfcnpj = cpfcnpj.replace(' ', '')
  cpfcnpj = cpfcnpj.replace(',', '')
  return cpfcnpj;
};

const fetchProviderSettings = async (companyId: number) => {
  const asaastoken = await Setting.findOne({
    where: { key: "asaas", companyId }
  });
  const ixcapikey = await Setting.findOne({
    where: { key: "tokenixc", companyId }
  });
  const urlixcdb = await Setting.findOne({
    where: { key: "ipixc", companyId }
  });
  const ipmkauth = await Setting.findOne({
    where: { key: "ipmkauth", companyId }
  });
  const clientidmkauth = await Setting.findOne({
    where: { key: "clientidmkauth", companyId }
  });
  const clientesecretmkauth = await Setting.findOne({
    where: { key: "clientsecretmkauth", companyId }
  });

  let urlmkauth = ipmkauth.value
  if (urlmkauth.substr(-1) === '/') {
    urlmkauth = urlmkauth.slice(0, -1);
  }

  return {
    mkauth: {
      urlmkauth,
      url: `${urlmkauth}/api/`,
      clientId: clientidmkauth.value,
      clientSecret: clientesecretmkauth.value,
    },
    asaas: {
      asaastk: asaastoken.value,
    },
    ixc: {
      urlixc: urlixcdb.value,
      ixckeybase64: btoa(ixcapikey.value),
    },
    raw: { asaastoken, ixcapikey, urlixcdb, ipmkauth, clientidmkauth, clientesecretmkauth }
  };
};

export const provider = async (ticket: Ticket, msg: proto.IWebMessageInfo, companyId: number, contact: Contact, wbot: WASocket) => {
  const filaescolhida = ticket.queue?.name

  if (filaescolhida === "2ª Via de Boleto" || filaescolhida === "2 Via de Boleto") {
    const rawCpfCnpj = getBodyMessage(msg);
    const cpfcnpj = parseCpfCnpj(rawCpfCnpj);
    const settings = await fetchProviderSettings(companyId);

    if (settings.mkauth.urlmkauth != "" && settings.mkauth.clientId != "" && settings.mkauth.clientSecret != "") {
      await handleMkAuthBoleto(ticket, contact, wbot, cpfcnpj, settings.mkauth);
    }

    if (settings.asaas.asaastk !== "") {
      await handleAsaasBoleto(ticket, contact, wbot, cpfcnpj, settings.asaas);
    }

    if (settings.raw.ixcapikey.value != "" && settings.raw.urlixcdb.value != "") {
      await handleIxcBoleto(ticket, contact, wbot, cpfcnpj, settings.ixc);
    }
  }

  if (filaescolhida === "Religue de Confiança" || filaescolhida === "Liberação em Confiança") {
    const rawCpfCnpj = getBodyMessage(msg);
    const cpfcnpj = parseCpfCnpj(rawCpfCnpj);
    const settings = await fetchProviderSettings(companyId);

    if (settings.raw.ixcapikey.value != "" && settings.raw.urlixcdb.value != "") {
      await handleIxcReligue(ticket, contact, wbot, cpfcnpj, settings.ixc);
    }
  }
};
