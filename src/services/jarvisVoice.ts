import { ebdAi } from './jarvisCore';

// ============================================================
// EBD AI VOICE SERVICE - Context-Aware TTS + STT
// ============================================================

interface VoiceConfig {
  rate: number;
  pitch: number;
  volume: number;
  voice: string | null;
  enabled: boolean;
}

class EbdAiVoice {
  private static instance: EbdAiVoice;
  private config: VoiceConfig;
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private isSpeaking = false;
  private queue: string[] = [];
  private configKey = 'ebdAi_voice_config';

  private constructor() {
    this.synth = window.speechSynthesis;
    this.config = this.loadConfig();
    this.loadVoices();
    
    // Listen for voice changes
    this.synth.onvoiceschanged = () => this.loadVoices();
  }

  static getInstance(): EbdAiVoice {
    if (!EbdAiVoice.instance) {
      EbdAiVoice.instance = new EbdAiVoice();
    }
    return EbdAiVoice.instance;
  }

  private loadConfig(): VoiceConfig {
    try {
      const stored = localStorage.getItem(this.configKey);
      return stored ? JSON.parse(stored) : {
        rate: 1.1,
        pitch: 0.9,
        volume: 1,
        voice: null,
        enabled: true,
      };
    } catch {
      return { rate: 1.1, pitch: 0.9, volume: 1, voice: null, enabled: true };
    }
  }

  saveConfig(): void {
    localStorage.setItem(this.configKey, JSON.stringify(this.config));
  }

  private loadVoices(): void {
    this.voices = this.synth.getVoices();
    
    // Try to find a good Portuguese voice
    if (!this.config.voice) {
      const ptVoice = this.voices.find(v => v.lang.startsWith('pt') && v.name.includes('Google'));
      const ptBR = this.voices.find(v => v.lang === 'pt-BR');
      const pt = this.voices.find(v => v.lang.startsWith('pt'));
      
      this.config.voice = ptVoice?.name || ptBR?.name || pt?.name || null;
    }
  }

  getVoices(): Array<{ name: string; lang: string; localService: boolean }> {
    return this.voices
      .filter(v => v.lang.startsWith('pt') || v.lang.startsWith('en'))
      .map(v => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
      }));
  }

  setVoice(voiceName: string): void {
    this.config.voice = voiceName;
    this.saveConfig();
  }

  setRate(rate: number): void {
    this.config.rate = Math.max(0.5, Math.min(2, rate));
    this.saveConfig();
  }

  setPitch(pitch: number): void {
    this.config.pitch = Math.max(0, Math.min(2, pitch));
    this.saveConfig();
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ============================================================
  // TEXT-TO-SPEECH
  // ============================================================

  speak(text: string, priority = false): Promise<void> {
    return new Promise((resolve) => {
      if (!this.config.enabled) {
        resolve();
        return;
      }

      // Clean text for better speech
      const cleanText = this.cleanForSpeech(text);

      if (priority) {
        this.synth.cancel();
        this.queue = [];
      }

      this.queue.push(cleanText);
      
      if (!this.isSpeaking) {
        this.processQueue().then(resolve);
      } else {
        // Wait for current to finish
        const checkInterval = setInterval(() => {
          if (!this.isSpeaking) {
            clearInterval(checkInterval);
            this.processQueue().then(resolve);
          }
        }, 100);
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    this.isSpeaking = true;
    const text = this.queue.shift()!;

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply config
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      utterance.volume = this.config.volume;
      
      // Set voice
      if (this.config.voice) {
        const voice = this.voices.find(v => v.name === this.config.voice);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        if (this.queue.length > 0) {
          this.processQueue().then(resolve);
        } else {
          resolve();
        }
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  stop(): void {
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  private cleanForSpeech(text: string): string {
    return text
      .replace(/[✅❌⚠️📊💰📦🏷️🛒📝🔍👤👤🎭💡🎯🚀⚡🧠]/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .replace(/R\$\s*/g, 'R$ ')
      .replace(/(\d+)\s*%/g, '$1 por cento')
      .replace(/(\d+)[.,](\d+)/g, '$1 vírgula $2')
      .trim();
  }

  // ============================================================
  // CONTEXT-AWARE SPEECH
  // ============================================================

  async speakWithContext(text: string, context?: string): Promise<void> {
    // Add context prefix if relevant
    let fullText = text;
    
    if (context) {
      // Don't add context if it would be redundant
      if (!text.toLowerCase().includes(context.toLowerCase().substring(0, 10))) {
        fullText = `${context}. ${text}`;
      }
    }

    await this.speak(fullText);
  }

  async speakError(error: string): Promise<void> {
    const prefixes = [
      'Desculpe, ',
      'Ops, ',
      'Não consegui processar: ',
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    await this.speak(`${prefix}${error}`, true);
  }

  async speakSuccess(action: string, details?: string): Promise<void> {
    const prefixes = [
      'Pronto! ',
      'Feito! ',
      'Concluído! ',
      'Sucesso! ',
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const text = details ? `${prefix}${action}. ${details}` : `${prefix}${action}`;
    await this.speak(text);
  }

  async speakGreeting(): Promise<void> {
    const greeting = ebdAi.getContextualGreeting();
    await this.speak(greeting);
  }

  async speakThinking(): Promise<void> {
    const phrases = [
      'Processando...',
      'Analisando...',
      'Verificando...',
      'Deixe-me ver...',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    await this.speak(phrase, true);
  }
}

export const ebdAiVoice = EbdAiVoice.getInstance();
export type { VoiceConfig };
