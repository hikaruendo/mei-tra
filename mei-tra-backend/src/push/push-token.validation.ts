import { BadRequestException } from '@nestjs/common';
import {
  type DeletePushTokenInput,
  type PushPlatform,
  type RegisterPushTokenInput,
} from '@contracts/push';

const PUSH_PLATFORMS = ['ios', 'android'] as const;

const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[^\]]+\]$/;

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }

  return value as Record<string, unknown>;
};

const requiredText = (
  value: unknown,
  field: string,
  maxLength: number,
): string => {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }

  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    hasControlCharacter
  ) {
    throw new BadRequestException(`${field} is invalid`);
  }

  return normalized;
};

const platform = (value: unknown): PushPlatform => {
  if (
    typeof value !== 'string' ||
    !PUSH_PLATFORMS.includes(value as PushPlatform)
  ) {
    throw new BadRequestException('platform must be ios or android');
  }

  return value as PushPlatform;
};

export const parseRegisterPushTokenInput = (
  value: unknown,
): RegisterPushTokenInput => {
  const body = asObject(value);
  const expoPushToken = requiredText(body.expoPushToken, 'expoPushToken', 255);

  if (!EXPO_PUSH_TOKEN_PATTERN.test(expoPushToken)) {
    throw new BadRequestException('expoPushToken is invalid');
  }

  const appVersion =
    body.appVersion === undefined
      ? undefined
      : requiredText(body.appVersion, 'appVersion', 100);

  return {
    deviceId: requiredText(body.deviceId, 'deviceId', 255),
    platform: platform(body.platform),
    expoPushToken,
    appVersion,
  };
};

export const parseDeletePushTokenInput = (
  deviceId: unknown,
  platformValue: unknown,
): DeletePushTokenInput => ({
  deviceId: requiredText(deviceId, 'deviceId', 255),
  platform: platform(platformValue),
});
