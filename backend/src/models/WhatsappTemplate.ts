import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  DataType,
  Default
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

// Template de mensagem aprovado pela Meta - #031 Fase E. Sincronizado a
// partir da Graph API (GET /{waba-id}/message_templates) e mantido
// atualizado via webhook (message_template_status_update).
@Table({ tableName: "WhatsappTemplates" })
class WhatsappTemplate extends Model<WhatsappTemplate> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  // ID do template no lado da Meta - necessario pra cruzar com o webhook
  // de status e evitar duplicar na sincronizacao.
  @Column
  metaTemplateId: string;

  @Column
  name: string;

  @Default("pt_BR")
  @Column
  language: string;

  // MARKETING | UTILITY | AUTHENTICATION
  @Column
  category: string;

  // PENDING | APPROVED | REJECTED | PAUSED | DISABLED
  @Default("PENDING")
  @Column
  status: string;

  // Texto do corpo (componente BODY), so pra exibicao amigavel na tela -
  // a fonte da verdade pro envio real e o campo components.
  @Column(DataType.TEXT)
  bodyText: string;

  // Estrutura completa de componentes (header/body/footer/buttons) no
  // formato que a Graph API espera/retorna.
  @Column(DataType.JSONB)
  components: object;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default WhatsappTemplate;
