import { NextRequest } from 'next/server';
import type { GameHistorySummaryContract } from '@contracts/game-history';
import { proxyGameHistoryRequest } from '../proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  return proxyGameHistoryRequest<GameHistorySummaryContract>(
    request,
    roomId,
    'summary',
  );
}
