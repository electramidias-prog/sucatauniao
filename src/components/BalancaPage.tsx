import { Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BalancaFornecedoresTab } from './BalancaFornecedoresTab';

const PesagensPagasTab = lazy(() =>
  import('./PesagensPagasTab').then(m => ({ default: m.PesagensPagasTab })),
);
const PesagensInternasTab = lazy(() =>
  import('./PesagensInternasTab').then(m => ({ default: m.PesagensInternasTab })),
);

const Loading = () => (
  <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
);

export function BalancaPage() {
  return (
    <Tabs defaultValue="fornecedores" className="w-full">
      <TabsList className="bg-gray-950 text-white">
        <TabsTrigger value="fornecedores" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
          Fornecedores
        </TabsTrigger>
        <TabsTrigger value="pagas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
          Pagas
        </TabsTrigger>
        <TabsTrigger value="internas" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
          NF-e
        </TabsTrigger>
      </TabsList>

      <TabsContent value="fornecedores" className="mt-4">
        <BalancaFornecedoresTab />
      </TabsContent>
      <TabsContent value="pagas" className="mt-4">
        <Suspense fallback={<Loading />}>
          <PesagensPagasTab />
        </Suspense>
      </TabsContent>
      <TabsContent value="internas" className="mt-4">
        <Suspense fallback={<Loading />}>
          <PesagensInternasTab />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}