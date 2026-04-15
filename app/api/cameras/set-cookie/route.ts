// app/api/cameras/set-cookie/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: "No token provided" }, { status: 400 });

    // 🚨 THE FIX: Next.js 15+ requires awaiting cookies()
    const cookieStore = await cookies();
    
    // Lock the EEN token securely into the browser
    cookieStore.set('een_stream_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2, // Expires in 2 hours
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
