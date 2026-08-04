// ============================================================
// EBD AI - Predictive Analytics Engine
// Stock prediction, demand forecasting, trend analysis
// ============================================================

export interface Prediction {
  itemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  unit: string;
  dailyUsage: number;
  weeklyUsage: number;
  daysUntilEmpty: number;
  daysUntilMin: number;
  reorderDate: Date;
  reorderQuantity: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface DemandForecast {
  period: string;
  predicted: number;
  confidence: number;
  lower: number;
  upper: number;
}

export interface StockOptimization {
  itemId: string;
  itemName: string;
  currentOrderQty: number;
  optimalOrderQty: number;
  potentialSavings: number;
  recommendation: string;
}

export class EbdAiPredictions {
  
  async predict(insumos: any[], usageHistory?: any[]): Promise<Prediction[]> {
    const predictions: Prediction[] = [];

    for (const insumo of insumos) {
      const usage = this.calculateUsage(insumo, usageHistory);
      const trend = this.analyzeTrend(insumo, usageHistory);

      const dailyUsage = usage.daily;
      const daysUntilEmpty = dailyUsage > 0 ? Math.floor(insumo.currentStock / dailyUsage) : 999;
      const daysUntilMin = dailyUsage > 0 ? Math.floor((insumo.currentStock - insumo.minStock) / dailyUsage) : 999;

      const reorderDate = new Date();
      reorderDate.setDate(reorderDate.getDate() + Math.max(0, daysUntilMin - 7)); // Reorder 7 days before min

      const reorderQuantity = this.calculateOptimalOrder(insumo, dailyUsage, trend);

      predictions.push({
        itemId: insumo.id,
        itemName: insumo.name,
        currentStock: insumo.currentStock,
        minStock: insumo.minStock,
        unit: insumo.unit,
        dailyUsage: usage.daily,
        weeklyUsage: usage.weekly,
        daysUntilEmpty,
        daysUntilMin,
        reorderDate,
        reorderQuantity,
        confidence: this.calculateConfidence(usageHistory, insumo),
        trend,
      });
    }

    return predictions.sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty);
  }

  async forecast(products: any[], period: number = 30): Promise<DemandForecast[]> {
    const forecasts: DemandForecast[] = [];
    const now = new Date();

    for (let i = 0; i < period; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);

      // Simple moving average prediction
      const dayOfWeek = date.getDay();
      const baseDemand = this.getBaseDemand(dayOfWeek);
      const seasonal = this.getSeasonalFactor(date);
      const predicted = baseDemand * seasonal;

      const confidence = Math.max(0.5, 0.9 - (i * 0.01)); // Confidence decreases over time
      const variance = predicted * (1 - confidence) * 0.5;

      forecasts.push({
        period: date.toISOString().split('T')[0],
        predicted: Math.round(predicted),
        confidence,
        lower: Math.round(predicted - variance),
        upper: Math.round(predicted + variance),
      });
    }

    return forecasts;
  }

  async optimize(insumos: any[], orders: any[]): Promise<StockOptimization[]> {
    const optimizations: StockOptimization[] = [];

    for (const insumo of insumos) {
      const orderHistory = orders.filter(o => 
        o.items?.some((item: any) => item.insumoId === insumo.id)
      );

      const avgOrderQty = this.calculateAvgOrderQty(orderHistory, insumo.id);
      const optimalQty = this.calculateEOQ(insumo, avgOrderQty);
      const potentialSavings = (avgOrderQty - optimalQty) * insumo.unitCost;

      let recommendation = '';
      if (optimalQty < avgOrderQty * 0.8) {
        recommendation = 'Reduza o pedido para economizar';
      } else if (optimalQty > avgOrderQty * 1.2) {
        recommendation = 'Aumente o pedido para evitar ruptura';
      } else {
        recommendation = 'Quantidade atual está adequada';
      }

      optimizations.push({
        itemId: insumo.id,
        itemName: insumo.name,
        currentOrderQty: avgOrderQty,
        optimalOrderQty: Math.round(optimalQty),
        potentialSavings,
        recommendation,
      });
    }

    return optimizations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private calculateUsage(insumo: any, usageHistory?: any[]): { daily: number; weekly: number } {
    if (usageHistory && usageHistory.length > 0) {
      const recentUsage = usageHistory
        .filter(u => u.insumoId === insumo.id)
        .slice(-30); // Last 30 records

      if (recentUsage.length > 0) {
        const totalUsed = recentUsage.reduce((sum, u) => sum + (u.quantity || 0), 0);
        const days = recentUsage.length;
        return {
          daily: totalUsed / days,
          weekly: (totalUsed / days) * 7,
        };
      }
    }

    // Estimate from stock levels
    const estimatedDaily = insumo.currentStock * 0.05; // Assume 5% daily usage
    return {
      daily: estimatedDaily,
      weekly: estimatedDaily * 7,
    };
  }

  private analyzeTrend(insumo: any, usageHistory?: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (!usageHistory || usageHistory.length < 7) return 'stable';

    const recent = usageHistory
      .filter(u => u.insumoId === insumo.id)
      .slice(-7);
    
    const older = usageHistory
      .filter(u => u.insumoId === insumo.id)
      .slice(-14, -7);

    if (recent.length < 3 || older.length < 3) return 'stable';

    const recentAvg = recent.reduce((s, u) => s + (u.quantity || 0), 0) / recent.length;
    const olderAvg = older.reduce((s, u) => s + (u.quantity || 0), 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateOptimalOrder(insumo: any, dailyUsage: number, trend: string): number {
    const leadTime = 7; // Days to receive order
    const safetyStock = insumo.minStock * 0.2;
    const demandDuringLead = dailyUsage * leadTime;

    let multiplier = 1;
    if (trend === 'increasing') multiplier = 1.3;
    if (trend === 'decreasing') multiplier = 0.7;

    return Math.ceil((demandDuringLead + safetyStock) * multiplier);
  }

  private calculateConfidence(usageHistory?: any[], insumo?: any): number {
    if (!usageHistory) return 0.5;
    
    const records = usageHistory.filter(u => u.insumoId === insumo?.id);
    if (records.length < 5) return 0.5;
    if (records.length < 10) return 0.7;
    if (records.length < 30) return 0.85;
    return 0.95;
  }

  private getBaseDemand(dayOfWeek: number): number {
    // Higher demand on weekends
    const demands = [0.8, 1.0, 1.0, 1.1, 1.2, 1.5, 1.3]; // Sun-Sat
    return demands[dayOfWeek] || 1.0;
  }

  private getSeasonalFactor(date: Date): number {
    const month = date.getMonth();
    // Simple seasonal pattern
    const factors = [0.9, 0.85, 0.95, 1.0, 1.1, 1.2, 1.25, 1.2, 1.1, 1.0, 0.95, 1.0];
    return factors[month] || 1.0;
  }

  private calculateAvgOrderQty(orders: any[], insumoId: string): number {
    const quantities = orders
      .flatMap(o => o.items || [])
      .filter(item => item.insumoId === insumoId)
      .map(item => item.quantity || 0);

    if (quantities.length === 0) return 10; // Default
    return quantities.reduce((a, b) => a + b, 0) / quantities.length;
  }

  private calculateEOQ(insumo: any, avgDemand: number): number {
    // Economic Order Quantity (simplified)
    const orderingCost = 50; // Cost per order
    const holdingCost = insumo.unitCost * 0.2; // 20% of unit cost
    const annualDemand = avgDemand * 365;

    if (holdingCost === 0) return avgDemand;

    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
    return Math.max(1, Math.round(eoq));
  }
}
