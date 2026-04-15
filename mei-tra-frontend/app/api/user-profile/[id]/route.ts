import { NextRequest, NextResponse } from 'next/server';
import type {
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@contracts/profile';
import { getBackendApiUrl } from '@/lib/backend-api';

async function proxyResponse<T>(response: Response): Promise<NextResponse<T>> {
  const contentType =
    response.headers.get('content-type') ?? 'application/json; charset=utf-8';
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'content-type': contentType,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await fetch(getBackendApiUrl(`/user-profile/${id}`), {
    method: 'GET',
    cache: 'no-store',
  });

  return proxyResponse<UserProfileDto>(response);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json(
      { error: 'Authorization header is required' },
      { status: 401 },
    );
  }

  const body = (await request.json()) as UpdateUserProfileRequestDto;
  const response = await fetch(getBackendApiUrl(`/user-profile/${id}`), {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return proxyResponse<UserProfileDto>(response);
}
