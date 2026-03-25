import { useState, type ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { AIChatPanel } from './AIChatPanel';

export function AppLayout({ children }: { children: ReactNode }) {
  const [anaOpen, setAnaOpen] = useState(false);
  const [carlinhosOpen, setCarlinhosOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <AppSidebar
        onOpenAna={() => { setAnaOpen(true); setCarlinhosOpen(false); }}
        onOpenCarlinhos={() => { setCarlinhosOpen(true); setAnaOpen(false); }}
      />
      
      {/* Main content - offset for sidebar */}
      <main className="ml-14 lg:ml-56 p-4 min-h-screen transition-all duration-200">
        {children}
      </main>

      {/* AI Chat Panels */}
      <AIChatPanel variant="ana" open={anaOpen} onClose={() => setAnaOpen(false)} />
      <AIChatPanel variant="carlinhos" open={carlinhosOpen} onClose={() => setCarlinhosOpen(false)} />
    </div>
  );
}
