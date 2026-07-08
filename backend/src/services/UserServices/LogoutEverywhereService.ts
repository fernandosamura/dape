import User from "../../models/User";
import AppError from "../../errors/AppError";

const LogoutEverywhereService = async (
  id: string | number,
  companyId: number
): Promise<User> => {
  const user = await User.findOne({ where: { id, companyId } });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  await user.increment("tokenVersion");
  await user.reload();

  return user;
};

export default LogoutEverywhereService;
