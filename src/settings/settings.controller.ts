import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/update-setting.dto';
import { Public } from 'src/decorator/customize';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  async getSetting() {
    return this.settingsService.getSetting();
  }

  @Patch()
  async upsertSetting(@Body() dto: UpsertSettingDto) {
    return this.settingsService.upsertSetting(dto);
  }

  @Public()
  @Post('generate')
  async generate(@Body('date') date: string) {
    return this.settingsService.generateShiftsByDate(date);
  }
}
