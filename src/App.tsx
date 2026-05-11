import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/components/LoginPage";
import { AppLayout } from "@/components/AppLayout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { NavigationProgress } from "@/components/NavigationProgress";
import NotFound from "./pages/NotFound.tsx";

const DashboardPage = React.lazy(() => import('@/components/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PlaceholderPage = React.lazy(() => import('@/components/PlaceholderPage').then(m => ({ default: m.PlaceholderPage })));
const ClientsPage = React.lazy(() => import('@/components/ClientsPage').then(m => ({ default: m.ClientsPage })));
const BalancaPage = React.lazy(() => import('@/components/BalancaPage').then(m => ({ default: m.BalancaPage })));
const UsersPage = React.lazy(() => import('@/components/UsersPage').then(m => ({ default: m.UsersPage })));
const ContaCorrentePage = React.lazy(() => import('@/components/ContaCorrentePage').then(m => ({ default: m.ContaCorrentePage })));
const EstoqueFisicoPage = React.lazy(() => import('@/components/EstoqueFisicoPage').then(m => ({ default: m.EstoqueFisicoPage })));
const EstoqueFiscalPage = React.lazy(() => import('@/components/EstoqueFiscalPage').then(m => ({ default: m.EstoqueFiscalPage })));
const RelatoriosPage = React.lazy(() => import('@/components/RelatoriosPage').then(m => ({ default: m.RelatoriosPage })));
const AuditoriaPage = React.lazy(() => import('@/components/AuditoriaPage').then(m => ({ default: m.AuditoriaPage })));
const ConfiguracoesPage = React.lazy(() => import('@/components/ConfiguracoesPage').then(m => ({ default: m.ConfiguracoesPage })));
const CentralEmissaoPage = React.lazy(() => import('@/components/CentralEmissaoPage').then(m => ({ default: m.CentralEmissaoPage })));
const ContasPagarPage = React.lazy(() => import('@/components/ContasPagarPage').then(m => ({ default: m.ContasPagarPage })));
const DocumentosPage = React.lazy(() => import('@/components/DocumentosPage').then(m => ({ default: m.DocumentosPage })));
const CalendarioPage = React.lazy(() => import('@/components/CalendarioPage').then(m => ({ default: m.CalendarioPage })));

const queryClient = new QueryClient();

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
  </div>
);

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
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<PlaceholderPage title="Chat da Equipe" />} />
          <Route path="/balanca" element={<BalancaPage />} />
          <Route path="/estoque-fisico" element={<EstoqueFisicoPage />} />
          <Route path="/estoque-fiscal" element={<EstoqueFiscalPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/conta-corrente" element={<ContaCorrentePage />} />
          <Route path="/contas-pagar" element={<ContasPagarPage />} />
          <Route path="/documentos" element={<DocumentosPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/funcionarios" element={<PlaceholderPage title="Funcionários e NRs" />} />
          <Route path="/epis" element={<PlaceholderPage title="EPIs" />} />
          <Route path="/maquinas" element={<PlaceholderPage title="Máquinas e Laudos" />} />
          <Route path="/dds" element={<PlaceholderPage title="DDS" />} />
          <Route path="/central-emissao" element={<CentralEmissaoPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
          <ScrollToTop />
          <NavigationProgress />
          <AuthenticatedApp />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
