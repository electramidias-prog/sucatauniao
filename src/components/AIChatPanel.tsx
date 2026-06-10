import { useState, useRef, useEffect } from 'react';
import { X, Send, Trash2, Bot, HardHat, Paperclip, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileUrls?: string[];
  fileNames?: string[];
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
    greeting: 'Olá! Sou a A.N.A., sua assistente do sistema. Envie prints, fotos de materiais ou pergunte qualquer coisa sobre o ERP! 📎😊',
  },
  carlinhos: {
    name: 'Carlinhos',
    subtitle: 'Consultor Fiscal e SST',
    icon: HardHat,
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
    greeting: 'E aí! Sou o Carlinhos, seu consultor fiscal. Envie notas fiscais, PDFs de legislação ou pergunte sobre ICMS, CFOPs e NRs! 📎💪',
  },
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export function AIChatPanel({ variant, open, onClose }: AIChatPanelProps) {
  const config = CONFIG[variant];
  const Icon = config.icon;
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: config.greeting, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Reset when variant changes
  useEffect(() => {
    setMessages([{ id: '0', role: 'assistant', content: CONFIG[variant].greeting, timestamp: new Date() }]);
    setPendingFiles([]);
    setInput('');
  }, [variant]);

  const uploadFiles = async (files: File[]): Promise<{ urls: string[]; names: string[] }> => {
    const urls: string[] = [];
    const names: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${variant}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path);
        urls.push(data.publicUrl);
        names.push(file.name);
      }
    }
    return { urls, names };
  };

  const handleSend = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;

    let fileUrls: string[] = [];
    let fileNames: string[] = [];

    if (pendingFiles.length > 0) {
      setUploading(true);
      const result = await uploadFiles(pendingFiles);
      fileUrls = result.urls;
      fileNames = result.names;
      setUploading(false);
      setPendingFiles([]);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (fileNames.length > 0 ? `Enviou: ${fileNames.join(', ')}` : ''),
      fileUrls,
      fileNames,
      timestamp: new Date(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // Build conversation history for AI
    const historyForAI = newMessages
      .filter((m) => m.id !== '0')
      .map((m) => ({
        role: m.role,
        content: m.content,
        fileUrls: m.fileUrls,
      }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: historyForAI, variant }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Stream failed');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';

      const upsertAssistant = (nextChunk: string) => {
        assistantSoFar += nextChunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.id === 'streaming') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { id: 'streaming', role: 'assistant', content: assistantSoFar, timestamp: new Date() }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Finalize streaming message with proper id
      setMessages((prev) =>
        prev.map((m) => (m.id === 'streaming' ? { ...m, id: Date.now().toString() } : m))
      );
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.', timestamp: new Date() },
      ]);
    }
    setIsTyping(false);
  };

  const handleClear = () => {
    setMessages([{ id: '0', role: 'assistant', content: config.greeting, timestamp: new Date() }]);
    setPendingFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
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
            <div className={cn('max-w-[85%]', msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai')}>
              {/* Show file badges */}
              {msg.fileNames && msg.fileNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {msg.fileNames.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 bg-black/10 rounded px-1.5 py-0.5 text-[10px]">
                      {name.match(/\.(png|jpg|jpeg)$/i) ? <ImageIcon className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                      {name.length > 15 ? name.slice(0, 12) + '...' : name}
                    </span>
                  ))}
                </div>
              )}
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-neutral max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Pensando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="px-2 py-1 border-t flex flex-wrap gap-1">
          {pendingFiles.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 text-[10px]">
              <Paperclip className="h-2.5 w-2.5" />
              {f.name.length > 12 ? f.name.slice(0, 9) + '...' : f.name}
              <button onClick={() => removeFile(i)} className="hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-2 flex gap-1.5 items-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground shrink-0"
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={`Pergunte ${variant === 'ana' ? 'à Ana' : 'ao Carlinhos'}...`}
          className="h-8 text-xs"
          disabled={uploading}
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={(!input.trim() && pendingFiles.length === 0) || uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
