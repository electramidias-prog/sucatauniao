import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/components/LoginPage";
import { AppLayout } from "@/components/AppLayout";
import { DashboardPage } from "@/components/DashboardPage";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { ClientsPage } from "@/components/ClientsPage";
import { BalancaPage } from "@/components/BalancaPage";
import { UsersPage } from "@/components/UsersPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/chat-equipe" element={<PlaceholderPage title="Chat da Equipe" />} />
        <Route path="/balanca" element={<PlaceholderPage title="Balança / Pesagem" />} />
        <Route path="/estoque-fisico" element={<PlaceholderPage title="Estoque Físico" />} />
        <Route path="/estoque-fiscal" element={<PlaceholderPage title="Estoque Fiscal" />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/conta-corrente" element={<PlaceholderPage title="Conta Corrente" />} />
        <Route path="/mtr" element={<PlaceholderPage title="Calculadora MTR" />} />
        <Route path="/relatorios" element={<PlaceholderPage title="Relatórios & BI" />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/auditoria" element={<PlaceholderPage title="Auditoria" />} />
        <Route path="/configuracoes" element={<PlaceholderPage title="Configurações" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AuthenticatedApp />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
