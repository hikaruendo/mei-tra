import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { UserProfileController } from '../src/controllers/user-profile.controller';
import { AuthGuard } from '../src/auth/auth.guard';
import { AuthService } from '../src/auth/auth.service';
import { SupabaseService } from '../src/database/supabase.service';

describe('UserProfileController (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;

  const validateToken = jest.fn();
  const findById = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const upload = jest.fn();
  const getPublicUrl = jest.fn();
  const from = jest.fn();

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2l8AAAAASUVORK5CYII=',
    'base64',
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    validateToken.mockImplementation(async (token: string) => {
      if (token === 'self-token') {
        return {
          id: 'user-1',
          email: 'user-1@example.com',
          profile: {
            id: 'user-1',
            username: 'user1',
            displayName: 'User 1',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeenAt: new Date(),
            gamesPlayed: 0,
            gamesWon: 0,
            totalScore: 0,
            preferences: {
              notifications: true,
              sound: true,
              theme: 'light',
              fontSize: 'standard',
            },
          },
        };
      }

      if (token === 'other-token') {
        return {
          id: 'user-2',
          email: 'user-2@example.com',
          profile: {
            id: 'user-2',
            username: 'user2',
            displayName: 'User 2',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeenAt: new Date(),
            gamesPlayed: 0,
            gamesWon: 0,
            totalScore: 0,
            preferences: {
              notifications: true,
              sound: true,
              theme: 'light',
              fontSize: 'standard',
            },
          },
        };
      }

      return null;
    });

    findById.mockResolvedValue({
      id: 'user-1',
      username: 'user1',
      displayName: 'User 1',
      avatarUrl:
        'https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar-old.webp',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      preferences: {
        notifications: true,
        sound: true,
        theme: 'light',
        fontSize: 'standard',
      },
    });
    update.mockImplementation(
      async (id: string, payload: Record<string, unknown>) => ({
        id,
        username: (payload.username as string) ?? 'user1',
        displayName: (payload.displayName as string) ?? 'User 1',
        avatarUrl:
          (payload.avatarUrl as string) ??
          'https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar-next.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        preferences: {
          notifications: true,
          sound: true,
          theme: 'light',
          fontSize: 'standard',
        },
      }),
    );

    remove.mockResolvedValue({ error: null });
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockImplementation((path: string) => ({
      data: {
        publicUrl: `https://example.supabase.co/storage/v1/object/public/avatars/${path}`,
      },
    }));
    from.mockReturnValue({
      remove,
      upload,
      getPublicUrl,
    });

    moduleFixture = await Test.createTestingModule({
      controllers: [UserProfileController],
      providers: [
        AuthGuard,
        {
          provide: 'IUserProfileRepository',
          useValue: {
            findById,
            update,
          },
        },
        {
          provide: AuthService,
          useValue: {
            validateToken,
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              storage: {
                from,
              },
            },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  describe('PUT /api/user-profile/:id', () => {
    it('returns 401 without a bearer token', async () => {
      await request(app.getHttpServer())
        .put('/api/user-profile/user-1')
        .send({ displayName: 'Updated' })
        .expect(401);
    });

    it('returns 403 when the token targets another user', async () => {
      await request(app.getHttpServer())
        .put('/api/user-profile/user-1')
        .set('Authorization', 'Bearer other-token')
        .send({ displayName: 'Updated' })
        .expect(403);
    });

    it('returns 200 for self updates', async () => {
      await request(app.getHttpServer())
        .put('/api/user-profile/user-1')
        .set('Authorization', 'Bearer self-token')
        .send({ displayName: 'Updated Name' })
        .expect(200);

      expect(update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ displayName: 'Updated Name' }),
      );
    });
  });

  describe('POST /api/user-profile/:id/avatar', () => {
    it('returns 401 without a bearer token', async () => {
      await request(app.getHttpServer())
        .post('/api/user-profile/user-1/avatar')
        .attach('avatar', tinyPng, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(401);
    });

    it('returns 403 when the token targets another user', async () => {
      await request(app.getHttpServer())
        .post('/api/user-profile/user-1/avatar')
        .set('Authorization', 'Bearer other-token')
        .attach('avatar', tinyPng, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(403);
    });

    it('returns 200 for self avatar uploads and stores objects under the user folder', async () => {
      await request(app.getHttpServer())
        .post('/api/user-profile/user-1/avatar')
        .set('Authorization', 'Bearer self-token')
        .attach('avatar', tinyPng, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(remove).toHaveBeenCalledWith(['user-1/avatar-old.webp']);
      expect(upload).toHaveBeenCalledWith(
        expect.stringMatching(/^user-1\/avatar-\d+\.webp$/),
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'image/webp',
          upsert: false,
        }),
      );

      const uploadedPath = upload.mock.calls[0][0] as string;
      expect(getPublicUrl).toHaveBeenCalledWith(uploadedPath);
      expect(update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          avatarUrl: `https://example.supabase.co/storage/v1/object/public/avatars/${uploadedPath}`,
        }),
      );
    });
  });
});
