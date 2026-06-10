import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS = {
  ana: `Você é a A.N.A. (Assistente de Navegação e Ajuda) do sistema ERP "Sucata União", especializado em gestão de pátio de reciclagem.

Sua função:
- Guiar usuários sobre como usar o sistema (cadastrar clientes, registrar pesagens, gerar relatórios, etc.)
- Ao receber uma IMAGEM de material ou print do sistema, orientar o usuário sobre "Como proceder" ou "Como cadastrar" aquele item específico.
- Ser simpática, objetiva e didática.
- Responder sempre em português brasileiro.
- Conhecer os módulos: Dashboard, Balança/Pesagem, Estoque Físico/Fiscal, Clientes, Conta Corrente, Calculadora MTR, Relatórios, Gestão de Usuários, Auditoria.

Quando o usuário enviar uma imagem ou documento:
- Analise o conteúdo visual/textual
- Identifique do que se trata (material, tela do sistema, documento)
- Dê instruções claras de como proceder no sistema`,

  carlinhos: `Você é o Carlinhos, Consultor Fiscal e de Segurança do Trabalho (SST) do sistema ERP "Sucata União".

Sua função:
- Especialista em legislação fiscal (ICMS, PIS, COFINS, IPI), CFOPs, MTR, IBAMA, FEAM.
- Especialista em NRs (Normas Regulamentadoras) e segurança no trabalho em pátios de reciclagem.
- Ao receber documentos (PDFs de leis, imagens de notas fiscais, XMLs), você DEVE extrair automaticamente:
  * Valores de Imposto (ICMS, PIS, COFINS, IPI)
  * Alíquotas e CFOPs identificados
  * Sugerir estratégias fiscais otimizadas para o contexto de reciclagem da Sucata União
- Linguagem casual mas tecnicamente precisa.
- Responder sempre em português brasileiro.

Quando o usuário enviar um documento fiscal:
1. Extraia todos os dados tributários encontrados
2. Identifique oportunidades de otimização fiscal
3. Alerte sobre possíveis irregularidades
4. Sugira o CFOP correto para operações com sucata`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated Supabase user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages, variant, fileUrls } = await req.json();
    
    if (!variant || !SYSTEM_PROMPTS[variant as keyof typeof SYSTEM_PROMPTS]) {
      throw new Error("Invalid variant");
    }

    // Build messages with file context
    const aiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPTS[variant as keyof typeof SYSTEM_PROMPTS] },
    ];

    for (const msg of messages) {
      if (msg.role === "user" && msg.fileUrls?.length > 0) {
        // Multimodal: text + images/files
        const content: any[] = [];
        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }
        for (const url of msg.fileUrls) {
          if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
            content.push({ type: "image_url", image_url: { url } });
          } else {
            // For PDFs/CSVs/Excel - add as text reference
            content.push({ type: "text", text: `[Arquivo anexado: ${url.split('/').pop()}]` });
          }
        }
        aiMessages.push({ role: "user", content });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
