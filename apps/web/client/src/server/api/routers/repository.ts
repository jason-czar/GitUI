import { createTRPCRouter, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { repositories, repositoryAccess } from '@onlook/db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const repositoryRouter = createTRPCRouter({
    createFromGitHub: protectedProcedure
        .input(z.object({
            owner: z.string(),
            name: z.string(),
            fullName: z.string(),
            description: z.string().nullable(),
            defaultBranch: z.string(),
            isPrivate: z.boolean(),
            githubId: z.number(),
            cloneUrl: z.string(),
            htmlUrl: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            // Check if repository already exists
            const existingRepo = await ctx.db.query.repositories.findFirst({
                where: eq(repositories.githubId, input.githubId),
            });

            if (existingRepo) {
                // Update existing repository
                const [updatedRepo] = await ctx.db
                    .update(repositories)
                    .set({
                        description: input.description,
                        defaultBranch: input.defaultBranch,
                        isPrivate: input.isPrivate.toString(),
                        updatedAt: new Date(),
                        lastSyncAt: new Date(),
                    })
                    .where(eq(repositories.id, existingRepo.id))
                    .returning();

                // Ensure user has access
                const existingAccess = await ctx.db.query.repositoryAccess.findFirst({
                    where: and(
                        eq(repositoryAccess.repositoryId, existingRepo.id),
                        eq(repositoryAccess.userId, ctx.user.id)
                    ),
                });

                if (!existingAccess) {
                    await ctx.db.insert(repositoryAccess).values({
                        repositoryId: existingRepo.id,
                        userId: ctx.user.id,
                        accessLevel: 'admin',
                        grantedBy: ctx.user.id,
                        grantedAt: new Date(),
                    });
                }

                return updatedRepo;
            }

            // Create new repository
            const [newRepo] = await ctx.db
                .insert(repositories)
                .values({
                    provider: 'github',
                    owner: input.owner,
                    name: input.name,
                    fullName: input.fullName,
                    description: input.description,
                    defaultBranch: input.defaultBranch,
                    isPrivate: input.isPrivate.toString(),
                    githubId: input.githubId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastSyncAt: new Date(),
                })
                .returning();

            if (!newRepo) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to create repository',
                });
            }

            // Grant access to the user
            await ctx.db.insert(repositoryAccess).values({
                repositoryId: newRepo.id,
                userId: ctx.user.id,
                accessLevel: 'admin',
                grantedBy: ctx.user.id,
                grantedAt: new Date(),
            });

            return newRepo;
        }),

    getUserRepositories: protectedProcedure
        .query(async ({ ctx }) => {
            const userRepos = await ctx.db.query.repositoryAccess.findMany({
                where: eq(repositoryAccess.userId, ctx.user.id),
                with: {
                    repository: true,
                },
            });

            return userRepos.map(access => access.repository);
        }),

    getById: protectedProcedure
        .input(z.object({
            id: z.string().uuid(),
        }))
        .query(async ({ input, ctx }) => {
            const repo = await ctx.db.query.repositories.findFirst({
                where: eq(repositories.id, input.id),
            });

            if (!repo) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Repository not found',
                });
            }

            // Check if user has access
            const hasAccess = await ctx.db.query.repositoryAccess.findFirst({
                where: and(
                    eq(repositoryAccess.repositoryId, repo.id),
                    eq(repositoryAccess.userId, ctx.user.id)
                ),
            });

            if (!hasAccess) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Access denied to repository',
                });
            }

            return repo;
        }),
});
