import { CodeProvider, createCodeProviderClient, getStaticCodeProvider } from '@onlook/code-provider';
import { getSandboxPreviewUrl } from '@onlook/constants';
import { shortenUuid } from '@onlook/utility/src/id';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../../trpc';

function getProvider({
    sandboxId,
    userId,
    provider = CodeProvider.CodeSandbox,
}: {
    sandboxId: string,
    provider?: CodeProvider,
    userId?: undefined | string,
}) {
    if (provider === CodeProvider.CodeSandbox) {
        return createCodeProviderClient(CodeProvider.CodeSandbox, {
            providerOptions: {
                codesandbox: {
                    sandboxId,
                    userId,
                },
            },
        });
    } else {
        return createCodeProviderClient(CodeProvider.NodeFs, {
            providerOptions: {
                nodefs: {},
            },
        });
    }
}

export const sandboxRouter = createTRPCRouter({
    start: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const userId = ctx.user.id;
            const provider = await getProvider({
                sandboxId: input.sandboxId,
                userId,
            });
            const session = await provider.createSession({
                args: {
                    id: shortenUuid(userId, 20),
                },
            });
            await provider.destroy();
            return session;
        }),
    hibernate: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            const provider = await getProvider({ sandboxId: input.sandboxId });
            try {
                await provider.pauseProject({});
            } finally {
                await provider.destroy().catch(() => { });
            }
        }),
    list: protectedProcedure.input(z.object({ sandboxId: z.string() })).query(async ({ input }) => {
        const provider = await getProvider({ sandboxId: input.sandboxId });
        const res = await provider.listProjects({});
        // TODO future iteration of code provider abstraction will need this code to be refactored
        if ('projects' in res) {
            return res.projects;
        }
        return [];
    }),
    fork: protectedProcedure
        .input(
            z.object({
                sandbox: z.object({
                    id: z.string(),
                    port: z.number(),
                }),
                config: z
                    .object({
                        title: z.string().optional(),
                        tags: z.array(z.string()).optional(),
                    })
                    .optional(),
            }),
        )
        .mutation(async ({ input }) => {
            const MAX_RETRY_ATTEMPTS = 3;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                    const CodesandboxProvider = await getStaticCodeProvider(CodeProvider.CodeSandbox);
                    const sandbox = await CodesandboxProvider.createProject({
                        source: 'template',
                        id: input.sandbox.id,

                        // Metadata
                        title: input.config?.title,
                        tags: input.config?.tags,
                    });

                    const previewUrl = getSandboxPreviewUrl(sandbox.id, input.sandbox.port);

                    return {
                        sandboxId: sandbox.id,
                        previewUrl,
                    };
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));

                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    }
                }
            }

            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to create sandbox after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`,
                cause: lastError,
            });
        }),
    delete: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            const provider = await getProvider({ sandboxId: input.sandboxId });
            try {
                await provider.stopProject({});
            } finally {
                await provider.destroy().catch(() => { });
            }
        }),
    createFromGitHub: protectedProcedure
        .input(
            z.object({
                repoUrl: z.string(),
                branch: z.string(),
            }),
        )
        .mutation(async ({ input }) => {
            const MAX_RETRY_ATTEMPTS = 2; // GitUI: Reduced retries since we have better error handling
            const DEFAULT_PORT = 3000;
            let lastError: Error | null = null;

            console.log(`GitUI: Starting GitHub sandbox creation for ${input.repoUrl} (branch: ${input.branch})`);

            for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                    console.log(`GitUI: Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);
                    
                    const CodesandboxProvider = await getStaticCodeProvider(CodeProvider.CodeSandbox);
                    const sandbox = await CodesandboxProvider.createProjectFromGit({
                        repoUrl: input.repoUrl,
                        branch: input.branch,
                    });

                    const previewUrl = getSandboxPreviewUrl(sandbox.id, DEFAULT_PORT);

                    console.log(`GitUI: Successfully created sandbox ${sandbox.id}`);
                    return {
                        sandboxId: sandbox.id,
                        previewUrl,
                    };
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    console.warn(`GitUI: Attempt ${attempt} failed:`, lastError.message);

                    // GitUI: Don't retry on certain types of errors
                    const errorMessage = lastError.message.toLowerCase();
                    if (errorMessage.includes('branch') && errorMessage.includes('not found')) {
                        console.log('GitUI: Branch not found - not retrying');
                        break;
                    }
                    if (errorMessage.includes('access denied') || errorMessage.includes('permission')) {
                        console.log('GitUI: Access denied - not retrying');
                        break;
                    }

                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        const delay = Math.pow(2, attempt) * 1000;
                        console.log(`GitUI: Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            // GitUI: Enhanced error reporting
            const errorCode = lastError?.message.includes('timeout') ? 'TIMEOUT' : 
                             lastError?.message.includes('branch') ? 'BAD_REQUEST' :
                             lastError?.message.includes('access') ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR';

            throw new TRPCError({
                code: errorCode,
                message: `GitUI: Failed to import repository after ${MAX_RETRY_ATTEMPTS} attempts. ${lastError?.message || 'Unknown error'}`,
                cause: lastError,
            });
        }),
    setupDependencies: protectedProcedure
        .input(
            z.object({
                sandboxId: z.string(),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const userId = ctx.user.id;
            const provider = await getProvider({
                sandboxId: input.sandboxId,
                userId,
            });

            try {
                console.log(`GitUI: Setting up dependencies for sandbox ${input.sandboxId}`);
                
                // Check if package.json exists and analyze dependencies
                const packageJsonFile = await provider.readFile({
                    args: { path: './package.json' }
                });

                if (!packageJsonFile?.file || packageJsonFile.file.type !== 'text') {
                    console.log('GitUI: No package.json found, skipping dependency setup');
                    return { success: true, message: 'No package.json found' };
                }

                const packageJson = JSON.parse(packageJsonFile.file.content as string);
                const devDeps = packageJson.devDependencies || {};
                const deps = packageJson.dependencies || {};
                
                // Check what dependencies need to be installed
                const requiredDevDeps = [];
                if (!devDeps.typescript && !deps.typescript) {
                    requiredDevDeps.push('typescript');
                }
                if (!devDeps.tsx && !deps.tsx) {
                    requiredDevDeps.push('tsx');
                }
                if (!devDeps['@types/node'] && !deps['@types/node']) {
                    requiredDevDeps.push('@types/node');
                }

                // Detect package manager
                const files = await provider.listFiles({ args: { path: './' } });
                let packageManager = 'npm';
                
                if (files.files.some(f => f.name === 'bun.lockb')) {
                    packageManager = 'bun';
                } else if (files.files.some(f => f.name === 'pnpm-lock.yaml')) {
                    packageManager = 'pnpm';
                } else if (files.files.some(f => f.name === 'yarn.lock')) {
                    packageManager = 'yarn';
                }

                console.log(`GitUI: Detected package manager: ${packageManager}`);

                // Install missing dependencies if any
                if (requiredDevDeps.length > 0) {
                    console.log(`GitUI: Installing missing dev dependencies: ${requiredDevDeps.join(', ')}`);
                    
                    const installCommand = packageManager === 'npm' ? 'npm install -D' :
                                         packageManager === 'yarn' ? 'yarn add -D' :
                                         packageManager === 'pnpm' ? 'pnpm add -D' :
                                         'bun add -D';
                    
                    const command = `${installCommand} ${requiredDevDeps.join(' ')}`;
                    
                    try {
                        const result = await provider.runCommand({
                            args: { command }
                        });
                        console.log(`GitUI: Dependency installation result:`, result.output);
                    } catch (error) {
                        console.warn('GitUI: Failed to install dependencies:', error);
                        // Don't fail the whole process if dependency installation fails
                    }
                }

                // Detect the development server port
                let detectedPort = 3000; // default
                
                // Check package.json scripts for port configuration
                const scripts = packageJson.scripts || {};
                const devScript = scripts.dev || scripts.start || scripts['dev:server'];
                
                if (devScript) {
                    // Look for port in dev script
                    const portMatch = devScript.match(/--port[=\s]+(\d+)|port[=\s]+(\d+)|-p[=\s]+(\d+)/i);
                    if (portMatch) {
                        detectedPort = parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
                    }
                }

                // Check for common config files that might specify port
                const configFiles = [
                    'vite.config.js', 'vite.config.ts',
                    'next.config.js', 'next.config.ts',
                    'webpack.config.js', 'webpack.config.ts'
                ];

                for (const configFile of configFiles) {
                    try {
                        const config = await provider.readFile({
                            args: { path: `./${configFile}` }
                        });
                        
                        if (config?.file && config.file.type === 'text') {
                            const portMatch = (config.file.content as string).match(/port:\s*(\d+)|PORT:\s*(\d+)/);
                            if (portMatch) {
                                detectedPort = parseInt(portMatch[1] || portMatch[2]);
                                break;
                            }
                        }
                    } catch {
                        // Ignore file not found errors
                    }
                }

                console.log(`GitUI: Detected development server port: ${detectedPort}`);

                return {
                    success: true,
                    installedDependencies: requiredDevDeps,
                    packageManager,
                    detectedPort,
                    message: requiredDevDeps.length > 0 
                        ? `Installed ${requiredDevDeps.length} missing dependencies`
                        : 'All required dependencies already present'
                };
            } catch (error) {
                console.error('GitUI: Error setting up dependencies:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to setup dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    cause: error,
                });
            } finally {
                await provider.destroy();
            }
        }),
});
