import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const redirectUri = searchParams.get('redirect_uri') || `${env.NEXT_PUBLIC_SITE_URL}/api/auth/github/callback`;
    
    if (!env.GITHUB_CLIENT_ID) {
        return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
    }

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', env.NEXT_PUBLIC_GITHUB_SCOPES);
    githubAuthUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection

    return NextResponse.redirect(githubAuthUrl.toString());
}
