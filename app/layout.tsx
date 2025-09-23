import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://removepersonfromphoto.com"
  ),
  title: "Remove exes, strangers, or photobombers from photos – AI Editor",
  description:
    "Remove exes, strangers or photobombers from your pictures using AI in seconds. Upload a photo, describe who to remove, and get a seamless edit.",
  openGraph: {
    title: "Remove exes, strangers, or photobombers from photos – AI Editor",
    description:
      "Remove exes, strangers or photobombers from your pictures using AI in seconds. Upload, preview, and download full-res edits.",
    url: "https://removepersonfromphoto.com",
    siteName: "Remove Person From Photo",
    images: [
      {
        url: "https://removepersonfromphoto.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Remove Person From Photo preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Remove exes, strangers, or photobombers from photos – AI Editor",
    description:
      "Remove exes, strangers or photobombers from your pictures using AI in seconds. Upload, preview, and download seamless photo edits.",
    images: ["https://removepersonfromphoto.com/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-5Z1K5E8K8V"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-5Z1K5E8K8V');
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-b from-white to-gray-50 min-h-screen`}
      >
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}