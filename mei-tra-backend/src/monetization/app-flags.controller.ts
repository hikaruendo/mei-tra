import { Controller, Get } from '@nestjs/common';
import type { AppFlagsResponse } from '@contracts/monetization';
import { AppFlagsService } from './app-flags.service';

@Controller('app-flags')
export class AppFlagsController {
  constructor(private readonly appFlagsService: AppFlagsService) {}

  // Unauthenticated by design, like /api/health: the flags gate UI, not data.
  @Get()
  getFlags(): Promise<AppFlagsResponse> {
    return this.appFlagsService.getFlags();
  }
}
