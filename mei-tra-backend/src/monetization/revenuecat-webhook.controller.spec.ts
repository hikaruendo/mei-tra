import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

const USER_ID = '11111111-2222-3333-4444-555555555555';

const payload = {
  event: {
    type: 'INITIAL_PURCHASE',
    app_user_id: USER_ID,
    entitlement_ids: ['membership'],
    store: 'APP_STORE',
  },
};

describe('RevenueCatWebhookController', () => {
  let applyEvent: jest.Mock;
  let controller: RevenueCatWebhookController;

  const build = (webhookSecret: string | null) => {
    applyEvent = jest.fn().mockResolvedValue(undefined);
    controller = new RevenueCatWebhookController({ webhookSecret }, {
      applyEvent,
    } as unknown as EntitlementsService);
  };

  it('answers 503 until the secret is configured', async () => {
    build(null);

    await expect(controller.handle('Bearer x', payload)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(applyEvent).not.toHaveBeenCalled();
  });

  it('rejects a wrong or missing Authorization header', async () => {
    build('Bearer correct-secret');

    await expect(
      controller.handle('Bearer wrong-secret!', payload),
    ).rejects.toThrow(UnauthorizedException);
    await expect(controller.handle(undefined, payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(applyEvent).not.toHaveBeenCalled();
  });

  it('applies the parsed event when the header matches', async () => {
    build('Bearer correct-secret');

    await expect(
      controller.handle('Bearer correct-secret', payload),
    ).resolves.toEqual({ received: true });
    expect(applyEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'INITIAL_PURCHASE', userId: USER_ID }),
    );
  });
});
