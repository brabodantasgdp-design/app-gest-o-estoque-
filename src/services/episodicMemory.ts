// ============================================================
// EBD AI - EPISODIC MEMORY & USER PREFERENCES
// Semantic memory for learning user behavior
// ============================================================

interface Preference {
  key: string;
  value: any;
  updatedAt: number;
}

interface Episode {
  id: string;
  timestamp: number;
  type: 'command' | 'interaction' | 'error' | 'learning' | 'insight';
  input: string;
  output: string;
  toolsUsed: string[];
  success: boolean;
  context: Record<string, any>;
}

interface UserBehavior {
  frequentCommands: Array<{ command: string; count: number; lastUsed: number }>;
  preferredProducts: string[];
  preferredSuppliers: string[];
  averageOrderValue: number;
  peakHours: number[];
  commonPatterns: string[];
}

class EpisodicMemory {
  private static instance: EpisodicMemory;
  private preferences: Map<string, Preference> = new Map();
  private episodes: Episode[] = [];
  private behavior: UserBehavior;
  private prefKey = 'ebdAi_preferences';
  private episodeKey = 'ebdAi_episodes';
  private behaviorKey = 'ebdAi_behavior';

  private constructor() {
    this.loadPreferences();
    this.loadEpisodes();
    this.behavior = this.loadBehavior();
  }

  static getInstance(): EpisodicMemory {
    if (!EpisodicMemory.instance) {
      EpisodicMemory.instance = new EpisodicMemory();
    }
    return EpisodicMemory.instance;
  }

  // ============================================================
  // PREFERENCES MANAGEMENT
  // ============================================================

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this.prefKey);
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([key, value]) => {
          this.preferences.set(key, value as Preference);
        });
      }
    } catch {}
  }

  private savePreferences(): void {
    try {
      const obj = Object.fromEntries(this.preferences);
      localStorage.setItem(this.prefKey, JSON.stringify(obj));
    } catch {}
  }

  setPreference(key: string, value: any): void {
    this.preferences.set(key, {
      key,
      value,
      updatedAt: Date.now(),
    });
    this.savePreferences();
  }

  getPreference<T>(key: string, defaultValue: T): T {
    const pref = this.preferences.get(key);
    return pref ? pref.value as T : defaultValue;
  }

  getAllPreferences(): Record<string, any> {
    const result: Record<string, any> = {};
    this.preferences.forEach((pref, key) => {
      result[key] = pref.value;
    });
    return result;
  }

  // ============================================================
  // EPISODIC MEMORY
  // ============================================================

  private loadEpisodes(): void {
    try {
      const stored = localStorage.getItem(this.episodeKey);
      this.episodes = stored ? JSON.parse(stored) : [];
    } catch {
      this.episodes = [];
    }
  }

  private saveEpisodes(): void {
    try {
      const trimmed = this.episodes.slice(-200);
      localStorage.setItem(this.episodeKey, JSON.stringify(trimmed));
    } catch {}
  }

  recordEpisode(episode: Omit<Episode, 'id' | 'timestamp'>): void {
    this.episodes.push({
      id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...episode,
    });
    this.saveEpisodes();
    this.updateBehavior(episode);
  }

  getEpisodes(count = 20): Episode[] {
    return this.episodes.slice(-count).reverse();
  }

  searchEpisodes(query: string, count = 10): Episode[] {
    const lower = query.toLowerCase();
    return this.episodes
      .filter(e => 
        e.input.toLowerCase().includes(lower) || 
        e.output.toLowerCase().includes(lower)
      )
      .slice(-count)
      .reverse();
  }

  // ============================================================
  // BEHAVIOR ANALYSIS
  // ============================================================

  private loadBehavior(): UserBehavior {
    try {
      const stored = localStorage.getItem(this.behaviorKey);
      return stored ? JSON.parse(stored) : {
        frequentCommands: [],
        preferredProducts: [],
        preferredSuppliers: [],
        averageOrderValue: 0,
        peakHours: [],
        commonPatterns: [],
      };
    } catch {
      return {
        frequentCommands: [],
        preferredProducts: [],
        preferredSuppliers: [],
        averageOrderValue: 0,
        peakHours: [],
        commonPatterns: [],
      };
    }
  }

  private saveBehavior(): void {
    try {
      localStorage.setItem(this.behaviorKey, JSON.stringify(this.behavior));
    } catch {}
  }

  private updateBehavior(episode: Omit<Episode, 'id' | 'timestamp'>): void {
    // Track frequent commands
    if (episode.type === 'command') {
      const existing = this.behavior.frequentCommands.find(c => c.command === episode.input);
      if (existing) {
        existing.count++;
        existing.lastUsed = Date.now();
      } else {
        this.behavior.frequentCommands.push({
          command: episode.input,
          count: 1,
          lastUsed: Date.now(),
        });
      }
      this.behavior.frequentCommands.sort((a, b) => b.count - a.count);
      this.behavior.frequentCommands = this.behavior.frequentCommands.slice(0, 20);
    }

    // Track peak hours
    const hour = new Date().getHours();
    if (!this.behavior.peakHours.includes(hour)) {
      this.behavior.peakHours.push(hour);
    }

    // Track patterns from tools used
    if (episode.toolsUsed.length > 0) {
      const pattern = episode.toolsUsed.join(' → ');
      if (!this.behavior.commonPatterns.includes(pattern)) {
        this.behavior.commonPatterns.push(pattern);
        this.behavior.commonPatterns = this.behavior.commonPatterns.slice(-10);
      }
    }

    this.saveBehavior();
  }

  getBehavior(): UserBehavior {
    return { ...this.behavior };
  }

  getMostFrequentCommand(): string | null {
    return this.behavior.frequentCommands[0]?.command || null;
  }

  getPeakHour(): number {
    if (this.behavior.peakHours.length === 0) return new Date().getHours();
    return this.behavior.peakHours.sort((a, b) => {
      const countA = this.behavior.peakHours.filter(h => h === a).length;
      const countB = this.behavior.peakHours.filter(h => h === b).length;
      return countB - countA;
    })[0];
  }

  // ============================================================
  // LEARNING & INSIGHTS
  // ============================================================

  recordPreferenceFromInteraction(key: string, value: any): void {
    this.setPreference(key, value);
    this.recordEpisode({
      type: 'learning',
      input: `Preferência atualizada: ${key}`,
      output: `Novo valor: ${JSON.stringify(value)}`,
      toolsUsed: [],
      success: true,
      context: { key, value },
    });
  }

  getInsights(): string[] {
    const insights: string[] = [];
    
    // Most used command
    const topCommand = this.getMostFrequentCommand();
    if (topCommand) {
      insights.push(`Comando mais usado: "${topCommand}"`);
    }

    // Peak hour
    const peak = this.getPeakHour();
    insights.push(`Horário mais ativo: ${peak}h`);

    // Total interactions
    insights.push(`Total de interações: ${this.episodes.length}`);

    // Success rate
    const successes = this.episodes.filter(e => e.success).length;
    const rate = this.episodes.length > 0 ? (successes / this.episodes.length * 100).toFixed(1) : '0';
    insights.push(`Taxa de sucesso: ${rate}%`);

    // Common patterns
    if (this.behavior.commonPatterns.length > 0) {
      insights.push(`Padrão comum: ${this.behavior.commonPatterns[this.behavior.commonPatterns.length - 1]}`);
    }

    return insights;
  }

  // ============================================================
  // CONTEXTUAL SUGGESTIONS
  // ============================================================

  getSuggestions(): string[] {
    const suggestions: string[] = [];
    const hour = new Date().getHours();

    // Time-based suggestions
    if (hour < 12) {
      suggestions.push('Bom dia! Verificar estoque do dia');
    } else if (hour < 18) {
      suggestions.push('Boa tarde! Relatório de vendas');
    } else {
      suggestions.push('Boa noite! Resumo do dia');
    }

    // Behavior-based suggestions
    const topCommand = this.getMostFrequentCommand();
    if (topCommand) {
      suggestions.push(`Comando frequente: "${topCommand}"`);
    }

    // Recent patterns
    const recentEpisodes = this.getEpisodes(5);
    if (recentEpisodes.some(e => e.toolsUsed.includes('getInventoryStatus'))) {
      suggestions.push('Verificar alertas de estoque');
    }

    return suggestions.slice(0, 3);
  }

  // ============================================================
  // CLEAR DATA
  // ============================================================

  clearAll(): void {
    this.preferences.clear();
    this.episodes = [];
    this.behavior = {
      frequentCommands: [],
      preferredProducts: [],
      preferredSuppliers: [],
      averageOrderValue: 0,
      peakHours: [],
      commonPatterns: [],
    };
    localStorage.removeItem(this.prefKey);
    localStorage.removeItem(this.episodeKey);
    localStorage.removeItem(this.behaviorKey);
  }
}

export const episodicMemory = EpisodicMemory.getInstance();
export type { Preference, Episode, UserBehavior };
