import { Response } from "express";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const SendRefreshToken = (res: Response, token: string): void => {
  res.cookie("jrt", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEVEN_DAYS_MS
  });
};
