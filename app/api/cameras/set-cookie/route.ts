// app/api/cameras/set-cookie/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) throw new Error("No token provided");

    const response = NextResponse.json({ success: true });
    
    // Lock the EEN token into a secure HTTP cookie
    response.cookies.set('een_stream_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/cameras/proxy', // ONLY send this cookie to the proxy route!
      maxAge: 60 * 60 * 2, // 2 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
