import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import revenuecatConfig from '../config/revenuecat.config';
import { EntitlementsService } from './entitlements.service';
import { parseRevenueCatWebhook } from './revenuecat-webhook.validation';

@Controller('monetization')
export class RevenueCatWebhookController {
  private readonly logger = new Logger(RevenueCatWebhookController.name);

  constructor(
    @Inject(revenuecatConfig.KEY)
    private readonly config: ConfigType<typeof revenuecatConfig>,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  // Publicly reachable; the shared secret RevenueCat sends in Authorization is
  // the only gate, so it is checked before anything else and failures carry no
  // detail.
  @Post('revenuecat')
  @HttpCode(200)
  async handle(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: boolean }> {
    const secret = this.config.webhookSecret;
    if (!secret) {
      throw new ServiceUnavailableException();
    }

    if (!this.matchesSecret(authorization, secret)) {
      throw new UnauthorizedException();
    }

    const event = parseRevenueCatWebhook(body);
    await this.entitlementsService.applyEvent(event);

    return { received: true };
  }

  private matchesSecret(
    authorization: string | undefined,
    secret: string,
  ): boolean {
    if (typeof authorization !== 'string') {
      return false;
    }

    const provided = Buffer.from(authorization);
    const expected = Buffer.from(secret);
    if (provided.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(provided, expected);
  }
}
