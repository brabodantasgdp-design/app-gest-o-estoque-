import { Insumo, Product, Order, FichaTecnica, InvoiceScan, Tenant } from '../types';

// ============================================================
// JARVIS CORE ENGINE - Persistent Memory + Context
// ============================================================

interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'command' | 'error' | 'success' | 'conversation' | 'learning';
  input: string;
  output: string;
  context?: Record<string, any>;
}

interface ConversationContext {
  sessionId: string;
  turns: Array<{ role: 'user' | 'jarvis'; content: string; timestamp: number }>;
  topic: string | null;
  entities: Map<string, string>;
  preferences: Record<string, any>;
  lastAction: string | null;
  lastModule: string | null;
}

interface UserProfile {
  name: string;
  role: string;
  preferredLanguage: string;
  commonCommands: string[];
  favoriteProducts: string[];
  frequentActions: Array<{ action: string; count: number }>;
}

interface SystemState {
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
  fichas: FichaTecnica[];
  invoices: InvoiceScan[];
  tenant?: Tenant;
}

// Singleton class
class JarvisCore {
  private static instance: JarvisCore;
  private memory: MemoryEntry[] = [];
  private context: ConversationContext;
  private profile: UserProfile;
  private storageKey = 'jarvis_memory';
  private profileKey = 'jarvis_profile';
  private contextKey = 'jarvis_context';

  private constructor() {
    this.context = this.loadContext();
    this.profile = this.loadProfile();
    this.memory = this.loadMemory();
  }

  static getInstance(): JarvisCore {
    if (!JarvisCore.instance) {
      JarvisCore.instance = new JarvisCore();
    }
    return JarvisCore.instance;
  }

  // ============================================================
  // MEMORY SYSTEM
  // ============================================================

  private loadMemory(): MemoryEntry[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveMemory(): void {
    try {
      // Keep last 500 entries
      const trimmed = this.memory.slice(-500);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save memory:', e);
    }
  }

  remember(input: string, output: string, type: MemoryEntry['type'] = 'command', context?: Record<string, any>): void {
    this.memory.push({
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      input,
      output,
      context,
    });
    this.saveMemory();
  }

  recall(query: string, limit = 5): MemoryEntry[] {
    const lower = query.toLowerCase();
    return this.memory
      .filter(m => m.input.toLowerCase().includes(lower) || m.output.toLowerCase().includes(lower))
      .slice(-limit)
      .reverse();
  }

  getRecentMemory(count = 10): MemoryEntry[] {
    return this.memory.slice(-count).reverse();
  }

  // ============================================================
  // CONTEXT SYSTEM
  // ============================================================

  private loadContext(): ConversationContext {
    try {
      const stored = localStorage.getItem(this.contextKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.entities = new Map(Object.entries(parsed.entities || {}));
        // Reset if older than 1 hour
        if (Date.now() - (parsed.lastActivity || 0) > 3600000) {
          return this.newContext();
        }
        return parsed;
      }
    } catch {}
    return this.newContext();
  }

  private newContext(): ConversationContext {
    return {
      sessionId: `session_${Date.now()}`,
      turns: [],
      topic: null,
      entities: new Map(),
      preferences: {},
      lastAction: null,
      lastModule: null,
    };
  }

  private saveContext(): void {
    try {
      const toSave = {
        ...this.context,
        entities: Object.fromEntries(this.context.entities),
        lastActivity: Date.now(),
      };
      localStorage.setItem(this.contextKey, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save context:', e);
    }
  }

  addTurn(role: 'user' | 'jarvis', content: string): void {
    this.context.turns.push({ role, content, timestamp: Date.now() });
    // Keep last 20 turns
    if (this.context.turns.length > 20) {
      this.context.turns = this.context.turns.slice(-20);
    }
    this.saveContext();
  }

  setTopic(topic: string): void {
    this.context.topic = topic;
    this.saveContext();
  }

  setEntity(key: string, value: string): void {
    this.context.entities.set(key, value);
    this.saveContext();
  }

  getEntity(key: string): string | undefined {
    return this.context.entities.get(key);
  }

  setLastAction(action: string): void {
    this.context.lastAction = action;
    this.saveContext();
  }

  setLastModule(module: string): void {
    this.context.lastModule = module;
    this.saveContext();
  }

  getLastModule(): string | null {
    return this.context.lastModule;
  }

  getTopic(): string | null {
    return this.context.topic;
  }

  getRecentTurns(count = 5): Array<{ role: string; content: string }> {
    return this.context.turns.slice(-count);
  }

  resetContext(): void {
    this.context = this.newContext();
    this.saveContext();
  }

  // ============================================================
  // PROFILE SYSTEM
  // ============================================================

  private loadProfile(): UserProfile {
    try {
      const stored = localStorage.getItem(this.profileKey);
      return stored ? JSON.parse(stored) : {
        name: 'Usuário',
        role: 'admin',
        preferredLanguage: 'pt-BR',
        commonCommands: [],
        favoriteProducts: [],
        frequentActions: [],
      };
    } catch {
      return {
        name: 'Usuário',
        role: 'admin',
        preferredLanguage: 'pt-BR',
        commonCommands: [],
        favoriteProducts: [],
        frequentActions: [],
      };
    }
  }

  private saveProfile(): void {
    try {
      localStorage.setItem(this.profileKey, JSON.stringify(this.profile));
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }

  trackCommand(command: string): void {
    // Track frequent actions
    const existing = this.profile.frequentActions.find(a => a.action === command);
    if (existing) {
      existing.count++;
    } else {
      this.profile.frequentActions.push({ action: command, count: 1 });
    }
    this.profile.frequentActions.sort((a, b) => b.count - a.count);
    this.profile.frequentActions = this.profile.frequentActions.slice(0, 20);
    
    // Track common commands
    if (!this.profile.commonCommands.includes(command)) {
      this.profile.commonCommands.push(command);
      this.profile.commonCommands = this.profile.commonCommands.slice(-10);
    }
    
    this.saveProfile();
  }

  getUserName(): string {
    return this.profile.name;
  }

  setUserName(name: string): void {
    this.profile.name = name;
    this.saveProfile();
  }

  getFrequentActions(): Array<{ action: string; count: number }> {
    return this.profile.frequentActions.slice(0, 5);
  }

  // ============================================================
  // CONTEXT-AWARE RESPONSES
  // ============================================================

  getContextualGreeting(): string {
    const hour = new Date().getHours();
    const name = this.profile.name;
    const recent = this.getRecentMemory(1);
    
    let timeGreeting = '';
    if (hour < 12) timeGreeting = 'Bom dia';
    else if (hour < 18) timeGreeting = 'Boa tarde';
    else timeGreeting = 'Boa noite';
    
    let contextNote = '';
    if (recent.length > 0) {
      const minsSince = Math.floor((Date.now() - recent[0].timestamp) / 60000);
      if (minsSince < 5) {
        contextNote = ' Continuando de onde paramos...';
      } else if (minsSince < 60) {
        contextNote = ` Último comando foi "${recent[0].input.substring(0, 30)}" há ${minsSince} minutos.`;
      }
    }

    return `${timeGreeting}, ${name}!${contextNote} Como posso ajudar?`;
  }

  getContextualHint(): string | null {
    const lastModule = this.getLastModule();
    const topic = this.getTopic();
    
    if (topic) {
      return `Continuando sobre: ${topic}`;
    }
    
    if (lastModule) {
      const hints: Record<string, string> = {
        dashboard: 'Você está no dashboard. Diga "resumo" para ver os números.',
        insumos: 'Você está em insumos. Diga "estoque baixo" para ver alertas.',
        products: 'Você está em produtos. Diga "margem de lucro" para análise.',
        orders: 'Você está em pedidos. Diga "relatório de vendas".',
        fichas: 'Você está em fichas técnicas. Diga "receita de X".',
        invoices: 'Você está em notas fiscais. Diga "scanear nota".',
      };
      return hints[lastModule] || null;
    }
    
    return null;
  }

  // ============================================================
  // SMART PREDICTIONS
  // ============================================================

  predictNextCommand(): string | null {
    const recent = this.getRecentMemory(5);
    if (recent.length < 2) return null;
    
    // Find patterns in recent commands
    const patterns = recent.map(m => m.input.toLowerCase());
    
    // Check for command sequences
    if (patterns.some(p => p.includes('estoque')) && patterns.some(p => p.includes('produto'))) {
      return 'Relação entre estoque e produtos';
    }
    
    if (patterns.some(p => p.includes('criar'))) {
      return 'Talvez queira criar outro item?';
    }
    
    // Suggest based on frequent actions
    const frequent = this.getFrequentActions();
    if (frequent.length > 0) {
      return `Comando frequente: "${frequent[0].action}"`;
    }
    
    return null;
  }

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  private systemState: SystemState = {
    insumos: [],
    products: [],
    orders: [],
    fichas: [],
    invoices: [],
  };

  updateState(state: Partial<SystemState>): void {
    this.systemState = { ...this.systemState, ...state };
  }

  getState(): SystemState {
    return this.systemState;
  }

  // ============================================================
  // INTELLIGENT ANALYSIS
  // ============================================================

  analyzeStockAlerts(): Array<{ item: string; level: 'critical' | 'low' | 'ok'; message: string }> {
    return this.systemState.insumos.map(i => {
      const ratio = i.currentStock / i.minStock;
      let level: 'critical' | 'low' | 'ok';
      let message: string;

      if (ratio <= 0.5) {
        level = 'critical';
        message = `${i.name} está CRÍTICO! Apenas ${i.currentStock}${i.unit} (mínimo: ${i.minStock})`;
      } else if (ratio <= 1) {
        level = 'low';
        message = `${i.name} está baixo: ${i.currentStock}${i.unit} (mínimo: ${i.minStock})`;
      } else {
        level = 'ok';
        message = `${i.name} está OK: ${i.currentStock}${i.unit}`;
      }

      return { item: i.name, level, message };
    });
  }

  calculateFinancialSummary(): {
    totalStockValue: number;
    totalRevenue: number;
    totalProfit: number;
    averageMargin: number;
    topProducts: Array<{ name: string; margin: number }>;
  } {
    const totalStockValue = this.systemState.insumos.reduce(
      (sum, i) => sum + i.unitCost * i.currentStock, 0
    );

    const totalRevenue = this.systemState.orders.reduce(
      (sum, o) => sum + (o.totalAmount || 0), 0
    );

    const productMargins = this.systemState.products.map(p => ({
      name: p.name,
      margin: p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0,
      profit: p.price - p.cost,
    }));

    const totalProfit = productMargins.reduce((sum, p) => sum + p.profit, 0);
    const averageMargin = productMargins.length > 0
      ? productMargins.reduce((sum, p) => sum + p.margin, 0) / productMargins.length
      : 0;

    const topProducts = productMargins
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);

    return { totalStockValue, totalRevenue, totalProfit, averageMargin, topProducts };
  }
}

export const jarvis = JarvisCore.getInstance();
export type { MemoryEntry, ConversationContext, UserProfile, SystemState };
