import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  Default,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";

@Table({ tableName: "dape_deals" })
class DapeDeal extends Model<DapeDeal> {
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

  @Column(DataType.STRING(255))
  title: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  value: number;

  @Default("open")
  @Column(DataType.STRING(50))
  status: string;

  @Default("prospecting")
  @Column(DataType.STRING(50))
  stage: string;

  @Column(DataType.DATEONLY)
  expectedCloseDate: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;
}

export default DapeDeal;
