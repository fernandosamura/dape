import { sign, SignOptions } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";

export const createAccessToken = (user: User): string => {
  const { secret, expiresIn } = authConfig;

  return sign(
    {
      username: user.name,
      profile: user.profile,
      id: user.id,
      companyId: user.companyId,
      super: user.super
    },
    secret,
    {
      expiresIn: expiresIn as SignOptions["expiresIn"],
      algorithm: "HS256",
    }
  );
};

export const createRefreshToken = (user: User): string => {
  const { refreshSecret, refreshExpiresIn } = authConfig;

  return sign(
    { id: user.id, tokenVersion: user.tokenVersion, companyId: user.companyId },
    refreshSecret,
    {
      expiresIn: refreshExpiresIn as SignOptions["expiresIn"],
      algorithm: "HS256",
    }
  );
};
