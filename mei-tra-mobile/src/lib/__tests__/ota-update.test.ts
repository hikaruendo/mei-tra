import { getLaunchBundleStatus } from '../ota-update';

const idle = {
  isStartupProcedureRunning: false,
  isDownloading: false,
  isUpdatePending: false,
  restartCount: 0,
};

describe('getLaunchBundleStatus', () => {
  it('waits while the launch check runs, then shows the download', () => {
    expect(getLaunchBundleStatus({ ...idle, isStartupProcedureRunning: true }, true)).toBe(
      'checking',
    );
    expect(
      getLaunchBundleStatus(
        { ...idle, isStartupProcedureRunning: true, isDownloading: true },
        true,
      ),
    ).toBe('downloading');
  });

  it('restarts into a downloaded update once per cold start', () => {
    expect(getLaunchBundleStatus({ ...idle, isUpdatePending: true }, true)).toBe('restart');
    expect(
      getLaunchBundleStatus({ ...idle, isUpdatePending: true, restartCount: 1 }, true),
    ).toBe('continue');
  });

  it('continues when nothing newer was found', () => {
    expect(getLaunchBundleStatus(idle, true)).toBe('continue');
  });

  it('continues in builds without OTA updates', () => {
    expect(
      getLaunchBundleStatus({ ...idle, isStartupProcedureRunning: true }, false),
    ).toBe('continue');
  });
});
