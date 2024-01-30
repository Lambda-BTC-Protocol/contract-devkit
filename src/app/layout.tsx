"use client";
import "./globals.css";
import { registerSuperJSON } from "@/contracts/utils/superjson-recipes";
import NavBar from "@/components/nav-bar";
import { Toaster } from "@/components/ui/sonner";
import { ReactNode } from "react";

registerSuperJSON();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="container m-8 mx-auto">
        <Toaster />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
