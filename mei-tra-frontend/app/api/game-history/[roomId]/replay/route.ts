import { NextRequest } from 'next/server';
import { proxyGameHistoryRequest } from '../proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  return proxyGameHistoryRequest(request, roomId, 'replay');
}
