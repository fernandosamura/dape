import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";

@Table({ tableName: "dape_lead_sources" })
class DapeLeadSource extends Model<DapeLeadSource> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @Column(DataType.STRING(50))
  sourceType: string;

  @Column(DataType.STRING(255))
  campaignName: string;

  @Column(DataType.STRING(255))
  utmSource: string;

  @Column(DataType.STRING(255))
  utmMedium: string;

  @Column(DataType.STRING(255))
  utmCampaign: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;
}

export default DapeLeadSource;
