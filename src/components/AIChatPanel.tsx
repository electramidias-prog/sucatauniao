import { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Bot, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  variant: 'ana' | 'carlinhos';
  open: boolean;
  onClose: () => void;
}

const CONFIG = {
  ana: {
    name: 'A.N.A.',
    subtitle: 'Assistente de Navegação e Ajuda',
    icon: Bot,
    colorClass: 'text-info',
    bgClass: 'bg-info/10',
    greeting: 'Olá! Sou a A.N.A., sua assistente do sistema. Me pergunte qualquer coisa sobre como usar o ERP! 😊',
  },
  carlinhos: {
    name: 'Carlinhos',
    subtitle: 'Consultor Fiscal e SST',
    icon: HardHat,
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
    greeting: 'E aí! Sou o Carlinhos, seu consultor fiscal e de segurança. Pode mandar sua dúvida sobre MTR, ICMS, NRs ou legislação ambiental! 💪',
  },
};

export function AIChatPanel({ variant, open, onClose }: AIChatPanelProps) {
  const config = CONFIG[variant];
  const Icon = config.icon;
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: config.greeting, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Placeholder response - will integrate with Lovable AI
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: variant === 'ana'
          ? 'Entendi sua dúvida! Para acessar essa função, vá no menu lateral e clique na aba correspondente. Posso te guiar passo a passo se precisar!'
          : 'Boa pergunta! De acordo com a legislação vigente, essa operação precisa seguir as normas do IBAMA/FEAM. Me dê mais detalhes para eu te dar uma resposta precisa.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 1200);
  };

  const handleClear = () => {
    setMessages([{ id: '0', role: 'assistant', content: config.greeting, timestamp: new Date() }]);
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-card border-l shadow-xl z-40 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2.5 border-b', config.bgClass)}>
        <Icon className={cn('h-5 w-5', config.colorClass)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{config.name}</p>
          <p className="text-[10px] text-muted-foreground">{config.subtitle}</p>
        </div>
        <button onClick={handleClear} className="p-1 rounded hover:bg-muted" title="Finalizar Atendimento">
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai animate-pulse">Digitando...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-2 flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={`Pergunte ${variant === 'ana' ? 'à Ana' : 'ao Carlinhos'}...`}
          className="h-8 text-xs"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
