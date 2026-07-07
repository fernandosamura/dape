import { getRounds, hash } from "bcryptjs";
import User, { BCRYPT_ROUNDS } from "../../models/User";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Setting from "../../models/Setting";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  companyId: number;
}

interface Request {
  email: string;
  password: string;
}

interface Response {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}

const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {
  const user = await User.findOne({
    where: { email },
    include: ["queues", { model: Company, include: [{ model: Setting }] }]
  });

  if (!user) {
    throw new AppError("ERR_USER_DONT_EXISTS", 401);
  }

  if (!(await user.checkPassword(password))) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  try {
    if (getRounds(user.getDataValue("passwordHash")) < BCRYPT_ROUNDS) {
      const upgradedHash = await hash(password, BCRYPT_ROUNDS);
      await user.update({ passwordHash: upgradedHash });
    }
  } catch (err) {
    // rehash e apenas um hardening em segundo plano, nunca deve bloquear o login
  }

  if (user.company && user.company.approved === false) {
    throw new AppError("ERR_COMPANY_PENDING_APPROVAL", 403);
  }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = await SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
