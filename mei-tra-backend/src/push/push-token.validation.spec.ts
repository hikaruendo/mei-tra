import { BadRequestException } from '@nestjs/common';
import {
  parseDeletePushTokenInput,
  parseRegisterPushTokenInput,
} from './push-token.validation';

describe('push token validation', () => {
  it('normalizes a valid registration', () => {
    expect(
      parseRegisterPushTokenInput({
        deviceId: ' device-1 ',
        platform: 'ios',
        expoPushToken: 'ExpoPushToken[abc123]',
        appVersion: ' 1.2.3 ',
      }),
    ).toEqual({
      deviceId: 'device-1',
      platform: 'ios',
      expoPushToken: 'ExpoPushToken[abc123]',
      appVersion: '1.2.3',
    });
  });

  it('rejects malformed token and platform values', () => {
    expect(() =>
      parseRegisterPushTokenInput({
        deviceId: 'device-1',
        platform: 'web',
        expoPushToken: 'not-a-token',
      }),
    ).toThrow(BadRequestException);
  });

  it('parses delete query values', () => {
    expect(parseDeletePushTokenInput('device-1', 'android')).toEqual({
      deviceId: 'device-1',
      platform: 'android',
    });
  });
});
