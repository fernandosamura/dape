import { Request, Response } from 'express';

export const getPlans = async (req: Request, res: Response) => {
  return res.json([
    {
      id: 1,
      name: 'Plano Master',
      users: 9999,
      connections: 9999,
      queues: 9999,
      value: 0,
      useCampaigns: true,
      useExternalApi: true,
      useInternalChat: true,
      useSchedules: true,
      useKanban: true,
      useOpenAi: true,
      useIntegrations: true
    }
  ]);
};
