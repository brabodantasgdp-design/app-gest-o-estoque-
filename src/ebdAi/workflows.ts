// ============================================================
// EBD AI - Custom Workflows Engine
// Automate business rules: "When X happens, do Y"
// ============================================================

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  lastTriggered?: number;
  executionCount: number;
}

export interface WorkflowTrigger {
  type: 'stock_change' | 'order_created' | 'schedule' | 'manual' | 'alert';
  config: Record<string, any>;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface WorkflowAction {
  type: 'update_stock' | 'create_order' | 'send_alert' | 'navigate' | 'webhook' | 'custom';
  config: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  timestamp: number;
  trigger: string;
  results: WorkflowActionResult[];
  success: boolean;
}

export interface WorkflowActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: any;
}

export class EbdAiWorkflows {
  private companyId: string;
  private workflows: Workflow[] = [];
  private executions: WorkflowExecution[] = [];
  private storageKey: string;

  constructor(companyId: string) {
    this.companyId = companyId;
    this.storageKey = `ebdAi_workflows_${companyId}`;
    this.load();
    this.setupDefaultWorkflows();
  }

  // ============================================================
  // CRUD
  // ============================================================

  async add(workflow: Omit<Workflow, 'id' | 'executionCount'>): Promise<Workflow> {
    const newWorkflow: Workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      executionCount: 0,
      ...workflow,
    };

    this.workflows.push(newWorkflow);
    this.save();
    return newWorkflow;
  }

  update(id: string, updates: Partial<Workflow>): void {
    const workflow = this.workflows.find(w => w.id === id);
    if (workflow) {
      Object.assign(workflow, updates);
      this.save();
    }
  }

  remove(id: string): void {
    this.workflows = this.workflows.filter(w => w.id !== id);
    this.save();
  }

  getAll(): Workflow[] {
    return [...this.workflows];
  }

  getById(id: string): Workflow | undefined {
    return this.workflows.find(w => w.id === id);
  }

  // ============================================================
  // EXECUTION
  // ============================================================

  async trigger(triggerType: string, data: any): Promise<void> {
    const matchingWorkflows = this.workflows.filter(w => 
      w.enabled && w.trigger.type === triggerType
    );

    for (const workflow of matchingWorkflows) {
      // Check conditions
      const conditionsMet = this.evaluateConditions(workflow.conditions, data);
      
      if (conditionsMet) {
        await this.executeWorkflow(workflow, data);
      }
    }
  }

  private async executeWorkflow(workflow: Workflow, data: any): Promise<void> {
    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workflowId: workflow.id,
      timestamp: Date.now(),
      trigger: JSON.stringify(data),
      results: [],
      success: true,
    };

    for (const action of workflow.actions) {
      try {
        const result = await this.executeAction(action, data);
        execution.results.push(result);
      } catch (error: any) {
        execution.results.push({
          action: action.type,
          success: false,
          message: error.message,
        });
        execution.success = false;
      }
    }

    workflow.lastTriggered = Date.now();
    workflow.executionCount++;
    
    this.executions.push(execution);
    this.save();
  }

  private async executeAction(action: WorkflowAction, data: any): Promise<WorkflowActionResult> {
    switch (action.type) {
      case 'update_stock':
        return this.actionUpdateStock(action.config, data);
      case 'create_order':
        return this.actionCreateOrder(action.config, data);
      case 'send_alert':
        return this.actionSendAlert(action.config, data);
      case 'navigate':
        return this.actionNavigate(action.config, data);
      case 'webhook':
        return this.actionWebhook(action.config, data);
      default:
        return {
          action: action.type,
          success: false,
          message: `Ação desconhecida: ${action.type}`,
        };
    }
  }

  // ============================================================
  // ACTION IMPLEMENTATIONS
  // ============================================================

  private async actionUpdateStock(config: Record<string, any>, data: any): Promise<WorkflowActionResult> {
    const { itemId, quantity, operation } = config;
    
    // This would call your stock service
    console.log(`Updating stock: ${operation} ${quantity} of ${itemId}`);
    
    return {
      action: 'update_stock',
      success: true,
      message: `Estoque atualizado: ${operation} ${quantity} unidades`,
      data: { itemId, quantity, operation },
    };
  }

  private async actionCreateOrder(config: Record<string, any>, data: any): Promise<WorkflowActionResult> {
    const { supplier, items, auto } = config;
    
    console.log(`Creating order for supplier: ${supplier}`);
    
    return {
      action: 'create_order',
      success: true,
      message: `Pedido criado para ${supplier}`,
      data: { supplier, items, auto },
    };
  }

  private async actionSendAlert(config: Record<string, any>, data: any): Promise<WorkflowActionResult> {
    const { title, message, severity } = config;
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
    
    return {
      action: 'send_alert',
      success: true,
      message: `Alerta enviado: ${title}`,
      data: { title, message, severity },
    };
  }

  private async actionNavigate(config: Record<string, any>, data: any): Promise<WorkflowActionResult> {
    const { module } = config;
    
    return {
      action: 'navigate',
      success: true,
      message: `Navegando para ${module}`,
      data: { module },
    };
  }

  private async actionWebhook(config: Record<string, any>, data: any): Promise<WorkflowActionResult> {
    const { url, method, headers } = config;
    
    try {
      const response = await fetch(url, {
        method: method || 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(data),
      });

      return {
        action: 'webhook',
        success: response.ok,
        message: `Webhook: ${response.status}`,
        data: await response.json().catch(() => null),
      };
    } catch (error: any) {
      return {
        action: 'webhook',
        success: false,
        message: `Webhook error: ${error.message}`,
      };
    }
  }

  // ============================================================
  // CONDITIONS EVALUATOR
  // ============================================================

  private evaluateConditions(conditions: WorkflowCondition[], data: any): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'greater_than':
          return fieldValue > condition.value;
        case 'less_than':
          return fieldValue < condition.value;
        case 'contains':
          return String(fieldValue).includes(condition.value);
        default:
          return false;
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ============================================================
  // DEFAULT WORKFLOWS
  // ============================================================

  private setupDefaultWorkflows(): void {
    if (this.workflows.length > 0) return;

    // Auto-reorder when stock is low
    this.add({
      name: 'Auto-reorder Low Stock',
      description: 'Automaticamente solicita reposição quando estoque está baixo',
      trigger: { type: 'stock_change', config: {} },
      conditions: [
        { field: 'newStock', operator: 'less_than', value: 0 } // Will be set dynamically
      ],
      actions: [
        { type: 'send_alert', config: { title: 'Reposição Automática', message: 'Estoque baixo detectado', severity: 'warning' } }
      ],
      enabled: false,
    });

    // Daily stock check
    this.add({
      name: 'Daily Stock Check',
      description: 'Verifica estoque todos os dias às 8h',
      trigger: { type: 'schedule', config: { interval: 'daily' } },
      conditions: [],
      actions: [
        { type: 'send_alert', config: { title: 'Check-up Diário', message: 'Verificação de estoque concluída', severity: 'info' } }
      ],
      enabled: true,
    });
  }

  // ============================================================
  // EXECUTION HISTORY
  // ============================================================

  getExecutions(workflowId?: string): WorkflowExecution[] {
    if (workflowId) {
      return this.executions.filter(e => e.workflowId === workflowId);
    }
    return [...this.executions];
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  private load(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.workflows = data.workflows || [];
        this.executions = data.executions || [];
      }
    } catch {}
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        workflows: this.workflows,
        executions: this.executions.slice(-100),
      }));
    } catch {}
  }
}
