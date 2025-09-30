'use client';

import { api } from '@/trpc/react';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

export interface GitHubAppInstallation {
    hasInstallation: boolean;
    installationId: string | null;
    isChecking: boolean;
    error: string | null;
    redirectToInstallation: (redirectUrl?: string) => Promise<void>;
    refetch: () => void;
    clearError: () => void;
}

export const useGitHubAppInstallation: () => GitHubAppInstallation = () => {
    // GitUI: Use OAuth connection check instead of GitHub App installation
    const { data: oauthConnection, refetch: checkConnection, isFetching: isChecking, error: checkConnectionError } = api.github.checkOAuthConnection.useQuery(undefined, {
        refetchOnWindowFocus: true,
    });
    const [error, setError] = useState<string | null>(null);
    const hasInstallation = !!oauthConnection?.connected;

    useEffect(() => {
        setError(checkConnectionError?.message || null);
    }, [checkConnectionError]);

    const clearError = () => {
        setError(null);
    };

    const redirectToInstallation = async (_redirectUrl?: string) => {
        try {
            // GitUI: Use Supabase GitHub OAuth for consistency
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    scopes: 'repo read:user user:email',
                    redirectTo: `${window.location.origin}/projects/import/github`,
                }
            });
            
            if (error) {
                console.error('Error initiating GitHub OAuth:', error);
            }
        } catch (error) {
            console.error('Error redirecting to GitHub OAuth:', error);
        }
    };

    return {
        hasInstallation,
        installationId: oauthConnection?.username || null,
        isChecking,
        error,
        redirectToInstallation,
        refetch: checkConnection,
        clearError,
    };
};