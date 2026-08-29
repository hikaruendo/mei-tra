/* eslint-disable @typescript-eslint/no-require-imports */
import { asSeatId } from "@meitra/contracts/ids";
import type { GameResultSnapshot } from "@meitra/game-client/game-result";
import React from "react";
import { AccessibilityInfo, ScrollView, StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { GameResultExperience } from "../GameResultExperience";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress: () => void;
    testID?: string;
  }) => {
    const ReactModule = require("react") as typeof React;
    const { Pressable: NativePressable } =
      require("react-native") as typeof import("react-native");
    return ReactModule.createElement(
      NativePressable,
      { onPress, testID },
      children,
    );
  },
}));

const result: GameResultSnapshot = {
  token: 1,
  winningTeam: 0,
  viewerRole: "winner",
  teamNames: { 0: "Sun", 1: "Moon" },
  teams: [
    {
      team: 0,
      total: 5,
      members: [
        { seatId: asSeatId("a"), name: "Alice", initial: "A", isCOM: false },
      ],
    },
    {
      team: 1,
      total: 3,
      members: [
        { seatId: asSeatId("b"), name: "Bob", initial: "B", isCOM: false },
      ],
    },
  ],
};

interface RendererHandle {
  root: {
    findByProps: (props: Record<string, unknown>) => {
      props: { onPress: () => void };
      findAllByType: (type: unknown) => {
        props: { onPress: () => void };
      }[];
    };
    findByType: (type: unknown) => {
      props: Record<string, unknown>;
    };
  };
  toJSON: () => unknown;
  unmount: () => void;
}

const renderedText = (renderer: RendererHandle) =>
  JSON.stringify(renderer.toJSON());

describe("GameResultExperience", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("skips the reveal on tap and keeps the final result open", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    let renderer!: RendererHandle;
    await act(async () => {
      renderer = TestRenderer.create(
        <GameResultExperience result={result} onClose={jest.fn()} />,
      ) as unknown as RendererHandle;
      await Promise.resolve();
    });
    const skipTarget = renderer.root.findByProps({
      accessibilityLabel: "タップでスキップ",
    });
    await act(async () => skipTarget.props.onPress());
    expect(renderedText(renderer!)).toContain("最終結果");
    expect(renderedText(renderer!)).toContain("Alice");
    await act(async () => renderer!.unmount());
  });

  it("shows the static result immediately with reduced motion", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    let renderer!: RendererHandle;
    await act(async () => {
      renderer = TestRenderer.create(
        <GameResultExperience result={result} onClose={jest.fn()} />,
      ) as unknown as RendererHandle;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderedText(renderer!)).toContain("最終結果");
    expect(renderer!.root.findByType(ScrollView).props.accessible).not.toBe(
      true,
    );
    expect(
      StyleSheet.flatten(renderer!.root.findByType(ScrollView).props.style),
    ).toMatchObject({ flexGrow: 0 });
    await act(async () => renderer!.unmount());
  });

  it("keeps result actions in the dedicated action bar", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    const onClose = jest.fn();
    const onRegister = jest.fn();
    let renderer!: RendererHandle;
    await act(async () => {
      renderer = TestRenderer.create(
        <GameResultExperience
          result={result}
          onClose={onClose}
          onRegister={onRegister}
        />,
      ) as unknown as RendererHandle;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      renderer.root.findByProps({ testID: "result-action-bar" }),
    ).toBeDefined();
    await act(async () =>
      renderer.root.findByProps({ testID: "result-register" }).props.onPress(),
    );
    await act(async () =>
      renderer.root.findByProps({ testID: "result-close" }).props.onPress(),
    );
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
  });
});
