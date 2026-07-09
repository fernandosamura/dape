import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  HasMany,
  Unique,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Queue from "./Queue";
import Ticket from "./Ticket";
import WhatsappQueue from "./WhatsappQueue";
import Company from "./Company";
import Prompt from "./Prompt";
import QueueIntegrations from "./QueueIntegrations";
import {FlowBuilderModel} from "./FlowBuilder";
import { encryptSession, decryptSession } from "../utils/sessionCrypto";

@Table
class Whatsapp extends Model<Whatsapp> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Unique
  @Column(DataType.TEXT)
  name: string;

  @Column(DataType.TEXT)
  get session(): string {
    return decryptSession(this.getDataValue("session")) as string;
  }
  set session(value: string) {
    this.setDataValue("session", encryptSession(value) as string);
  }

  @Column(DataType.TEXT)
  qrcode: string;

  @Column
  status: string;

  @Column
  battery: string;

  @Column
  plugged: boolean;

  @Column
  retries: number;

  @Default("")
  @Column(DataType.TEXT)
  greetingMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  farewellMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  complationMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  outOfHoursMessage: string;

  @Default("")
  @Column(DataType.TEXT)
  ratingMessage: string;

  @Column({ defaultValue: "stable" })
  provider: string;

  @Default(false)
  @AllowNull
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => WhatsappQueue)
  queues: Array<Queue & { WhatsappQueue: WhatsappQueue }>;

  @HasMany(() => WhatsappQueue)
  whatsappQueues: WhatsappQueue[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Column
  token: string;

  //@Default(0)
  //@Column
  //timeSendQueue: number;

  //@Column
  //sendIdQueue: number;

  @Column
  transferQueueId: number;

  @Column
  timeToTransfer: number;

  @ForeignKey(() => Prompt)
  @Column
  promptId: number;

  @BelongsTo(() => Prompt)
  prompt: Prompt;

  @ForeignKey(() => QueueIntegrations)
  @Column
  integrationId: number;

  @BelongsTo(() => QueueIntegrations)
  queueIntegrations: QueueIntegrations;

  @Column
  maxUseBotQueues: number;

  @Column
  timeUseBotQueues: string;

  @Column
  expiresTicket: number;

  @Column
  expiresInactiveMessage: string;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdNotPhrase: number;

  @ForeignKey(() => FlowBuilderModel)
  @Column
  flowIdWelcome: number;

  @BelongsTo(() => FlowBuilderModel)
  flowBuilder: FlowBuilderModel

  @Default("whatsapp")
  @AllowNull
  @Column
  channel: string;

  @AllowNull
  @Column
  facebookPageUserId: string;

  @AllowNull
  @Column(DataType.TEXT)
  facebookToken: string;

  @AllowNull
  @Column(DataType.TEXT)
  facebookUserToken: string;

  @AllowNull(true)
  @Default("session")
  @Column
  providerType: string;

  @AllowNull(true)
  @Column
  wabaId: string;

  @AllowNull(true)
  @Column
  phoneNumberId: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  metaAccessToken: string;

  @AllowNull(true)
  @Column
  tokenExpiresAt: Date;

  @AllowNull(true)
  @Column
  embeddedSignupSessionId: string;

  @AllowNull(true)
  @Default("none")
  @Column
  migrationStatus: string;

  @AllowNull(true)
  @Column
  previousProviderType: string;

  // Saude real do numero, sincronizada da Meta - #031 Fase F. GREEN | YELLOW
  // | RED | UNKNOWN.
  @AllowNull(true)
  @Column
  metaQualityRating: string;

  // Nivel de limite de mensagens (ex: TIER_250, TIER_1K, TIER_10K,
  // TIER_100K, TIER_UNLIMITED) - compartilhado entre os numeros do mesmo
  // portfolio/WABA desde out/2025.
  @AllowNull(true)
  @Column
  metaMessagingLimit: string;

  // Status de aprovacao do nome de exibicao (ex: APPROVED, PENDING,
  // REJECTED).
  @AllowNull(true)
  @Column
  metaNameStatus: string;

  @AllowNull(true)
  @Column
  metaHealthSyncedAt: Date;
}

export default Whatsapp;
