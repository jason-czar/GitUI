export const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GitUI",
    url: "https://onlook.com/",
    logo: "https://onlook.com/favicon.ico",
    sameAs: [
        "https://github.com/onlook-dev/onlook",
        "https://twitter.com/onlookdev",
        "https://www.linkedin.com/company/onlook-dev/",
    ],
};

export const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
        {
            "@type": "Question",
            name: "What kinds of things can I design with GitUI?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "You can prototype, ideate, and create websites from scratch with GitUI",
            },
        },
        {
            "@type": "Question",
            name: "Why would I use GitUI?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "When you design in GitUI you design in the real product – in other words, the source of truth. Other products are great for ideating, but GitUI is the only one that lets you design with the existing product and the only one that translates your designs to code instantly.",
            },
        },
        {
            "@type": "Question",
            name: "Who owns the code that I write with GitUI?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "The code you make with GitUI is all yours. Your code is written locally directly to your files, and isn't hosted off your device.",
            },
        },
    ],
};
