import {
    generateSandboxConfig,
    generateViteConfig,
    generateNextJsDevScript,
    detectProjectType,
    generateConfigFiles,
    validateCodeSandboxConfig,
    generatePreviewUrl,
} from '../codesandbox-config';

describe('CodeSandbox Configuration Utils', () => {
    describe('generateSandboxConfig', () => {
        it('should generate correct sandbox config', () => {
            const config = generateSandboxConfig();
            expect(config).toEqual({
                container: {
                    port: 3000,
                    startScript: 'dev',
                },
                view: 'browser',
            });
        });
    });

    describe('generateViteConfig', () => {
        it('should generate TypeScript config', () => {
            const config = generateViteConfig(true);
            expect(config).toContain('import { defineConfig } from "vite"');
            expect(config).toContain('host: true');
            expect(config).toContain('port: Number(process.env.PORT) || 3000');
            expect(config).toContain('strictPort: true');
        });

        it('should generate JavaScript config', () => {
            const config = generateViteConfig(false);
            expect(config).toContain('import { defineConfig } from "vite"');
        });
    });

    describe('generateNextJsDevScript', () => {
        it('should generate correct Next.js dev script', () => {
            const script = generateNextJsDevScript();
            expect(script).toBe('next dev -H 0.0.0.0 -p ${PORT:-3000}');
        });
    });

    describe('detectProjectType', () => {
        it('should detect Vite project', () => {
            const packageJson = {
                devDependencies: {
                    vite: '^4.0.0',
                    typescript: '^4.0.0',
                },
            };
            const result = detectProjectType(packageJson);
            expect(result.type).toBe('vite');
            expect(result.hasTypeScript).toBe(true);
            expect(result.configFile).toBe('vite.config.ts');
        });

        it('should detect Next.js project', () => {
            const packageJson = {
                dependencies: {
                    next: '^13.0.0',
                    react: '^18.0.0',
                },
            };
            const result = detectProjectType(packageJson);
            expect(result.type).toBe('nextjs');
            expect(result.hasTypeScript).toBe(false);
        });

        it('should detect CRA project', () => {
            const packageJson = {
                dependencies: {
                    'react-scripts': '^5.0.0',
                },
            };
            const result = detectProjectType(packageJson);
            expect(result.type).toBe('cra');
        });

        it('should default to custom project', () => {
            const packageJson = {
                dependencies: {
                    react: '^18.0.0',
                },
            };
            const result = detectProjectType(packageJson);
            expect(result.type).toBe('custom');
        });
    });

    describe('generateConfigFiles', () => {
        it('should generate files for Vite project', () => {
            const projectType = {
                type: 'vite' as const,
                hasTypeScript: true,
                configFile: 'vite.config.ts',
            };
            const packageJson = { name: 'test-project' };

            const files = generateConfigFiles(projectType, packageJson);

            expect(files['sandbox.config.json']).toBeDefined();
            expect(files['vite.config.ts']).toBeDefined();
            expect(JSON.parse(files['sandbox.config.json'])).toEqual({
                container: { port: 3000, startScript: 'dev' },
                view: 'browser',
            });
        });

        it('should generate files for Next.js project', () => {
            const projectType = {
                type: 'nextjs' as const,
                hasTypeScript: false,
            };
            const packageJson = {
                name: 'test-project',
                scripts: { dev: 'next dev' },
            };

            const files = generateConfigFiles(projectType, packageJson);

            expect(files['sandbox.config.json']).toBeDefined();
            expect(files['package.json']).toBeDefined();

            const updatedPackageJson = JSON.parse(files['package.json']);
            expect(updatedPackageJson.scripts.dev).toBe('next dev -H 0.0.0.0 -p ${PORT:-3000}');
        });

        it('should generate files for custom project', () => {
            const projectType = {
                type: 'custom' as const,
                hasTypeScript: false,
            };
            const packageJson = { name: 'test-project' };

            const files = generateConfigFiles(projectType, packageJson);

            expect(files['sandbox.config.json']).toBeDefined();
            expect(files['CODESANDBOX_SETUP.md']).toBeDefined();
            expect(files['CODESANDBOX_SETUP.md']).toContain('Manual Configuration Required');
        });
    });

    describe('validateCodeSandboxConfig', () => {
        it('should validate correct configuration', () => {
            const files = {
                'sandbox.config.json': JSON.stringify({
                    container: { port: 3000, startScript: 'dev' },
                    view: 'browser',
                }),
                'package.json': JSON.stringify({
                    scripts: { dev: 'vite' },
                }),
            };

            const result = validateCodeSandboxConfig(files);
            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect missing sandbox.config.json', () => {
            const files = {};

            const result = validateCodeSandboxConfig(files);
            expect(result.isValid).toBe(false);
            expect(result.issues).toContain('Missing sandbox.config.json file');
        });

        it('should detect incorrect port', () => {
            const files = {
                'sandbox.config.json': JSON.stringify({
                    container: { port: 8080, startScript: 'dev' },
                    view: 'browser',
                }),
            };

            const result = validateCodeSandboxConfig(files);
            expect(result.isValid).toBe(false);
            expect(result.issues).toContain('sandbox.config.json should specify port 3000');
        });
    });

    describe('generatePreviewUrl', () => {
        it('should generate correct preview URL', () => {
            const url = generatePreviewUrl('abc123');
            expect(url).toBe('https://abc123-3000.csb.app');
        });

        it('should generate preview URL with custom port', () => {
            const url = generatePreviewUrl('abc123', 8080);
            expect(url).toBe('https://abc123-8080.csb.app');
        });
    });
});
