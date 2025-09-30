#!/usr/bin/env bun
/**
 * GitUI Post-Deploy Script
 * 
 * This script runs after deployment to:
 * 1. Run database migrations
 * 2. Verify required environment variables
 * 3. Print setup instructions
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Required environment variables
const REQUIRED_ENV_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'CSB_API_KEY',
] as const;

// Optional environment variables
const OPTIONAL_ENV_VARS = [
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'OPENROUTER_API_KEY',
] as const;

async function main() {
    console.log('🚀 GitUI Post-Deploy Script Starting...\n');

    // 1. Check environment variables
    console.log('📋 Checking environment variables...');
    
    const missing: string[] = [];
    const optional: string[] = [];

    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        } else {
            console.log(`✅ ${envVar}`);
        }
    }

    for (const envVar of OPTIONAL_ENV_VARS) {
        if (!process.env[envVar]) {
            optional.push(envVar);
        } else {
            console.log(`✅ ${envVar} (optional)`);
        }
    }

    if (missing.length > 0) {
        console.error('\n❌ Missing required environment variables:');
        missing.forEach(envVar => console.error(`   - ${envVar}`));
        console.error('\nPlease set these variables in your deployment environment.');
        process.exit(1);
    }

    if (optional.length > 0) {
        console.log('\n⚠️  Optional environment variables not set:');
        optional.forEach(envVar => console.log(`   - ${envVar}`));
        console.log('These features will be disabled until configured.');
    }

    // 2. Run database migrations
    console.log('\n🗄️  Running database migrations...');
    
    const databaseUrl = process.env.SUPABASE_DATABASE_URL;
    if (!databaseUrl) {
        console.error('❌ SUPABASE_DATABASE_URL not found');
        process.exit(1);
    }

    try {
        const sql = postgres(databaseUrl, { max: 1 });
        const db = drizzle(sql);
        
        await migrate(db, { migrationsFolder: './packages/db/migrations' });
        console.log('✅ Database migrations completed');
        
        await sql.end();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }

    // 3. Print setup instructions
    console.log('\n🎉 GitUI deployment completed successfully!\n');
    
    console.log('📝 Next steps:');
    console.log('1. Set up GitHub OAuth App:');
    console.log(`   - Go to: https://github.com/settings/applications/new`);
    console.log(`   - Authorization callback URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com'}/api/auth/github/callback`);
    console.log(`   - Copy Client ID and Secret to your environment variables`);
    
    console.log('\n2. Configure Supabase:');
    console.log('   - Enable Row Level Security (RLS) on all tables');
    console.log('   - Set up authentication providers as needed');
    
    if (optional.includes('STRIPE_SECRET_KEY')) {
        console.log('\n3. Optional - Set up Stripe (for billing):');
        console.log('   - Add STRIPE_SECRET_KEY to environment');
        console.log(`   - Set webhook endpoint: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com'}/api/webhooks/stripe`);
    }
    
    if (optional.includes('OPENAI_API_KEY')) {
        console.log('\n4. Optional - Set up AI features:');
        console.log('   - Add OPENAI_API_KEY or OPENROUTER_API_KEY to environment');
    }
    
    console.log(`\n🌐 Your GitUI instance is ready at: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com'}`);
    console.log('\n✨ Happy coding!');
}

main().catch((error) => {
    console.error('❌ Post-deploy script failed:', error);
    process.exit(1);
});
