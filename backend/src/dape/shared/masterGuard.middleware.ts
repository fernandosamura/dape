import { Request, Response, NextFunction } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../../database';

export function masterGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req as any).user?.companyId;
      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }
      const rows = await sequelize.query<{ is_master: boolean }>(
        `SELECT is_master FROM dape_tenant_plans WHERE company_id = :companyId AND is_active = TRUE`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );
      if (!rows[0]?.is_master) {
        return res.status(403).json({ error: 'Acesso restrito à conta master' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
