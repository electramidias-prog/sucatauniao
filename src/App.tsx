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
import { ContaCorrentePage } from "@/components/ContaCorrentePage";
import { EstoqueFisicoPage } from "@/components/EstoqueFisicoPage";
import { EstoqueFiscalPage } from "@/components/EstoqueFiscalPage";
import { CalculadoraMTRPage } from "@/components/CalculadoraMTRPage";
import { RelatoriosPage } from "@/components/RelatoriosPage";
import { AuditoriaPage } from "@/components/AuditoriaPage";
import { ConfiguracoesPage } from "@/components/ConfiguracoesPage";
import { CentralEmissaoPage } from "@/components/CentralEmissaoPage";
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
        <Route path="/balanca" element={<BalancaPage />} />
        <Route path="/estoque-fisico" element={<EstoqueFisicoPage />} />
        <Route path="/estoque-fiscal" element={<EstoqueFiscalPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/conta-corrente" element={<ContaCorrentePage />} />
        <Route path="/mtr" element={<CalculadoraMTRPage />} />
        <Route path="/central-emissao" element={<CentralEmissaoPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
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
