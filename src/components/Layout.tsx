import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="fixed inset-0 bg-glow-primary pointer-events-none" aria-hidden="true" />
      <div className="fixed inset-0 bg-mesh-pattern bg-[length:32px_32px] pointer-events-none opacity-40" aria-hidden="true" />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <div className="px-6 py-6 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;