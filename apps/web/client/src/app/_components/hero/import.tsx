'use client';

import { api } from '@/trpc/react';
import { LocalForageKeys } from '@/utils/constants';
import { Button } from '@onlook/ui/button';
import { Icons } from '@onlook/ui/icons/index';
import localforage from 'localforage';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../../auth/auth-context';

export function Import() {
    const router = useRouter();
    const { data: user } = api.user.get.useQuery();
    const { setIsAuthModalOpen } = useAuthContext();

    const handleImportFromGitHub = () => {
        if (!user?.id) {
            // Store the return URL and open auth modal
            void localforage.setItem(LocalForageKeys.RETURN_URL, '/projects/import/github');
            setIsAuthModalOpen(true);
            return;
        }

        // Navigate directly to GitHub import flow
        router.push('/projects/import/github');
    };

    return (
        <Button
            onClick={handleImportFromGitHub}
            variant="outline"
            size="lg"
            className="bg-background/80 backdrop-blur-sm border-foreground-tertiary/50 hover:bg-background/90 hover:border-foreground-secondary/50 transition-all duration-200 flex items-center gap-2 px-6 py-3"
        >
            <Icons.GitHubLogo className="w-5 h-5" />
            Import from GitHub
        </Button>
    );
}
