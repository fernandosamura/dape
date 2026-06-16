import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (email === 'admin@admin.com' && password === 'admin123') {
    const token = jwt.sign({ id: 1, role: 'adminMaster' }, process.env.JWT_SECRET!, {
      expiresIn: '1d',
    });

    return res.json({
      token,
      user: {
        id: 1,
        name: 'Admin Master',
        email,
        role: 'adminMaster',
      },
    });
  }

  return res.status(401).json({ message: 'Credenciais inválidas' });
};
