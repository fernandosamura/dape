import { Request, Response } from 'express';

export const getCompanies = async (req: Request, res: Response) => {
  return res.json([
    { id: 1, name: 'Empresa Padrão', planId: 1, status: true }
  ]);
};
