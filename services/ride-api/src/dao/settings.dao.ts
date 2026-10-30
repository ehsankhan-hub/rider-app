import { PlatformSetting } from '../models/platform-setting.model';

export class SettingsDao {
  async read(): Promise<Record<string, string>> {
    const rows = await PlatformSetting.findAll();
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.settingKey] = row.settingValue;
    return settings;
  }

  async write(values: Record<string, string>): Promise<void> {
    for (const [settingKey, settingValue] of Object.entries(values)) {
      await PlatformSetting.upsert({ settingKey, settingValue });
    }
  }
}
