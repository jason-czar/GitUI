'use client';

import { api as clientApi } from '@/trpc/client';
import { api } from '@/trpc/react';
import { Routes } from '@/utils/constants';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GitHubRepository } from '@onlook/github';

export const useRepositoryImport = () => {
    const router = useRouter();
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: user } = api.user.get.useQuery();

    const importRepository = async (selectedRepo: GitHubRepository) => {
        if (!user?.id) {
            setError('No user found');
            return;
        }

        if (!selectedRepo) {
            setError('No repository selected');
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            // GitUI: First create/store the repository in our database
            const repository = await clientApi.repository.createFromGitHub.mutate({
                owner: selectedRepo.owner.login,
                name: selectedRepo.name,
                fullName: selectedRepo.full_name,
                description: selectedRepo.description ?? null,
                defaultBranch: selectedRepo.default_branch,
                isPrivate: selectedRepo.private,
                githubId: selectedRepo.id,
                cloneUrl: selectedRepo.clone_url,
                htmlUrl: selectedRepo.html_url,
            });

            if (!repository) {
                throw new Error('Failed to create repository');
            }

            // Create sandbox for preview
            console.log(`GitUI: Creating sandbox for ${selectedRepo.full_name} (branch: ${selectedRepo.default_branch})`);
            const { sandboxId, previewUrl } = await clientApi.sandbox.createFromGitHub.mutate({
                repoUrl: selectedRepo.clone_url,
                branch: selectedRepo.default_branch,
            });

            // Setup dependencies and detect port
            console.log(`GitUI: Setting up dependencies for ${selectedRepo.full_name}`);
            let finalPreviewUrl = previewUrl;
            try {
                const setupResult = await clientApi.sandbox.setupDependencies.mutate({
                    sandboxId,
                });
                
                if (setupResult.success && setupResult.detectedPort && setupResult.detectedPort !== 3000) {
                    // Update preview URL with detected port
                    finalPreviewUrl = previewUrl.replace(':3000', `:${setupResult.detectedPort}`);
                    console.log(`GitUI: Updated preview URL to use port ${setupResult.detectedPort}: ${finalPreviewUrl}`);
                }
                
                if (setupResult.installedDependencies && setupResult.installedDependencies.length > 0) {
                    console.log(`GitUI: Installed dependencies: ${setupResult.installedDependencies.join(', ')}`);
                }
            } catch (error) {
                console.warn('GitUI: Failed to setup dependencies, continuing with default configuration:', error);
                // Don't fail the import if dependency setup fails
            }

            // Create project linked to repository
            const project = await clientApi.project.create.mutate({
                project: {
                    name: selectedRepo.name ?? 'New project',
                    description: selectedRepo.description ?? 'Imported from GitHub',
                    repositoryId: repository.id, // Link to repository
                },
                userId: user.id,
                sandboxId,
                sandboxUrl: finalPreviewUrl,
            });

            if (!project) {
                throw new Error('Failed to create project');
            }

            router.push(`${Routes.PROJECT}/${project.id}`);
        } catch (error) {
            let errorMessage = 'Failed to import repository';
            
            if (error instanceof Error) {
                errorMessage = error.message;
                
                // GitUI: Provide user-friendly error messages
                if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
                    errorMessage = `Import timed out. This usually means:
• The repository is taking too long to clone
• The branch "${selectedRepo.default_branch}" might not exist
• Try again in a few minutes

If this persists, check that your repository is public and the branch name is correct.`;
                } else if (errorMessage.includes('branch') && errorMessage.includes('not found')) {
                    errorMessage = `Branch "${selectedRepo.default_branch}" not found. 
                    
Common solutions:
• Check if your default branch is "main" instead of "master"
• Verify the branch exists in your repository
• Try importing again with the correct branch name`;
                } else if (errorMessage.includes('access') || errorMessage.includes('permission')) {
                    errorMessage = `Access denied to repository "${selectedRepo.full_name}".

Make sure:
• The repository is public, or
• You have the necessary permissions
• Your GitHub authentication is valid`;
                }
            }
            
            setError(errorMessage);
            console.error('GitUI: Error importing repository:', error);
        } finally {
            setIsImporting(false);
        }
    };

    const clearError = () => {
        setError(null);
    };

    return {
        isImporting,
        error,
        importRepository,
        clearError,
    };
};