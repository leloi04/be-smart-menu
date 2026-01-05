import { BadRequestException, Injectable } from '@nestjs/common';
import { UpsertSettingDto } from './dto/update-setting.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Setting, SettingDocument } from './schemas/setting.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import dayjs from 'dayjs';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name)
    private SettingModel: SoftDeleteModel<SettingDocument>,
  ) {}
  async getSetting() {
    return this.SettingModel.findOne().lean();
  }

  async upsertSetting(dto: UpsertSettingDto) {
    return this.SettingModel.findOneAndUpdate(
      {},
      {
        $set: {
          ...dto,
          weekday: dto.weekday,
          weekend: dto.weekend,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );
  }

  async generateShiftsByDate(dateStr: string) {
    if (!dateStr) {
      throw new BadRequestException('date is required');
    }

    const date = dayjs(dateStr, 'YYYY-MM-DD', true);
    if (!date.isValid()) {
      throw new BadRequestException('Invalid date format YYYY-MM-DD');
    }

    const setting = await this.getSetting();
    if (!setting) {
      throw new BadRequestException('Setting not configured');
    }

    /* ========= 1. CHỌN SETTING THEO THỨ ========= */
    const isWeekend = date.day() === 0 || date.day() === 6;
    const daySetting = isWeekend ? setting.weekend : setting.weekday;

    if (!daySetting?.enabled) {
      return [];
    }

    /* ========= 2. THỜI GIAN ========= */
    const openTime = dayjs(
      `${dateStr} ${daySetting.open}`,
      'YYYY-MM-DD HH:mm',
    ).add(setting.startOffsetMinutes || 0, 'minute');

    const closeTime = dayjs(
      `${dateStr} ${daySetting.close}`,
      'YYYY-MM-DD HH:mm',
    );

    const slotDuration = setting.slotDurationMinutes;

    /* ========= 3. SINH CA ========= */
    let shifts: any[] = [];
    let currentStart = openTime.clone();
    let index = 1;

    while (true) {
      const currentEnd = currentStart.add(slotDuration, 'minute');

      if (currentEnd.isAfter(closeTime)) break;

      shifts.push({
        index,
        date: dateStr,
        startTime: currentStart.format('HH:mm'),
        endTime: currentEnd.format('HH:mm'),
        startAt: currentStart.toISOString(),
        endAt: currentEnd.toISOString(),
        isWeekend,
      });

      currentStart = currentEnd;
      index++;
    }

    return shifts;
  }
}
