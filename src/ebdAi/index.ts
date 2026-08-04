/**
 * EBD AI - Universal AI Assistant Module
 * 
 * Drop-in module for any React/TypeScript app.
 * Provides: Chat, Voice, Alerts, Predictions, Workflows, Export
 * 
 * Usage:
 *   import { EbdAi } from './ebdAi';
 *   const ai = new EbdAi({ apiKey: 'xxx', companyId: 'xxx' });
 *   await ai.chat('Olá');
 */

import { EbdAiCore } from './core';
import { EbdAiVoice } from './voice';
import { EbdAiAlerts, type Alert, type Schedule } from './alerts';
import { EbdAiPredictions, type Prediction } from './predictions';
import { EbdAiWorkflows, type Workflow } from './workflows';
import { EbdAiExport } from './export';
import { EbdAiMemory } from './memory';

export type { Alert, Schedule, Prediction, Workflow };

// ============================================================
// TYPES
// ============================================================

export interface EbdAiConfig {
  apiKey?: string;
  companyId: string;
  apiUrl?: string;
  language?: 'pt-BR' | 'en-US' | 'es-ES';
  personality?: 'professional' | 'casual' | 'technical';
  autoSpeak?: boolean;
  enableAlerts?: boolean;
  enablePredictions?: boolean;
  enableWorkflows?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  reasoning?: string;
  functionCalls?: FunctionCall[];
  source: 'gemini' | 'local';
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
  result?: any;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  data: any[];
  filename: string;
  columns?: string[];
}

// ============================================================
// MAIN CLASS
// ============================================================

export class EbdAi {
  private config: EbdAiConfig;
  private core: EbdAiCore;
  private voice: EbdAiVoice;
  private alerts: EbdAiAlerts;
  private predictions: EbdAiPredictions;
  private workflows: EbdAiWorkflows;
  private export: EbdAiExport;
  private memory: EbdAiMemory;
  private conversationHistory: ChatMessage[] = [];

  constructor(config: EbdAiConfig) {
    this.config = {
      apiUrl: '/api/ebdAi',
      language: 'pt-BR',
      personality: 'professional',
      autoSpeak: false,
      enableAlerts: true,
      enablePredictions: true,
      enableWorkflows: true,
      ...config,
    };

    this.core = new EbdAiCore(this.config);
    this.voice = new EbdAiVoice(this.config);
    this.alerts = new EbdAiAlerts(this.config.companyId);
    this.predictions = new EbdAiPredictions();
    this.workflows = new EbdAiWorkflows(this.config.companyId);
    this.export = new EbdAiExport();
    this.memory = new EbdAiMemory(this.config.companyId);

    this.loadHistory();
  }

  // ============================================================
  // CHAT
  // ============================================================

  async chat(message: string): Promise<ChatResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    const response = await this.core.chat(message, this.conversationHistory);

    this.conversationHistory.push({
      role: 'assistant',
      content: response.response,
      timestamp: Date.now(),
    });

    this.saveHistory();

    // Execute function calls
    if (response.functionCalls) {
      for (const fc of response.functionCalls) {
        await this.executeFunction(fc.name, fc.args);
      }
    }

    // Auto-speak if enabled
    if (this.config.autoSpeak) {
      await this.voice.speak(response.response);
    }

    return response;
  }

  // ============================================================
  // VOICE
  // ============================================================

  async startListening(): Promise<void> {
    return this.voice.startListening();
  }

  async stopListening(): Promise<void> {
    return this.voice.stopListening();
  }

  async speak(text: string): Promise<void> {
    return this.voice.speak(text);
  }

  onVoiceResult(callback: (text: string) => void): void {
    this.voice.onResult(callback);
  }

  isListening(): boolean {
    return this.voice.isListening();
  }

  // ============================================================
  // ALERTS
  // ============================================================

  async checkAlerts(data: { insumos?: any[]; products?: any[] }): Promise<Alert[]> {
    if (!this.config.enableAlerts) return [];
    
    const alerts = await this.alerts.check(data);
    
    // Trigger workflows for alerts
    for (const alert of alerts) {
      await this.workflows.trigger('alert', alert);
    }
    
    return alerts;
  }

  getAlerts(): Alert[] {
    return this.alerts.getAlerts();
  }

  markAlertRead(id: string): void {
    this.alerts.markRead(id);
  }

  clearAlerts(): void {
    this.alerts.clear();
  }

  // ============================================================
  // SCHEDULES
  // ============================================================

  async addSchedule(schedule: Omit<Schedule, 'id' | 'nextRun'>): Promise<Schedule> {
    return this.alerts.addSchedule(schedule);
  }

  removeSchedule(id: string): void {
    this.alerts.removeSchedule(id);
  }

  getSchedules(): Schedule[] {
    return this.alerts.getSchedules();
  }

  // ============================================================
  // PREDICTIONS
  // ============================================================

  async predictStock(insumos: any[], usageHistory?: any[]): Promise<Prediction[]> {
    if (!this.config.enablePredictions) return [];
    return this.predictions.predict(insumos, usageHistory);
  }

  async forecastDemand(products: any[], period: number = 30): Promise<any[]> {
    return this.predictions.forecast(products, period);
  }

  // ============================================================
  // WORKFLOWS
  // ============================================================

  async addWorkflow(workflow: Omit<Workflow, 'id' | 'executionCount'>): Promise<Workflow> {
    return this.workflows.add(workflow);
  }

  removeWorkflow(id: string): void {
    this.workflows.remove(id);
  }

  getWorkflows(): Workflow[] {
    return this.workflows.getAll();
  }

  async triggerWorkflow(trigger: string, data: any): Promise<void> {
    return this.workflows.trigger(trigger, data);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  exportCSV(data: any[], filename: string): void {
    this.export.toCSV(data, filename);
  }

  exportJSON(data: any[], filename: string): void {
    this.export.toJSON(data, filename);
  }

  // ============================================================
  // MEMORY
  // ============================================================

  getInsights(): string[] {
    return this.memory.getInsights();
  }

  getSuggestions(): string[] {
    return this.memory.getSuggestions();
  }

  getBehavior(): any {
    return this.memory.getBehavior();
  }

  setPreference(key: string, value: any): void {
    this.memory.setPreference(key, value);
  }

  getPreference<T>(key: string, defaultValue: T): T {
    return this.memory.getPreference(key, defaultValue);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async executeFunction(name: string, args: Record<string, any>): Promise<any> {
    // Override in your app to handle function calls
    console.log(`Executing function: ${name}`, args);
    return null;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(`ebdAi_history_${this.config.companyId}`);
      this.conversationHistory = stored ? JSON.parse(stored) : [];
    } catch {
      this.conversationHistory = [];
    }
  }

  private saveHistory(): void {
    try {
      const trimmed = this.conversationHistory.slice(-50);
      localStorage.setItem(`ebdAi_history_${this.config.companyId}`, JSON.stringify(trimmed));
    } catch {}
  }

  getStatus(): {
    configured: boolean;
    companyId: string;
    historyLength: number;
    alerts: number;
    schedules: number;
    workflows: number;
  } {
    return {
      configured: !!this.config.apiKey,
      companyId: this.config.companyId,
      historyLength: this.conversationHistory.length,
      alerts: this.alerts.getAlerts().length,
      schedules: this.alerts.getSchedules().length,
      workflows: this.workflows.getAll().length,
    };
  }
}

export default EbdAi;
