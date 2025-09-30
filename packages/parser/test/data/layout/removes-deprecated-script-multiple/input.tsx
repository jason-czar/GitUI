import Script from 'next/script';
import React, { type ReactNode } from 'react';

// Mock components
const ThemeProvider = (props: { children: ReactNode; [key: string]: any }) => <>{props.children}</>;
const Navbar = (props: any) => <header>Navbar</header>;
const Footer = (props: any) => <footer>Footer</footer>;

export default function Document() {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <Script
                    type="module"
                    src="https://cdn.jsdelivr.net/gh/onlook-dev/onlook@main/apps/web/preload/dist/index.js"
                />

                <Script
                    type="module"
                    src="https://cdn.jsdelivr.net/gh/onlook-dev/web@latest/apps/web/preload/dist/index.js"
                />
            </head>
            <body className={'h-screen antialiased'}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Navbar />
                    <main className="">
                        {/* @ts-ignore */}
                        {children}
                    </main>
                    <Footer />
                </ThemeProvider>
            </body>
        </html>
    );
}
