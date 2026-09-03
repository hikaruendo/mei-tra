import { Controller, Get, UseGuards } from '@nestjs/common';
import type { EntitlementsMeResponse } from '@contracts/monetization';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { AuthenticatedUser } from '../types/user.types';
import { EntitlementsService } from './entitlements.service';

@Controller('monetization')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  // Guests get an empty list rather than an error: what a client may buy is
  // decided at the purchase UI, not here.
  @Get('entitlements/me')
  @UseGuards(AuthGuard)
  async getMine(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<EntitlementsMeResponse> {
    const records = await this.entitlementsService.findActiveForUser(
      currentUser.id,
    );

    return {
      entitlements: records.map((record) => ({
        entitlement: record.entitlement,
        source: record.source,
        willRenew: record.willRenew,
        expiresAt: record.expiresAt,
      })),
    };
  }
}
