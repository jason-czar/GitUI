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

// Helper function to restart the development server after dependency installation
async function restartDevServer(provider: any, scripts: any, packageManager: string): Promise<number | null> {
    try {
        console.log('GitUI: Attempting to restart development server...');
        
        // Determine the dev command to run
        const devCommand = scripts.dev || scripts.start || scripts['dev:server'];
        
        if (!devCommand) {
            console.log('GitUI: No dev script found, trying common commands...');
            // Try common development commands based on package manager
            const fallbackCommands = [
                `${packageManager} run dev`,
                `${packageManager} run start`,
                `${packageManager} start`
            ];
            
            for (const cmd of fallbackCommands) {
                try {
                    console.log(`GitUI: Trying command: ${cmd}`);
                    await provider.runBackgroundCommand({
                        args: { command: cmd }
                    });
                    console.log(`GitUI: Successfully started dev server with: ${cmd}`);
                    break;
                } catch {
                    console.log(`GitUI: Command failed: ${cmd}, trying next...`);
                }
            }
        } else {
            // Use the dev script from package.json - simplified approach
            const runCommand = `${packageManager} run dev`;
            
            try {
                await provider.runBackgroundCommand({
                    args: { command: runCommand }
                });
                console.log(`GitUI: Successfully restarted dev server with: ${runCommand}`);
            } catch {
                console.log(`GitUI: Failed to restart with dev script, trying start...`);
                // Fallback to start command
                await provider.runBackgroundCommand({
                    args: { command: `${packageManager} run start` }
                });
                console.log(`GitUI: Successfully started dev server with start command`);
            }
        }
        
        // Give the server a moment to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to detect the actual running port by checking common ports
        console.log('GitUI: Detecting actual running port...');
        const actualPort = await detectRunningPort(provider);
        if (actualPort) {
            console.log(`GitUI: Detected server running on port ${actualPort}`);
            return actualPort;
        }
        
        return null;
        
    } catch (error) {
        console.warn('GitUI: Failed to restart development server:', error);
        // Don't throw - this is not critical enough to fail the whole process
        return null;
    }
}

// Helper function to detect the actual running port after server restart
async function detectRunningPort(provider: any): Promise<number | null> {
    // Common development server ports to check
    const commonPorts = [5000, 3000, 5173, 4000, 8000, 3001, 5001];
    
    for (const port of commonPorts) {
        try {
            // Try to make a simple HTTP request to check if port is active
            const result = await provider.runCommand({
                args: { command: `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port} || echo "000"` }
            });
            
            // If we get any HTTP response (even 404), the port is active
            if (result.output && !result.output.includes('000') && !result.output.includes('Connection refused')) {
                console.log(`GitUI: Found active server on port ${port}`);
                return port;
            }
        } catch {
            // Port check failed, continue to next port
        }
    }
    
    // Alternative approach: check for process listening on ports
    try {
        const result = await provider.runCommand({
            args: { command: `netstat -tlnp 2>/dev/null | grep LISTEN | grep -E ':(3000|5000|5173|4000|8000)' | head -1` }
        });
        
        if (result.output) {
            // Extract port from netstat output
            const portMatch = result.output.match(/:(\d+)\s/);
            if (portMatch) {
                const port = parseInt(portMatch[1]);
                console.log(`GitUI: Found server listening on port ${port} via netstat`);
                return port;
            }
        }
    } catch {
        // Netstat check failed
    }
    
    console.log('GitUI: Could not detect running port, using default');
    return null;
}

// AI-powered project analysis and setup functions
interface ProjectAnalysis {
    type: 'react' | 'vue' | 'svelte' | 'angular' | 'vanilla' | 'node' | 'unknown';
    framework: string;
    hasTypeScript: boolean;
    hasTailwind: boolean;
    buildTool: 'vite' | 'webpack' | 'parcel' | 'rollup' | 'none';
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
    entryPoint: string | null;
    missingDependencies: string[];
    issues: string[];
    recommendations: string[];
}

async function analyzeProject(provider: any): Promise<ProjectAnalysis> {
    console.log('GitUI: Analyzing project structure...');
    
    // Read package.json
    let packageJson: any = {};
    try {
        const packageFile = await provider.readFile({ args: { path: './package.json' } });
        if (packageFile?.file?.type === 'text') {
            packageJson = JSON.parse(packageFile.file.content);
        }
    } catch (error) {
        console.log('GitUI: No package.json found');
    }
    
    // Analyze file structure
    const files = await provider.listFiles({ args: { path: './' } });
    const fileNames = files.files.map((f: any) => f.name);
    
    // Detect project type and framework
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    let type: ProjectAnalysis['type'] = 'unknown';
    let framework = 'Unknown';
    
    if (deps.react || fileNames.some((f: string) => f.includes('jsx') || f.includes('tsx'))) {
        type = 'react';
        if (deps.next) framework = 'Next.js';
        else if (deps.gatsby) framework = 'Gatsby';
        else if (deps['react-scripts']) framework = 'Create React App';
        else framework = 'React';
    } else if (deps.vue || fileNames.some((f: string) => f.endsWith('.vue'))) {
        type = 'vue';
        framework = deps.nuxt ? 'Nuxt.js' : 'Vue.js';
    } else if (deps.svelte || fileNames.some((f: string) => f.endsWith('.svelte'))) {
        type = 'svelte';
        framework = deps['@sveltejs/kit'] ? 'SvelteKit' : 'Svelte';
    } else if (deps['@angular/core']) {
        type = 'angular';
        framework = 'Angular';
    } else if (deps.express || deps.fastify || deps.koa || deps.hapi || deps.restify) {
        type = 'node';
        if (deps.express) framework = 'Express.js';
        else if (deps.fastify) framework = 'Fastify';
        else if (deps.koa) framework = 'Koa.js';
        else if (deps.hapi) framework = 'Hapi.js';
        else if (deps.restify) framework = 'Restify';
        else framework = 'Node.js';
    } else if (fileNames.some((f: string) => f.endsWith('.html'))) {
        type = 'vanilla';
        framework = 'Vanilla JavaScript';
    }
    
    // Detect build tool
    let buildTool: ProjectAnalysis['buildTool'] = 'none';
    if (deps.vite || fileNames.includes('vite.config.js') || fileNames.includes('vite.config.ts')) {
        buildTool = 'vite';
    } else if (deps.webpack || fileNames.includes('webpack.config.js')) {
        buildTool = 'webpack';
    } else if (deps.parcel) {
        buildTool = 'parcel';
    } else if (deps.rollup) {
        buildTool = 'rollup';
    }
    
    // Detect package manager
    let packageManager: ProjectAnalysis['packageManager'] = 'npm';
    if (fileNames.includes('bun.lockb')) packageManager = 'bun';
    else if (fileNames.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
    else if (fileNames.includes('yarn.lock')) packageManager = 'yarn';
    
    // Check for TypeScript and Tailwind
    const hasTypeScript = !!(deps.typescript || fileNames.some((f: string) => f.endsWith('.ts') || f.endsWith('.tsx')));
    const hasTailwind = !!(deps.tailwindcss || fileNames.includes('tailwind.config.js'));
    
    // Find entry point
    let entryPoint: string | null = null;
    const possibleEntries = ['index.html', 'src/index.html', 'public/index.html', 'index.js', 'src/index.js', 'src/main.js', 'src/App.js'];
    for (const entry of possibleEntries) {
        try {
            await provider.readFile({ args: { path: `./${entry}` } });
            entryPoint = entry;
            break;
        } catch {
            // File doesn't exist
        }
    }
    
    // Identify missing dependencies and issues
    const missingDependencies: string[] = [];
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (type === 'react' && !deps.react) {
        missingDependencies.push('react', 'react-dom');
        issues.push('React project missing React dependencies');
    }
    
    if (hasTypeScript && !deps.typescript) {
        missingDependencies.push('typescript', '@types/node');
        // Add tsx for TypeScript execution in Node.js/Express projects
        if (type === 'node' || type === 'unknown') {
            missingDependencies.push('tsx');
        }
        if (type === 'react') missingDependencies.push('@types/react', '@types/react-dom');
    }
    
    // For Node.js/Express projects, ensure tsx is available for TypeScript execution
    if (type === 'node' && hasTypeScript && !deps.tsx) {
        missingDependencies.push('tsx');
    }
    
    if (buildTool === 'none' && type !== 'vanilla') {
        recommendations.push('Consider adding a build tool like Vite for better development experience');
    }
    
    if (!entryPoint) {
        issues.push('No entry point found - may need to create index.html');
        recommendations.push('Create an index.html file in the root or public directory');
    }
    
    return {
        type,
        framework,
        hasTypeScript,
        hasTailwind,
        buildTool,
        packageManager,
        entryPoint,
        missingDependencies,
        issues,
        recommendations,
    };
}

async function installMissingDependencies(provider: any, analysis: ProjectAnalysis) {
    if (analysis.missingDependencies.length === 0) {
        return { installed: [], message: 'No missing dependencies' };
    }
    
    console.log(`GitUI: Installing missing dependencies: ${analysis.missingDependencies.join(', ')}`);
    
    // Separate dev dependencies from regular dependencies
    const devDeps = analysis.missingDependencies.filter(dep => 
        dep.includes('@types/') || dep === 'typescript' || dep === 'tsx'
    );
    const regularDeps = analysis.missingDependencies.filter(dep => !devDeps.includes(dep));
    
    const installCmd = analysis.packageManager === 'npm' ? 'npm install' :
                      analysis.packageManager === 'yarn' ? 'yarn add' :
                      analysis.packageManager === 'pnpm' ? 'pnpm add' :
                      'bun add';
    
    const devInstallCmd = analysis.packageManager === 'npm' ? 'npm install -D' :
                         analysis.packageManager === 'yarn' ? 'yarn add -D' :
                         analysis.packageManager === 'pnpm' ? 'pnpm add -D' :
                         'bun add -D';
    
    try {
        // Install regular dependencies first
        if (regularDeps.length > 0) {
            const command = `${installCmd} ${regularDeps.join(' ')}`;
            await provider.runCommand({ args: { command } });
            console.log(`GitUI: Installed regular dependencies: ${regularDeps.join(', ')}`);
        }
        
        // Install dev dependencies
        if (devDeps.length > 0) {
            const devCommand = `${devInstallCmd} ${devDeps.join(' ')}`;
            await provider.runCommand({ args: { command: devCommand } });
            console.log(`GitUI: Installed dev dependencies: ${devDeps.join(', ')}`);
        }
        
        return { installed: analysis.missingDependencies, message: 'Dependencies installed successfully' };
    } catch (error) {
        return { installed: [], message: `Failed to install dependencies: ${error}` };
    }
}

async function generateConfigFiles(provider: any, analysis: ProjectAnalysis) {
    const changes: string[] = [];
    
    // Generate Vite config for React projects without build tool
    if (analysis.type === 'react' && analysis.buildTool === 'none') {
        const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: true
  }
})`;
        
        try {
            await provider.writeFile({ 
                args: { 
                    path: './vite.config.js', 
                    content: viteConfig 
                } 
            });
            changes.push('Created vite.config.js');
        } catch (error) {
            console.warn('Failed to create vite.config.js:', error);
        }
    }
    
    // Generate TypeScript config if needed
    if (analysis.hasTypeScript) {
        const tsConfig = {
            compilerOptions: {
                target: 'ES2020',
                lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                skipLibCheck: true,
                moduleResolution: 'bundler',
                allowImportingTsExtensions: true,
                resolveJsonModule: true,
                isolatedModules: true,
                noEmit: true,
                jsx: analysis.type === 'react' ? 'react-jsx' : 'preserve',
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true
            },
            include: ['src'],
            references: [{ path: './tsconfig.node.json' }]
        };
        
        try {
            await provider.writeFile({ 
                args: { 
                    path: './tsconfig.json', 
                    content: JSON.stringify(tsConfig, null, 2) 
                } 
            });
            changes.push('Created tsconfig.json');
        } catch (error) {
            console.warn('Failed to create tsconfig.json:', error);
        }
    }
    
    return { changes, message: `Generated ${changes.length} configuration files` };
}

async function optimizeBuildScripts(provider: any, analysis: ProjectAnalysis) {
    try {
        const packageFile = await provider.readFile({ args: { path: './package.json' } });
        if (!packageFile?.file || packageFile.file.type !== 'text') {
            return { changes: [], message: 'No package.json found' };
        }
        
        const packageJson = JSON.parse(packageFile.file.content);
        const changes: string[] = [];
        
        // Ensure proper scripts exist
        if (!packageJson.scripts) packageJson.scripts = {};
        
        if (analysis.type === 'react' && analysis.buildTool === 'vite') {
            if (!packageJson.scripts.dev) {
                packageJson.scripts.dev = 'vite';
                changes.push('Added dev script');
            }
            if (!packageJson.scripts.build) {
                packageJson.scripts.build = 'vite build';
                changes.push('Added build script');
            }
            if (!packageJson.scripts.preview) {
                packageJson.scripts.preview = 'vite preview';
                changes.push('Added preview script');
            }
        } else if (analysis.type === 'node' && analysis.hasTypeScript) {
            // For Node.js/Express TypeScript projects, ensure proper dev script with tsx
            if (!packageJson.scripts.dev) {
                // Look for main entry point
                const mainFile = packageJson.main || 'server/index.ts' || 'src/index.ts' || 'index.ts';
                packageJson.scripts.dev = `NODE_ENV=development tsx ${mainFile}`;
                changes.push('Added TypeScript dev script with tsx');
            } else if (packageJson.scripts.dev && !packageJson.scripts.dev.includes('tsx') && analysis.hasTypeScript) {
                // Update existing dev script to use tsx for TypeScript
                const currentDev = packageJson.scripts.dev;
                if (currentDev.includes('node ') && currentDev.includes('.ts')) {
                    packageJson.scripts.dev = currentDev.replace('node ', 'tsx ');
                    changes.push('Updated dev script to use tsx for TypeScript');
                }
            }
            
            if (!packageJson.scripts.start) {
                const mainFile = packageJson.main || 'server/index.js' || 'src/index.js' || 'index.js';
                packageJson.scripts.start = `node ${mainFile}`;
                changes.push('Added start script');
            }
        }
        
        // Add missing dependencies to package.json
        if (analysis.missingDependencies.length > 0) {
            if (!packageJson.dependencies) packageJson.dependencies = {};
            if (!packageJson.devDependencies) packageJson.devDependencies = {};
            
            for (const dep of analysis.missingDependencies) {
                if (dep.includes('@types/') || dep === 'typescript') {
                    packageJson.devDependencies[dep] = 'latest';
                } else {
                    packageJson.dependencies[dep] = 'latest';
                }
            }
            changes.push('Updated dependencies in package.json');
        }
        
        if (changes.length > 0) {
            await provider.writeFile({ 
                args: { 
                    path: './package.json', 
                    content: JSON.stringify(packageJson, null, 2) 
                } 
            });
        }
        
        return { changes, message: `Made ${changes.length} script optimizations` };
    } catch (error) {
        return { changes: [], message: `Failed to optimize scripts: ${error}` };
    }
}

async function setupEntryPoints(provider: any, analysis: ProjectAnalysis) {
    const changes: string[] = [];
    
    // Create index.html if missing
    if (!analysis.entryPoint && analysis.type !== 'node') {
        const htmlContent = analysis.type === 'react' ? 
            `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${analysis.hasTypeScript ? 'tsx' : 'jsx'}"></script>
  </body>
</html>` :
            `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Web App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`;
        
        try {
            await provider.writeFile({ 
                args: { 
                    path: './index.html', 
                    content: htmlContent 
                } 
            });
            changes.push('Created index.html');
        } catch (error) {
            console.warn('Failed to create index.html:', error);
        }
    }
    
    // Create main entry file for React if missing
    if (analysis.type === 'react') {
        const mainFile = `src/main.${analysis.hasTypeScript ? 'tsx' : 'jsx'}`;
        try {
            await provider.readFile({ args: { path: `./${mainFile}` } });
        } catch {
            // File doesn't exist, create it
            const mainContent = analysis.hasTypeScript ? 
                `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)` :
                `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
            
            try {
                await provider.runCommand({ args: { command: 'mkdir -p src' } });
                await provider.writeFile({ 
                    args: { 
                        path: `./${mainFile}`, 
                        content: mainContent 
                    } 
                });
                changes.push(`Created ${mainFile}`);
            } catch (error) {
                console.warn(`Failed to create ${mainFile}:`, error);
            }
        }
    }
    
    return { changes, message: `Setup ${changes.length} entry points` };
}

async function startDevelopmentServer(provider: any, analysis: ProjectAnalysis) {
    console.log('GitUI: Starting development server...');
    
    const devCommand = analysis.packageManager === 'npm' ? 'npm run dev' :
                      analysis.packageManager === 'yarn' ? 'yarn dev' :
                      analysis.packageManager === 'pnpm' ? 'pnpm dev' :
                      'bun dev';
    
    try {
        await provider.runBackgroundCommand({ args: { command: devCommand } });
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Detect actual port
        const port = await detectRunningPort(provider) || 5000;
        
        return { 
            success: true, 
            port, 
            command: devCommand,
            message: `Development server started on port ${port}` 
        };
    } catch (error) {
        return { 
            success: false, 
            port: 3000, 
            command: devCommand,
            message: `Failed to start server: ${error}` 
        };
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
                
                // Detect the development server port FIRST
                // Common ports: Next.js (3000), Vite (5173), React dev server (3000), Express (5000), etc.
                let detectedPort = 3000; // default fallback
                
                // First, check for framework-specific defaults
                const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (allDeps.vite) {
                    detectedPort = 5173; // Vite default
                } else if (allDeps.next) {
                    detectedPort = 3000; // Next.js default
                } else if (allDeps.express) {
                    detectedPort = 5000; // Express common default
                } else if (allDeps['react-scripts']) {
                    detectedPort = 3000; // Create React App default
                }
                
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
                        
                        // After installing dependencies, restart the dev server
                        console.log(`GitUI: Restarting development server after dependency installation`);
                        const actualPort = await restartDevServer(provider, packageJson.scripts || {}, packageManager);
                        
                        // If we detected a different port, update our detected port
                        if (actualPort && actualPort !== detectedPort) {
                            console.log(`GitUI: Server switched to port ${actualPort} after dependency installation (was ${detectedPort})`);
                            detectedPort = actualPort;
                        }
                        
                    } catch (error) {
                        console.warn('GitUI: Failed to install dependencies:', error);
                        // Don't fail the whole process if dependency installation fails
                    }
                }
                
                // Check package.json scripts for port configuration (this can override framework defaults)
                const scripts = packageJson.scripts || {};
                const devScript = scripts.dev || scripts.start || scripts['dev:server'];
                
                if (devScript) {
                    // Look for port in dev script
                    const portMatch = devScript.match(/--port[=\s]+(\d+)|port[=\s]+(\d+)|-p[=\s]+(\d+)/i);
                    if (portMatch) {
                        const port = portMatch[1] || portMatch[2] || portMatch[3];
                        if (port) {
                            detectedPort = parseInt(port);
                        }
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
                                const port = portMatch[1] || portMatch[2];
                                if (port) {
                                    detectedPort = parseInt(port);
                                    break;
                                }
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
    aiProjectSetup: protectedProcedure
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
                console.log(`GitUI: Starting AI-powered project setup for sandbox ${input.sandboxId}`);
                
                // Step 1: Analyze project structure and type
                const projectAnalysis = await analyzeProject(provider);
                console.log(`GitUI: Project analysis complete:`, projectAnalysis);
                
                // Step 2: Install missing dependencies
                const dependencyResults = await installMissingDependencies(provider, projectAnalysis);
                console.log(`GitUI: Dependency installation:`, dependencyResults);
                
                // Step 3: Generate/fix configuration files
                const configResults = await generateConfigFiles(provider, projectAnalysis);
                console.log(`GitUI: Configuration setup:`, configResults);
                
                // Step 4: Fix build scripts and package.json
                const scriptResults = await optimizeBuildScripts(provider, projectAnalysis);
                console.log(`GitUI: Build script optimization:`, scriptResults);
                
                // Step 5: Create/fix entry points and routing
                const entryResults = await setupEntryPoints(provider, projectAnalysis);
                console.log(`GitUI: Entry point setup:`, entryResults);
                
                // Step 6: Start development server and detect port
                const serverResults = await startDevelopmentServer(provider, projectAnalysis);
                console.log(`GitUI: Development server:`, serverResults);
                
                return {
                    success: true,
                    projectAnalysis,
                    changes: {
                        dependencies: dependencyResults,
                        configuration: configResults,
                        scripts: scriptResults,
                        entryPoints: entryResults,
                        server: serverResults,
                    },
                    detectedPort: serverResults.port,
                    message: `AI setup complete for ${projectAnalysis.type} project`,
                };
                
            } catch (error) {
                console.error('GitUI: AI project setup failed:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `AI project setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    cause: error,
                });
            } finally {
                await provider.destroy();
            }
        }),
});
