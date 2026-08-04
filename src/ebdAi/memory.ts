// ============================================================
// EBD AI - Memory Module
// Episodic memory, user preferences, behavior analysis
// ============================================================

interface Preference {
  key: string;
  value: any;
  updatedAt: number;
}

interface Episode {
  id: string;
  timestamp: number;
  type: 'command' | 'interaction' | 'error' | 'learning';
  input: string;
  output: string;
  toolsUsed: string[];
  success: boolean;
}

interface UserBehavior {
  frequentCommands: Array<{ command: string; count: number; lastUsed: number }>;
  peakHours: number[];
  commonPatterns: string[];
  totalInteractions: number;
}

export class EbdAiMemory {
  private companyId: string;
  private preferences: Map<string, Preference> = new Map();
  private episodes: Episode[] = [];
  private behavior: UserBehavior;
  private prefKey: string;
  private episodeKey: string;
  private behaviorKey: string;

  constructor(companyId: string) {
    this.companyId = companyId;
    this.prefKey = `ebdAi_prefs_${companyId}`;
    this.episodeKey = `ebdAi_episodes_${companyId}`;
    this.behaviorKey = `ebdAi_behavior_${companyId}`;
    
    this.loadPreferences();
    this.loadEpisodes();
    this.behavior = this.loadBehavior();
  }

  // ============================================================
  // PREFERENCES
  // ============================================================

  setPreference(key: string, value: any): void {
    this.preferences.set(key, { key, value, updatedAt: Date.now() });
    this.savePreferences();
  }

  getPreference<T>(key: string, defaultValue: T): T {
    const pref = this.preferences.get(key);
    return pref ? pref.value as T : defaultValue;
  }

  getAllPreferences(): Record<string, any> {
    const result: Record<string, any> = {};
    this.preferences.forEach((pref, key) => { result[key] = pref.value; });
    return result;
  }

  // ============================================================
  // EPISODES
  // ============================================================

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

  searchEpisodes(query: string): Episode[] {
    const lower = query.toLowerCase();
    return this.episodes
      .filter(e => e.input.toLowerCase().includes(lower) || e.output.toLowerCase().includes(lower))
      .slice(-10)
      .reverse();
  }

  // ============================================================
  // BEHAVIOR
  // ============================================================

  getBehavior(): UserBehavior {
    return { ...this.behavior };
  }

  getInsights(): string[] {
    const insights: string[] = [];

    if (this.behavior.frequentCommands.length > 0) {
      insights.push(`Comando mais usado: "${this.behavior.frequentCommands[0].command}"`);
    }

    if (this.behavior.peakHours.length > 0) {
      const peak = this.behavior.peakHours.sort((a, b) => {
        const countA = this.behavior.peakHours.filter(h => h === a).length;
        const countB = this.behavior.peakHours.filter(h => h === b).length;
        return countB - countA;
      })[0];
      insights.push(`Horário mais ativo: ${peak}h`);
    }

    insights.push(`Total de interações: ${this.behavior.totalInteractions}`);

    const recent = this.episodes.slice(-20);
    const successRate = recent.length > 0 
      ? (recent.filter(e => e.success).length / recent.length * 100).toFixed(1)
      : '0';
    insights.push(`Taxa de sucesso: ${successRate}%`);

    return insights;
  }

  getSuggestions(): string[] {
    const suggestions: string[] = [];
    const hour = new Date().getHours();

    if (hour < 12) suggestions.push('Bom dia! Verificar estoque');
    else if (hour < 18) suggestions.push('Boa tarde! Relatório de vendas');
    else suggestions.push('Boa noite! Resumo do dia');

    if (this.behavior.frequentCommands.length > 0) {
      suggestions.push(`Comando frequente: "${this.behavior.frequentCommands[0].command}"`);
    }

    return suggestions.slice(0, 3);
  }

  // ============================================================
  // PRIVATE
  // ============================================================

  private updateBehavior(episode: Omit<Episode, 'id' | 'timestamp'>): void {
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

    const hour = new Date().getHours();
    if (!this.behavior.peakHours.includes(hour)) {
      this.behavior.peakHours.push(hour);
    }

    this.behavior.totalInteractions++;
    this.saveBehavior();
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this.prefKey);
      if (stored) {
        Object.entries(JSON.parse(stored)).forEach(([key, value]) => {
          this.preferences.set(key, value as Preference);
        });
      }
    } catch {}
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(this.prefKey, JSON.stringify(Object.fromEntries(this.preferences)));
    } catch {}
  }

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
      localStorage.setItem(this.episodeKey, JSON.stringify(this.episodes.slice(-200)));
    } catch {}
  }

  private loadBehavior(): UserBehavior {
    try {
      const stored = localStorage.getItem(this.behaviorKey);
      return stored ? JSON.parse(stored) : {
        frequentCommands: [],
        peakHours: [],
        commonPatterns: [],
        totalInteractions: 0,
      };
    } catch {
      return {
        frequentCommands: [],
        peakHours: [],
        commonPatterns: [],
        totalInteractions: 0,
      };
    }
  }

  private saveBehavior(): void {
    try {
      localStorage.setItem(this.behaviorKey, JSON.stringify(this.behavior));
    } catch {}
  }

  clearAll(): void {
    this.preferences.clear();
    this.episodes = [];
    this.behavior = { frequentCommands: [], peakHours: [], commonPatterns: [], totalInteractions: 0 };
    localStorage.removeItem(this.prefKey);
    localStorage.removeItem(this.episodeKey);
    localStorage.removeItem(this.behaviorKey);
  }
}
