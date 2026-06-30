import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

const isSuper = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  if (!req.user?.super) {
    throw new AppError("Acesso não permitido", 401);
  }
  return next();
}

export default isSuper;
