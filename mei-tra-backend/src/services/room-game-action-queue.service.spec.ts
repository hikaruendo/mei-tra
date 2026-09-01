import { RoomGameActionQueueService } from './room-game-action-queue.service';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('RoomGameActionQueueService', () => {
  it('serializes mutations in the same room', async () => {
    const service = new RoomGameActionQueueService();
    const firstGate = deferred();
    const calls: string[] = [];

    const first = service.run('room-1', async () => {
      calls.push('first-start');
      await firstGate.promise;
      calls.push('first-end');
    });
    const second = service.run('room-1', async () => {
      calls.push('second');
    });

    await Promise.resolve();
    expect(calls).toEqual(['first-start']);

    firstGate.resolve();
    await Promise.all([first, second]);
    expect(calls).toEqual(['first-start', 'first-end', 'second']);
  });

  it('allows independent rooms to progress in parallel', async () => {
    const service = new RoomGameActionQueueService();
    const firstGate = deferred();
    const calls: string[] = [];

    const first = service.run('room-1', async () => {
      calls.push('room-1-start');
      await firstGate.promise;
    });
    const second = service.run('room-2', async () => {
      calls.push('room-2');
    });

    await second;
    expect(calls).toEqual(['room-1-start', 'room-2']);
    firstGate.resolve();
    await first;
  });

  it('continues the queue after a failed mutation', async () => {
    const service = new RoomGameActionQueueService();
    const secondAction = jest.fn().mockResolvedValue('ok');

    const first = service.run('room-1', async () => {
      throw new Error('failed');
    });
    const second = service.run('room-1', secondAction);

    await expect(first).rejects.toThrow('failed');
    await expect(second).resolves.toBe('ok');
    expect(secondAction).toHaveBeenCalledTimes(1);
  });
});
