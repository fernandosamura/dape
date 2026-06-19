import { moduleAccessService } from "../shared/moduleAccess.service";

export type OperationMode = "disabled" | "assisted" | "automatic";

export abstract class BaseAgent {
  protected companyId: number;
  protected moduleName: string;
  protected operationMode: OperationMode = "disabled";

  constructor(companyId: number, moduleName: string) {
    this.companyId = companyId;
    this.moduleName = moduleName;
  }

  async initialize(): Promise<boolean> {
    try {
      const modules = await moduleAccessService.getAllModulesStatus(this.companyId);
      const module = modules.find((m) => m.module_key === this.moduleName);
      if (!module) {
        console.log(`[BaseAgent] Module ${this.moduleName} not found for company ${this.companyId}`);
        return false;
      }
      if (!module.is_enabled) {
        console.log(`[BaseAgent] Module ${this.moduleName} is disabled for company ${this.companyId}`);
        this.operationMode = "disabled";
        return false;
      }
      this.operationMode = module.operation_mode as OperationMode;
      return true;
    } catch (err) {
      console.error(`[BaseAgent] Error initializing agent for module ${this.moduleName}:`, err);
      return false;
    }
  }

  protected canExecute(): boolean {
    return this.operationMode === "automatic" || this.operationMode === "assisted";
  }

  abstract execute(...args: any[]): Promise<any>;
}
