import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user-profile/${params.id}/avatar`
      : `http://localhost:3333/api/user-profile/${params.id}/avatar`;

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

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}