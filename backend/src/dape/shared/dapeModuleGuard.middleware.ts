import { Request, Response, NextFunction } from 'express';
import { moduleAccessService } from './moduleAccess.service';

export function moduleGuard(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = (req as any).user?.companyId;
      const userId = (req as any).user?.id;

      if (!companyId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const hasAccess = await moduleAccessService.checkAccess(companyId, moduleKey);

      await moduleAccessService.logAccess({
        companyId,
        userId,
        moduleKey,
        endpoint: req.path,
        accessGranted: hasAccess,
        reasonDenied: hasAccess ? undefined : 'Módulo não incluído no plano',
      });

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Módulo não disponível',
          code: 'MODULE_NOT_ENABLED',
          module: moduleKey,
          message: 'Este módulo não está incluído no seu plano atual. Entre em contato para upgrade.',
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
