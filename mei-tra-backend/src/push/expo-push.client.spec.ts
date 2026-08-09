import { ExpoPushClient, type ExpoPushMessage } from './expo-push.client';

const message = (index: number): ExpoPushMessage => ({
  to: `ExpoPushToken[token-${index}]`,
  title: 'Test',
  body: 'Test body',
  data: { type: 'turn', roomId: 'room-1', roundNumber: 1 },
  sound: 'default',
});

describe('ExpoPushClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends batches of at most 100 messages and preserves token mapping', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init) => {
        const batch = JSON.parse(init?.body as string) as ExpoPushMessage[];
        return new Response(
          JSON.stringify({
            data: batch.map((_, index) => ({
              status: 'ok',
              id: `receipt-${index}`,
            })),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });
    const client = new ExpoPushClient();

    const results = await client.send(
      Array.from({ length: 101 }, (_, index) => message(index)),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toHaveLength(
      100,
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toHaveLength(
      1,
    );
    expect(results).toHaveLength(101);
    expect(results[0]).toEqual({
      token: 'ExpoPushToken[token-0]',
      status: 'ok',
      ticketId: 'receipt-0',
    });
    expect(results[100]).toEqual({
      token: 'ExpoPushToken[token-100]',
      status: 'ok',
      ticketId: 'receipt-0',
    });
  });

  it('fails when Expo returns a non-success response', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('upstream failure', { status: 503 }));

    await expect(new ExpoPushClient().send([message(1)])).rejects.toThrow(
      'Expo push API returned HTTP 503',
    );
  });

  it('maps Expo ticket errors back to the original token', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { status: 'ok', id: 'receipt-1' },
            {
              status: 'error',
              message: 'The device cannot receive notifications',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      new ExpoPushClient().send([message(1), message(2)]),
    ).resolves.toEqual([
      {
        token: 'ExpoPushToken[token-1]',
        status: 'ok',
        ticketId: 'receipt-1',
      },
      {
        token: 'ExpoPushToken[token-2]',
        status: 'error',
        error: 'DeviceNotRegistered',
        message: 'The device cannot receive notifications',
      },
    ]);
  });

  it('fetches delayed receipts and keeps receipt ids aligned', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            'receipt-1': { status: 'ok' },
            'receipt-2': {
              status: 'error',
              message: 'Device is no longer registered',
              details: { error: 'DeviceNotRegistered' },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      new ExpoPushClient().getReceipts(['receipt-1', 'receipt-2', 'receipt-3']),
    ).resolves.toEqual([
      { receiptId: 'receipt-1', status: 'ok' },
      {
        receiptId: 'receipt-2',
        status: 'error',
        error: 'DeviceNotRegistered',
        message: 'Device is no longer registered',
      },
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      ids: ['receipt-1', 'receipt-2', 'receipt-3'],
    });
  });

  it('marks transient receipt API responses as retryable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('temporary failure', { status: 503 }));

    await expect(
      new ExpoPushClient().getReceipts(['receipt-1']),
    ).rejects.toMatchObject({
      message: 'Expo receipt API returned HTTP 503',
      retryable: true,
    });
  });
});
