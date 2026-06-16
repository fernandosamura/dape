import { Request, Response } from 'express';

export const getUsers = async (req: Request, res: Response) => {
  // Aqui poderá integrar com DB futuramente
  return res.json([
    { id: 1, name: 'Admin Master', email: 'admin@admin.com', role: 'adminMaster' },
  ]);
};
