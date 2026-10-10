"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { ThemeProvider } from "./ThemeProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
