import { Router, Request, Response } from "express";
import { MOCK_INVOICES } from "../shared";

export function invoiceRoutes(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const { tenantId, fornecedor, categoria, status, data, valorMin, valorMax } = req.query;

    let results = [...MOCK_INVOICES];

    if (tenantId && tenantId !== "all") {
      results = results.filter((inv) => inv.tenantId === tenantId);
    }

    if (fornecedor) {
      const q = String(fornecedor).toLowerCase();
      results = results.filter((inv) => inv.supplierName.toLowerCase().includes(q) || inv.cnpj.includes(q));
    }

    if (categoria && categoria !== "todas") {
      results = results.filter((inv) => inv.category === categoria);
    }

    if (status && status !== "todos") {
      const isProcessed = status === "processed" || status === "processadas";
      results = results.filter((inv) => inv.processed === isProcessed);
    }

    if (data) {
      results = results.filter((inv) => inv.invoiceDate.includes(String(data)));
    }

    if (valorMin) {
      results = results.filter((inv) => inv.totalAmount >= Number(valorMin));
    }

    if (valorMax) {
      results = results.filter((inv) => inv.totalAmount <= Number(valorMax));
    }

    return res.json({ success: true, count: results.length, invoices: results });
  });

  router.get("/dashboard", (req: Request, res: Response) => {
    const { tenantId = "tenant-1" } = req.query;

    let items = MOCK_INVOICES;
    if (tenantId && tenantId !== "all") {
      items = items.filter((i) => i.tenantId === tenantId);
    }

    const totalNotasMes = items.length;
    const totalGastoMes = items.reduce((acc, i) => acc + i.totalAmount, 0);

    const supplierMap: Record<string, { count: number; total: number }> = {};
    items.forEach((inv) => {
      if (!supplierMap[inv.supplierName]) {
        supplierMap[inv.supplierName] = { count: 0, total: 0 };
      }
      supplierMap[inv.supplierName].count += 1;
      supplierMap[inv.supplierName].total += inv.totalAmount;
    });

    const topFornecedores = Object.entries(supplierMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const categoryMap: Record<string, number> = {
      alimentacao: 0, transporte: 0, servicos: 0, insumos: 0, impostos: 0, outros: 0,
    };

    items.forEach((inv) => {
      const cat = inv.category || 'outros';
      categoryMap[cat] = (categoryMap[cat] || 0) + inv.totalAmount;
    });

    const gastosPorCategoria = Object.entries(categoryMap).map(([category, total]) => ({
      category, total,
      percentage: totalGastoMes > 0 ? ((total / totalGastoMes) * 100).toFixed(1) : "0",
    }));

    return res.json({
      success: true, tenantId,
      metrics: { totalNotasMes, totalGastoMes, topFornecedores, gastosPorCategoria },
    });
  });

  router.get("/export", (req: Request, res: Response) => {
    const { tenantId = "tenant-1" } = req.query;

    let items = MOCK_INVOICES;
    if (tenantId && tenantId !== "all") {
      items = items.filter((i) => i.tenantId === tenantId);
    }

    let csvContent = "ID,Numero_NF,Fornecedor,CNPJ,Data,Categoria,Valor_Total,Status,Observacoes\n";

    items.forEach((inv) => {
      const statusText = inv.processed ? "Processada" : "Pendente";
      const cleanNotes = (inv.notes || "").replace(/"/g, '""');
      csvContent += `"${inv.id}","${inv.invoiceNumber}","${inv.supplierName}","${inv.cnpj}","${inv.invoiceDate}","${inv.category}",${inv.totalAmount},"${statusText}","${cleanNotes}"\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=relatorio_notas_fiscais_${tenantId}.csv`);
    return res.send(csvContent);
  });

  return router;
}
