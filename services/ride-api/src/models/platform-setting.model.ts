import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';

@Table({ tableName: 'platform_settings', timestamps: false, underscored: true })
export class PlatformSetting extends Model {
  @PrimaryKey
  @Column({ type: DataType.STRING(64), field: 'setting_key' })
  declare settingKey: string;

  @Column({ type: DataType.STRING(255), field: 'setting_value' })
  declare settingValue: string;
}
