import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface Request {
  key: string;
  value: string;
  companyId: number;
}

const UpdateSettingService = async ({
  key,
  value,
  companyId
}: Request): Promise<Setting | undefined> => {
  if (key === "iaAudioReplyEnabled" && (value === "true" || value === true as any)) {
    const company = await Company.findByPk(companyId, { include: [{ model: Plan, as: "plan" }] });
    if (!company?.plan?.useIaAudioReply) {
      throw new AppError("Funcionalidade não habilitada no plano", 403);
    }
  }

  const [setting] = await Setting.findOrCreate({
    where: {
      key,
      companyId
    }, 
    defaults: {
      key,
      value,
      companyId
    }
  });

  if (setting != null && setting?.companyId !== companyId) {
    throw new AppError("Não é possível consultar registros de outra empresa");
  }

  if (!setting) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  await setting.update({ value });

  return setting;
};

export default UpdateSettingService;
