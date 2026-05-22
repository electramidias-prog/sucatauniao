import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePortalAuth } from '@/hooks/usePortalAuth'

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { clientName, logout } = usePortalAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    navigate('/portal/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-red-600/40 bg-black">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-black tracking-tight">
              <span className="text-white">SUCATA</span>{' '}
              <span className="text-red-600">UNIÃO</span>
            </div>
            <span className="text-xs text-white/60 hidden sm:inline">Portal do Fornecedor</span>
          </div>
          <div className="flex items-center gap-3">
            {clientName && <span className="text-sm text-white/80 hidden sm:inline">{clientName}</span>}
            <Button size="sm" variant="outline" className="border-red-600/60 text-red-500 hover:bg-red-600 hover:text-white" onClick={onLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}