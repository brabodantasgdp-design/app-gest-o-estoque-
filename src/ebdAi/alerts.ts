// ============================================================
// EBD AI - Alerts & Scheduling System
// Real-time alerts, schedules, and notifications
// ============================================================

export interface Alert {
  id: string;
  type: 'stock_low' | 'stock_critical' | 'custom' | 'schedule';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  read: boolean;
  data?: any;
}

export interface Schedule {
  id: string;
  name: string;
  type: 'stock_check' | 'report' | 'custom';
  condition: string;
  action: string;
  params: Record<string, any>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export class EbdAiAlerts {
  private companyId: string;
  private alerts: Alert[] = [];
  private schedules: Schedule[] = [];
  private storageKey: string;

  constructor(companyId: string) {
    this.companyId = companyId;
    this.storageKey = `ebdAi_alerts_${companyId}`;
    this.load();
  }

  // ============================================================
  // ALERTS
  // ============================================================

  async check(data: { insumos?: any[]; products?: any[] }): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    if (data.insumos) {
      for (const insumo of data.insumos) {
        // Critical stock
        if (insumo.currentStock <= insumo.minStock * 0.5) {
          const existing = this.alerts.find(
            a => a.type === 'stock_critical' && a.data?.itemId === insumo.id && !a.read
          );
          if (!existing) {
            newAlerts.push(this.createAlert({
              type: 'stock_critical',
              title: `⚠️ Estoque Crítico: ${insumo.name}`,
              message: `${insumo.name} está com apenas ${insumo.currentStock}${insumo.unit} (mínimo: ${insumo.minStock})`,
              severity: 'critical',
              data: { itemId: insumo.id, itemName: insumo.name },
            }));
          }
        }
        // Low stock
        else if (insumo.currentStock <= insumo.minStock) {
          const existing = this.alerts.find(
            a => a.type === 'stock_low' && a.data?.itemId === insumo.id && !a.read
          );
          if (!existing) {
            newAlerts.push(this.createAlert({
              type: 'stock_low',
              title: `📦 Estoque Baixo: ${insumo.name}`,
              message: `${insumo.name} está com ${insumo.currentStock}${insumo.unit} (mínimo: ${insumo.minStock})`,
              severity: 'warning',
              data: { itemId: insumo.id, itemName: insumo.name },
            }));
          }
        }
      }
    }

    // Check schedules
    const dueSchedules = this.schedules.filter(s => 
      s.enabled && s.nextRun && s.nextRun <= Date.now()
    );

    for (const schedule of dueSchedules) {
      newAlerts.push(this.createAlert({
        type: 'schedule',
        title: `⏰ ${schedule.name}`,
        message: `Agendamento executado: ${schedule.condition}`,
        severity: 'info',
        data: { scheduleId: schedule.id },
      }));

      schedule.lastRun = Date.now();
      schedule.nextRun = this.calculateNextRun(schedule);
    }

    this.alerts = [...newAlerts, ...this.alerts].slice(0, 100);
    this.save();

    return newAlerts;
  }

  private createAlert(params: Omit<Alert, 'id' | 'timestamp' | 'read'>): Alert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      read: false,
      ...params,
    };
  }

  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  getUnreadCount(): number {
    return this.alerts.filter(a => !a.read).length;
  }

  markRead(id: string): void {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.read = true;
      this.save();
    }
  }

  markAllRead(): void {
    this.alerts.forEach(a => a.read = true);
    this.save();
  }

  clear(): void {
    this.alerts = [];
    this.save();
  }

  // ============================================================
  // SCHEDULES
  // ============================================================

  async addSchedule(schedule: Omit<Schedule, 'id' | 'nextRun'>): Promise<Schedule> {
    const newSchedule: Schedule = {
      id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nextRun: this.calculateNextRun(schedule as Schedule),
      ...schedule,
    };

    this.schedules.push(newSchedule);
    this.save();
    return newSchedule;
  }

  removeSchedule(id: string): void {
    this.schedules = this.schedules.filter(s => s.id !== id);
    this.save();
  }

  getSchedules(): Schedule[] {
    return [...this.schedules];
  }

  private calculateNextRun(schedule: Schedule): number {
    // Simple interval-based scheduling
    const intervals: Record<string, number> = {
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000,
    };

    const interval = intervals[schedule.condition] || intervals['daily'];
    return Date.now() + interval;
  }

  // ============================================================
  // NOTIFICATIONS (Browser API)
  // ============================================================

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async sendNotification(title: string, body: string, icon?: string): Promise<void> {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
      });
    }
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  private load(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.alerts = data.alerts || [];
        this.schedules = data.schedules || [];
      }
    } catch {}
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        alerts: this.alerts.slice(0, 50),
        schedules: this.schedules,
      }));
    } catch {}
  }
}
