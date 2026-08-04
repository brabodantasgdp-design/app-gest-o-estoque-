# EBD ElBravoDantas - Gestão de Varejo & IA

Sistema completo de gestão de estoque, vendas e inteligência artificial para varejo.

## Funcionalidades

- 📦 **Gestão de Estoque** - Controle de insumos com alertas de estoque baixo
- 🏷️ **Produtos** - Cadastro e gestão de produtos com fichas técnicas
- 🛒 **Pedidos** - Criação e acompanhamento de pedidos
- 📄 **Notas Fiscais** - OCR inteligente com Gemini AI para leitura de NF-e
- 📊 **Dashboard** - Métricas de vendas, estoque e lucratividade
- 🤖 **EBD AI** - Assistente inteligente com chat, voz e tool calling
- 🎤 **Assistente de Voz** - Comandos por voz para operações rápidas
- 🔐 **Multi-tenant** - Isolamento de dados por loja/tenant
- 👤 **Super Admin** - Painel administrativo global

## Pré-requisitos

- Node.js (v18+)
- npm

## Instalação

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Copie o arquivo de exemplo de ambiente:
   ```bash
   cp .env.example .env.local
   ```
4. Preencha os valores em `.env.local`

## Configuração

### Supabase (obrigatório)
1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL em `supabase-schema.sql` no painel do Supabase
3. Adicione as credenciais no `.env.local`:
   ```
   VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
   VITE_SUPABASE_ANON_KEY="sua-chave-anon"
   ```

### Gemini API (para OCR e IA)
1. Obtenha uma chave em [Google AI Studio](https://aistudio.google.com)
2. Adicione no `.env.local`:
   ```
   GEMINI_API_KEY="sua-chave-gemini"
   ```

## Execução

### Modo desenvolvimento:
```bash
npm run dev
```

### Build de produção:
```bash
npm run build
npm start
```

### Linting:
```bash
npm run lint
```

## Estrutura do Projeto

```
├── server.ts              Servidor Express + API routes
├── src/
│   ├── App.tsx            Componente raiz
│   ├── types.ts           Tipos TypeScript
│   ├── lib/
│   │   ├── database.ts    Serviços CRUD (Supabase + LocalStorage fallback)
│   │   └── supabase.ts    Cliente Supabase
│   ├── ebdAi/             Módulo de inteligência artificial
│   ├── services/          Serviços de Gemini, voz, ferramentas
│   ├── components/        Componentes React (UI)
│   └── hooks/             Custom hooks
├── supabase-schema.sql    Schema do banco de dados
├── .env.example           Template de variáveis de ambiente
└── package.json
```

## Tecnologias

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Supabase (PostgreSQL + Auth + RLS)
- Google Gemini AI (OCR + Chat)
- Express.js
