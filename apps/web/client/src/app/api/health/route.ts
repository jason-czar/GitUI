import { NextResponse } from 'next/server';
import { env } from '@/env';

export async function GET() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        environment: env.NODE_ENV,
        services: {
            supabase: !!env.NEXT_PUBLIC_SUPABASE_URL,
            github_oauth: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
            codesandbox: !!env.CSB_API_KEY,
            ai: !!(env.OPENAI_API_KEY || env.OPENROUTER_API_KEY),
            stripe: !!env.STRIPE_SECRET_KEY,
        }
    };

    return NextResponse.json(health);
}
