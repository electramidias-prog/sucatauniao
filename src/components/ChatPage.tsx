import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type UserRole } from '@/hooks/useAuth';
import { Send, Paperclip, X, FileText as FileIcon, Image as ImageIcon, Copy, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type Channel = 'geral' | 'balanca' | 'financeiro' | 'patio';

interface ChannelDef {
  id: Channel;
  label: string;
  roles: UserRole[];
}

const CHANNELS: ChannelDef[] = [
  { id: 'geral', label: 'geral', roles: ['admin', 'financeiro', 'operador_balanca', 'conferente', 'contador'] },
  { id: 'balanca', label: 'balança', roles: ['admin', 'operador_balanca'] },
  { id: 'financeiro', label: 'financeiro', roles: ['admin', 'financeiro'] },
  { id: 'patio', label: 'pátio', roles: ['admin', 'conferente'] },
];

interface ChatMessage {
  id: string;
  channel: Channel;
  user_id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: 'image' | 'document' | null;
  attachment_name: string | null;
  created_at: string;
  author?: { full_name: string; avatar_url?: string | null };
}

interface PresenceUser {
  user_id: string;
  name: string;
  role: string;
  online_at: string;
}

const PAGE_SIZE = 30;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hoje';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Ontem';
  return d.toLocaleDateString('pt-BR');
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function ChatPage() {
  const { user } = useAuth();
  const allowedChannels = useMemo(
    () => CHANNELS.filter((c) => user && c.roles.includes(user.role)),
    [user]
  );
  const [activeChannel, setActiveChannel] = useState<Channel>('geral');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Map<string, { full_name: string; avatar_url?: string | null }>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load profile names for any user_ids we see
  const enrichProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profiles.has(id));
    if (missing.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', missing);
    if (data) {
      setProfiles((prev) => {
        const next = new Map(prev);
        data.forEach((p: any) => next.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }));
        return next;
      });
    }
  };

  // Load messages
  const loadMessages = async (before?: string) => {
    setLoading(true);
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('channel', activeChannel)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao carregar mensagens', description: error.message, variant: 'destructive' });
      return;
    }
    const items = (data || []).reverse() as ChatMessage[];
    setHasMore((data || []).length === PAGE_SIZE);
    if (before) {
      setMessages((prev) => [...items, ...prev]);
    } else {
      setMessages(items);
      stickToBottom.current = true;
    }
    await enrichProfiles(items.map((m) => m.user_id));
  };

  // Mark channel as read
  const markRead = async () => {
    if (!user) return;
    await supabase
      .from('chat_reads')
      .upsert({ user_id: user.id, channel: activeChannel, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,channel' });
  };

  // Switch channel
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    loadMessages();
    markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  // Realtime messages subscription
  useEffect(() => {
    const ch = supabase
      .channel(`chat:${activeChannel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${activeChannel}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          await enrichProfiles([newMsg.user_id]);
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
          markRead();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  // Typing + presence channel
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`chat-typing:${activeChannel}`, {
      config: { broadcast: { self: false } },
    });
    typingChannelRef.current = ch;
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const name = payload?.name as string;
      if (!name) return;
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== name)), 3000);
    });
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [activeChannel, user]);

  // Global online presence
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const flat: PresenceUser[] = [];
      Object.values(state).forEach((arr: any) => arr.forEach((p: any) => flat.push(p)));
      setPresence(flat);
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          user_id: user.id,
          name: user.full_name,
          role: user.role,
          online_at: new Date().toISOString(),
        });
      }
    });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Auto scroll
  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottom.current = atBottom;
    if (el.scrollTop < 60 && hasMore && !loading && messages.length > 0) {
      const prevHeight = el.scrollHeight;
      loadMessages(messages[0].created_at).then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setFilePreview(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 10MB.', variant: 'destructive' });
      return;
    }
    setFile(f);
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const sendMessage = async () => {
    if (!user) return;
    if (!content.trim() && !file) return;
    setUploading(true);
    try {
      let attachment_url: string | null = null;
      let attachment_type: 'image' | 'document' | null = null;
      let attachment_name: string | null = null;
      if (file) {
        const ts = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${activeChannel}/${user.id}/${ts}_${safeName}`;
        const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
        attachment_url = signed?.signedUrl || null;
        attachment_type = file.type.startsWith('image/') ? 'image' : 'document';
        attachment_name = file.name;
      }
      const { error } = await supabase.from('chat_messages').insert({
        channel: activeChannel,
        user_id: user.id,
        content: content.trim() || null,
        attachment_url,
        attachment_type,
        attachment_name,
      });
      if (error) throw error;
      setContent('');
      handleFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      stickToBottom.current = true;
    } catch (e: any) {
      toast({ title: 'Falha ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleTyping = () => {
    if (!typingChannelRef.current || !user) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { name: user.full_name } });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, 1500);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado' });
  };

  // Group messages by day
  const grouped = useMemo(() => {
    const out: Array<{ type: 'sep'; label: string } | { type: 'msg'; msg: ChatMessage }> = [];
    let lastDay = '';
    messages.forEach((m) => {
      const d = dayKey(m.created_at);
      if (d !== lastDay) {
        out.push({ type: 'sep', label: formatDayLabel(m.created_at) });
        lastDay = d;
      }
      out.push({ type: 'msg', msg: m });
    });
    return out;
  }, [messages]);

  const onlineIds = new Set(presence.map((p) => p.user_id));
  const activeChannelLabel = CHANNELS.find((c) => c.id === activeChannel)?.label || activeChannel;

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-0 border border-border bg-card overflow-hidden">
      {/* Sidebar */}
      <aside className="w-1/4 min-w-[220px] border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-bold">Chat da Equipe</h2>
        </div>

        <div className="p-3 border-b border-border">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 tracking-wider">Online agora</p>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {presence.length === 0 && <li className="text-xs text-muted-foreground">Nenhum usuário online</li>}
            {presence.map((p) => (
              <li key={p.user_id} className="flex items-center gap-2 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-2 tracking-wider">Canais</p>
          <ul className="space-y-0.5">
            {allowedChannels.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveChannel(c.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                    activeChannel === c.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:bg-muted'
                  )}
                >
                  <Hash className="h-3.5 w-3.5" />
                  <span>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Messages */}
      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{activeChannelLabel}</h3>
        </header>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2"
        >
          {loading && messages.length === 0 && (
            <p className="text-xs text-center text-muted-foreground">Carregando...</p>
          )}
          {!hasMore && messages.length > 0 && (
            <p className="text-[10px] text-center text-muted-foreground">Início do canal</p>
          )}
          {grouped.map((item, idx) => {
            if (item.type === 'sep') {
              return (
                <div key={`sep-${idx}`} className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {item.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              );
            }
            const m = item.msg;
            const author = profiles.get(m.user_id);
            const name = author?.full_name || 'Usuário';
            const isMine = m.user_id === user.id;
            return (
              <div
                key={m.id}
                className={cn('group flex gap-2', isMine && 'flex-row-reverse')}
              >
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative',
                  isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}>
                  {name.charAt(0).toUpperCase()}
                  {onlineIds.has(m.user_id) && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border border-background" />
                  )}
                </div>
                <div className={cn('flex flex-col max-w-[70%]', isMine && 'items-end')}>
                  <div className="flex items-baseline gap-2 text-[11px]">
                    <span className="font-semibold">{name}</span>
                    <span className="text-muted-foreground">{formatTime(m.created_at)}</span>
                  </div>
                  <div className={cn(
                    'mt-0.5 px-3 py-1.5 rounded-lg text-sm break-words relative',
                    isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    {m.content && <div className="whitespace-pre-wrap">{linkify(m.content)}</div>}
                    {m.attachment_url && m.attachment_type === 'image' && (
                      <img
                        src={m.attachment_url}
                        alt={m.attachment_name || 'imagem'}
                        className="mt-1 max-h-60 rounded cursor-pointer"
                        onClick={() => setLightbox(m.attachment_url!)}
                      />
                    )}
                    {m.attachment_url && m.attachment_type === 'document' && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'mt-1 flex items-center gap-2 px-2 py-1 rounded text-xs underline',
                          isMine ? 'bg-primary-foreground/10' : 'bg-background'
                        )}
                      >
                        <FileIcon className="h-3.5 w-3.5" />
                        {m.attachment_name || 'documento'}
                      </a>
                    )}
                    {m.content && (
                      <button
                        onClick={() => copyText(m.content!)}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-background border border-border shadow"
                        title="Copiar"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-xs text-muted-foreground italic shrink-0">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está digitando' : 'estão digitando'}...
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border p-2 shrink-0">
          {file && (
            <div className="mb-2 flex items-center gap-2 p-2 bg-muted rounded">
              {filePreview ? (
                <img src={filePreview} alt="preview" className="h-12 w-12 object-cover rounded" />
              ) : (
                <FileIcon className="h-8 w-8 text-muted-foreground" />
              )}
              <span className="text-xs flex-1 truncate">{file.name}</span>
              <button onClick={() => handleFile(null)} className="p-1 hover:bg-background rounded">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded hover:bg-muted text-muted-foreground"
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.xlsx,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder={`Mensagem para #${activeChannelLabel}...`}
              className="flex-1 resize-none bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary max-h-32"
            />
            <button
              onClick={sendMessage}
              disabled={uploading || (!content.trim() && !file)}
              className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              title="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="lightbox" className="max-h-full max-w-full object-contain" />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}