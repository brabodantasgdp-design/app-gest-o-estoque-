// ============================================================
// EBD AI - Export Module
// Generate CSV, JSON, PDF exports
// ============================================================

export class EbdAiExport {
  
  toCSV(data: any[], filename: string, columns?: string[]): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const headers = columns || Object.keys(data[0]);
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const value = row[h];
          const escaped = String(value || '').replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\n');

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8');
  }

  toJSON(data: any[], filename: string): void {
    const jsonContent = JSON.stringify(data, null, 2);
    this.downloadFile(jsonContent, `${filename}.json`, 'application/json');
  }

  toPDF(data: any[], filename: string, options?: { title?: string; columns?: string[] }): void {
    // Simple HTML-based PDF generation
    const title = options?.title || filename;
    const columns = options?.columns || Object.keys(data[0] || {});

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
  <table>
    <thead>
      <tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${data.map(row => 
        `<tr>${columns.map(c => `<td>${row[c] || ''}</td>`).join('')}</tr>`
      ).join('')}
    </tbody>
  </table>
  <div class="footer">
    <p>Total: ${data.length} registros</p>
    <p>EBD AI - RetailPro</p>
  </div>
</body>
</html>`;

    // Open in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }

  // ============================================================
  // DOWNLOAD HELPER
  // ============================================================

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // PRESET EXPORTS
  // ============================================================

  exportStock(insumos: any[], format: 'csv' | 'json' | 'pdf' = 'csv'): void {
    const columns = ['name', 'category', 'currentStock', 'minStock', 'unit', 'unitCost', 'lastUpdated'];
    const data = insumos.map(i => ({
      name: i.name,
      category: i.category,
      currentStock: i.currentStock,
      minStock: i.minStock,
      unit: i.unit,
      unitCost: i.unitCost,
      lastUpdated: i.lastUpdated,
    }));

    switch (format) {
      case 'csv':
        this.toCSV(data, 'estoque', columns);
        break;
      case 'json':
        this.toJSON(data, 'estoque');
        break;
      case 'pdf':
        this.toPDF(data, 'estoque', { title: 'Relatório de Estoque', columns });
        break;
    }
  }

  exportProducts(products: any[], format: 'csv' | 'json' | 'pdf' = 'csv'): void {
    const columns = ['name', 'category', 'price', 'cost', 'margin', 'active'];
    const data = products.map(p => ({
      name: p.name,
      category: p.category,
      price: p.price,
      cost: p.cost,
      margin: p.price > 0 ? ((p.price - p.cost) / p.price * 100).toFixed(1) + '%' : '0%',
      active: p.active ? 'Sim' : 'Não',
    }));

    switch (format) {
      case 'csv':
        this.toCSV(data, 'produtos', columns);
        break;
      case 'json':
        this.toJSON(data, 'produtos');
        break;
      case 'pdf':
        this.toPDF(data, 'produtos', { title: 'Relatório de Produtos', columns });
        break;
    }
  }

  exportOrders(orders: any[], format: 'csv' | 'json' | 'pdf' = 'csv'): void {
    const columns = ['id', 'customerName', 'totalAmount', 'status', 'createdAt'];
    const data = orders.map(o => ({
      id: o.id,
      customerName: o.customerName,
      totalAmount: `R$ ${(o.totalAmount || 0).toFixed(2)}`,
      status: o.status,
      createdAt: new Date(o.createdAt).toLocaleDateString('pt-BR'),
    }));

    switch (format) {
      case 'csv':
        this.toCSV(data, 'pedidos', columns);
        break;
      case 'json':
        this.toJSON(data, 'pedidos');
        break;
      case 'pdf':
        this.toPDF(data, 'pedidos', { title: 'Relatório de Pedidos', columns });
        break;
    }
  }
}
