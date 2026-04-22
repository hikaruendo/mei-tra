import { NextRequest, NextResponse } from 'next/server';
import type { AvatarUploadResponseDto } from '@contracts/profile';
import { getBackendApiUrl } from '@/lib/backend-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const formData = await request.formData();
    const { id } = await params;
    const backendUrl = getBackendApiUrl(`/user-profile/${id}/avatar`);

    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': authorization,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to upload avatar' },
        { status: response.status }
      );
    }

    const result = (await response.json()) as AvatarUploadResponseDto;
    return NextResponse.json(result);
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
