import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const formData = await request.formData();
    const { id } = await params;

    const normalizeBackendUrl = (url: string | undefined) => {
      if (!url) return null;
      const trimmed = url.replace(/\/+$/, '');
      return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    };

    const backendBaseUrl = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL);

    const backendUrl = backendBaseUrl
      ? `${backendBaseUrl}/api/user-profile/${id}/avatar`
      : `http://localhost:3333/api/user-profile/${id}/avatar`;

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
