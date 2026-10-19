"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { ThemeProvider } from "./ThemeProvider";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isAuthPage = pathname === "/auth" || pathname === "/login";
  const isPublicPage = isAuthPage || pathname === "/health";

  useEffect(() => {
    if (!isPublicPage && !loading && !isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [isPublicPage, loading, isAuthenticated, pathname, router]);

  // Isolate unauthenticated authentication experience from dashboard layout
  if (isAuthPage) {
    return (
      <ThemeProvider>
        <div className="min-h-screen w-full bg-background text-on-surface flex flex-col font-sans antialiased selection:bg-primary-container selection:text-on-primary-container">
          <main className="flex-1 w-full min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </ThemeProvider>
    );
  }

  // Loading state for protected pages while checking session credentials
  if (!isPublicPage && loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-widest text-[11px]">
            Verifying Security Credentials...
          </span>
        </div>
      </ThemeProvider>
    );
  }

  // Prevent flash of protected content while redirecting
  if (!isPublicPage && !isAuthenticated) {
    return (
      <ThemeProvider>
        <div className="min-h-screen w-full bg-background flex items-center justify-center" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans transition-colors duration-150 selection:bg-primary-container selection:text-on-primary-container">
        {/* Mobile Drawer Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Collapsible Sidebar */}
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Fixed TopBar */}
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Global Command Palette */}
        <GlobalSearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
        />

        {/* Main Content Area */}
        <main
          className={`flex-1 pt-16 transition-all duration-200 pl-0 ${
            sidebarCollapsed ? "lg:pl-18" : "lg:pl-72"
          }`}
        >
          <div className="min-h-[calc(100vh-4rem)] bg-background">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

