export enum ProcessedFileType {
    BINARY = 'binary',
    TEXT = 'text',
}

interface BaseProcessedFile {
    path: string;
    content: string | ArrayBuffer;
    type: ProcessedFileType;
}

export interface BinaryProcessedFile extends BaseProcessedFile {
    type: ProcessedFileType.BINARY;
    content: ArrayBuffer;
}

export interface TextProcessedFile extends BaseProcessedFile {
    type: ProcessedFileType.TEXT;
    content: string;
}

export type ProcessedFile = BinaryProcessedFile | TextProcessedFile;

export interface NextJsProjectValidation {
    isValid: boolean;
    routerType?: 'app' | 'pages';
    error?: string;
}

// GitUI: Support for React + TypeScript + Tailwind projects (including NextJS)
export interface ReactProjectValidation {
    isValid: boolean;
    projectType: 'nextjs' | 'react' | 'vite' | 'cra';
    hasTypeScript: boolean;
    hasTailwind: boolean;
    routerType?: 'app' | 'pages' | 'react-router' | 'none';
    error?: string;
}
