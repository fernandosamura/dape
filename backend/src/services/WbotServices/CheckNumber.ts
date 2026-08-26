import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";
import { isMetaCloudProvider } from "../../helpers/isMetaCloudProvider";

interface IOnWhatsapp {
  jid: string;
  exists: boolean;
}

const checker = async (number: string, wbot: any) => {
  const [validNumber] = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);
  return validNumber;
};

const CheckContactNumber = async (
  number: string,
  companyId: number
): Promise<IOnWhatsapp> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  // A Cloud API nao oferece um pre-check equivalente ao onWhatsApp do Baileys -
  // a validacao real acontece no proprio envio da mensagem.
  if (isMetaCloudProvider(defaultWhatsapp.providerType)) {
    return { jid: `${number.replace(/\D/g, "")}@s.whatsapp.net`, exists: true };
  }

  const wbot = getWbot(defaultWhatsapp.id);
  const isNumberExit = await checker(number, wbot);

  if (!isNumberExit) {
    throw new AppError("ERR_CHECK_NUMBER");
  }
  return isNumberExit;
};

export default CheckContactNumber;
