import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?error=github_auth_failed`);
    }

    if (!code) {
        return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?error=missing_code`);
    }

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?error=oauth_not_configured`);
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: env.GITHUB_CLIENT_ID,
                client_secret: env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('GitHub OAuth error:', tokenData);
            return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?error=token_exchange_failed`);
        }

        const accessToken = tokenData.access_token;

        // Get user info from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        const githubUser = await userResponse.json();

        // Get current user from Supabase
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/login?error=not_authenticated`);
        }

        // Store the GitHub token securely (encrypted)
        // TODO: Implement token encryption and storage in database
        // For now, we'll store it in the user metadata (not recommended for production)
        const { error: updateError } = await supabase.auth.updateUser({
            data: {
                github_access_token: accessToken,
                github_username: githubUser.login,
                github_user_id: githubUser.id,
            }
        });

        if (updateError) {
            console.error('Error storing GitHub token:', updateError);
            return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?error=token_storage_failed`);
        }

        return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?success=github_connected`);
    } catch (error) {
        console.error('GitHub OAuth callback error:', error);
        return NextResponse.redirect(`${env.NEXT_PUBLIC_SITE_URL}/projects?error=callback_failed`);
    }
}
