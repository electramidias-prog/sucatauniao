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
import { Navigate } from "react-router-dom";

const DashboardPage = React.lazy(() => import('@/components/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PlaceholderPage = React.lazy(() => import('@/components/PlaceholderPage').then(m => ({ default: m.PlaceholderPage })));
const CalculadoraMTRPage = React.lazy(() => import('@/components/CalculadoraMTRPage').then(m => ({ default: m.CalculadoraMTRPage })));
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
const FuncionariosPage = React.lazy(() => import('@/components/FuncionariosPage').then(m => ({ default: m.FuncionariosPage })));
const EPIsPage = React.lazy(() => import('@/components/EPIsPage').then(m => ({ default: m.EPIsPage })));
const DDSPage = React.lazy(() => import('@/components/DDSPage').then(m => ({ default: m.DDSPage })));
const MaquinasPage = React.lazy(() => import('@/components/MaquinasPage').then(m => ({ default: m.MaquinasPage })));
const FaturamentoPage = React.lazy(() => import('@/components/FaturamentoPage').then(m => ({ default: m.FaturamentoPage })));
const ChatPage = React.lazy(() => import('@/components/ChatPage').then(m => ({ default: m.ChatPage })));
const TransferenciasPage = React.lazy(() => import('@/components/TransferenciasPage').then(m => ({ default: m.TransferenciasPage })));
const PortalLogin = React.lazy(() => import('@/components/portal/PortalLogin').then(m => ({ default: m.PortalLogin })));
const PortalDashboard = React.lazy(() => import('@/components/portal/PortalDashboard').then(m => ({ default: m.PortalDashboard })));

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

  const isAdmin = user.role === 'admin';
  const AdminOnly = ({ children }: { children: React.ReactNode }) =>
    isAdmin ? <>{children}</> : <Navigate to="/" replace />;

  return (
    <AppLayout>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/balanca" element={<BalancaPage />} />
          <Route path="/estoque-fisico" element={<EstoqueFisicoPage />} />
          <Route path="/estoque-fiscal" element={<EstoqueFiscalPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/conta-corrente" element={<ContaCorrentePage />} />
          <Route path="/transferencias" element={<TransferenciasPage />} />
          <Route path="/contas-pagar" element={<ContasPagarPage />} />
          <Route path="/faturamento" element={<FaturamentoPage />} />
          <Route path="/documentos" element={<DocumentosPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/funcionarios" element={<FuncionariosPage />} />
          <Route path="/epis" element={<EPIsPage />} />
          <Route path="/maquinas" element={<MaquinasPage />} />
          <Route path="/dds" element={<DDSPage />} />
          <Route path="/central-emissao" element={<CentralEmissaoPage />} />
          <Route path="/calculadora-mtr" element={<CalculadoraMTRPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/usuarios" element={<AdminOnly><UsersPage /></AdminOnly>} />
          <Route path="/auditoria" element={<AdminOnly><AuditoriaPage /></AdminOnly>} />
          <Route path="/configuracoes" element={<AdminOnly><ConfiguracoesPage /></AdminOnly>} />
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
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/portal" element={<PortalLogin />} />
              <Route path="/portal/login" element={<PortalLogin />} />
              <Route path="/portal/dashboard" element={<PortalDashboard />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
