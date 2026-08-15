export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';

type TablePlayer = {
  seatId: string;
};

type TeamTablePlayer = TablePlayer & {
  team: number;
};

const SEAT_POSITIONS: SeatPosition[] = ['bottom', 'left', 'top', 'right'];

function arrangeWithSelfBottom<TPlayer extends TablePlayer>(
  players: readonly (TPlayer | undefined)[],
  selfSeatId: string | null,
): (TPlayer | undefined)[] {
  const order = [...players.slice(0, 4)];
  while (order.length < 4) {
    order.push(undefined);
  }

  const selfIndex = selfSeatId
    ? order.findIndex((player) => player?.seatId === selfSeatId)
    : -1;
  const rotated =
    selfIndex > 0
      ? [...order.slice(selfIndex), ...order.slice(0, selfIndex)]
      : order;

  return [rotated[0], rotated[3], rotated[2], rotated[1]];
}

export function getConsistentTableOrderWithSelfBottom<
  TPlayer extends TeamTablePlayer,
>(
  players: readonly TPlayer[],
  selfSeatId: string | null,
): (TPlayer | undefined)[] {
  const team0 = players.filter((player) => player.team === 0);
  const team1 = players.filter((player) => player.team === 1);
  const alternatingOrder: TPlayer[] = [];
  const maxLength = Math.max(team0.length, team1.length, 1);

  for (let index = 0; index < maxLength; index += 1) {
    if (team0[index]) alternatingOrder.push(team0[index]);
    if (team1[index]) alternatingOrder.push(team1[index]);
  }

  return arrangeWithSelfBottom(alternatingOrder, selfSeatId);
}

export function getSeatOrderWithSelfBottom<TPlayer extends TablePlayer>(
  players: readonly TPlayer[],
  selfSeatId: string | null,
): (TPlayer | undefined)[] {
  return arrangeWithSelfBottom(players, selfSeatId);
}

export function getCardSeatPosition<TPlayer extends TablePlayer>(
  playedBySeatId: string,
  orderedPlayers: readonly (TPlayer | undefined)[],
): SeatPosition {
  const index = orderedPlayers.findIndex(
    (player) => player?.seatId === playedBySeatId,
  );
  return index >= 0 ? SEAT_POSITIONS[index] : 'bottom';
}
