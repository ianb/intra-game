import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intra: the game",
  description: "Text adventure game by Ian Bicking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return React.createElement(
    "html",
    { lang: "en" },
    React.createElement("body", { className: `antialiased` }, children)
  );
}
