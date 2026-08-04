import React, { useState, useRef } from 'react';
import {
  ScanText,
  Upload,
  Camera,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Boxes,
  FileCheck,
  Building2,
  Calendar,
  Receipt,
  X,
  Smartphone
} from 'lucide-react';
import { Insumo, InvoiceScan, InvoiceItem, CurrencyType } from '../types';
import { SAMPLE_INVOICES } from '../data/mockData';

interface InvoiceOCRModuleProps {
  insumos: Insumo[];
  setInsumos: React.Dispatch<React.SetStateAction<Insumo[]>>;
  currency: CurrencyType;
}

export const InvoiceOCRModule: React.FC<InvoiceOCRModuleProps> = ({
  insumos,
  setInsumos,
  currency,
}) => {
  const [loading, setLoading] = useState(false);
  const [activeScan, setActiveScan] = useState<InvoiceScan | null>(SAMPLE_INVOICES[0]);
  const [processedLog, setProcessedLog] = useState<InvoiceScan[]>([]);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);

  // Live Camera State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const formatCurrency = (val: number) => {
    if (currency === 'BRL') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (currency === 'EUR') return `€${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  // Upload or Mobile Camera File Selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImageBase64(base64);
      processOCRWithServer(base64.split(',')[1], file.type);
    };
    reader.readAsDataURL(file);
  };

  // Open Live WebCam / Mobile Camera Stream Modal
  const startCamera = async () => {
    try {
      setIsCameraModalOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error opening camera:', err);
      alert('Não foi possível acessar a câmera do dispositivo. Verifique as permissões.');
      setIsCameraModalOpen(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraModalOpen(false);
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelectedImageBase64(dataUrl);
      stopCamera();
      processOCRWithServer(dataUrl.split(',')[1], 'image/jpeg');
    }
  };

  // Call Express + Gemini server route /api/ocr-invoice
  const processOCRWithServer = async (base64Data?: string, mimeType?: string, sampleText?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ocr-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mimeType || 'image/jpeg',
          sampleText,
        }),
      });

      const data = await response.json();
      if (data.success && data.invoiceData) {
        const inv = data.invoiceData;
        const newScan: InvoiceScan = {
          id: `inv-${Date.now()}`,
          tenantId: 'tenant-1',
          supplierName: inv.supplierName || 'Fornecedor Identificado',
          cnpj: inv.cnpj || '00.000.000/0001-00',
          invoiceNumber: inv.invoiceNumber || `NF-${Math.floor(10000 + Math.random() * 90000)}`,
          invoiceDate: inv.invoiceDate || new Date().toISOString().split('T')[0],
          totalAmount: inv.totalAmount || 1200,
          category: inv.category || 'insumos',
          notes: inv.notes || 'Análise de Nota Fiscal realizada via OCR Gemini',
          items: inv.items || [],
          processed: false,
        };
        setActiveScan(newScan);
      } else {
        alert('Falha ao processar OCR. Usando dados da nota de exemplo.');
      }
    } catch (err) {
      console.error('Error calling /api/ocr-invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Automated Inventory Sync
  const handleConfirmAndSyncInventory = () => {
    if (!activeScan || activeScan.processed) return;

    const updatedInsumos = [...insumos];

    activeScan.items.forEach((item) => {
      // Find matching insumo by name
      const existingIdx = updatedInsumos.findIndex(
        (ins) => ins.name.toLowerCase() === item.matchedInsumoName.toLowerCase()
      );

      if (existingIdx !== -1) {
        // Update stock and cost
        const existing = updatedInsumos[existingIdx];
        updatedInsumos[existingIdx] = {
          ...existing,
          currentStock: existing.currentStock + item.quantity,
          unitCost: item.unitCost, // Update to latest purchase cost
          supplier: activeScan.supplierName,
          lastUpdated: new Date().toISOString().split('T')[0],
        };
      } else {
        // Auto register new insumo
        const newInsumo: Insumo = {
          id: `ins-${Date.now()}-${Math.random()}`,
          tenantId: activeScan.tenantId || 'tenant-1',
          code: `INS-${Math.floor(300 + Math.random() * 700)}`,
          name: item.matchedInsumoName,
          category: item.category || 'Entrada IA (OCR)',
          unit: item.unit,
          currentStock: item.quantity,
          minStock: Math.round(item.quantity * 0.2),
          unitCost: item.unitCost,
          supplier: activeScan.supplierName,
          lastUpdated: new Date().toISOString().split('T')[0],
        };
        updatedInsumos.unshift(newInsumo);
      }
    });

    setInsumos(updatedInsumos);
    setActiveScan({ ...activeScan, processed: true, processedAt: new Date().toLocaleTimeString() });
    setProcessedLog([activeScan, ...processedLog]);

    alert(`Estoque atualizado com sucesso! ${activeScan.items.length} insumos atualizados/cadastrados.`);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/50">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Leitor de Notas Fiscais IA (OCR Gemini)
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold">
              Gemini 3.6 Flash
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Capture fotos com a câmera do celular ou faça upload de notas para atualizar custos e estoque de insumos.
          </p>
        </div>
      </div>

      {/* Main OCR Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload & Camera Input Section */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
              <ScanText className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-white">Capturar Nota Fiscal (NF-e)</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Tire foto pelo celular ou envie um arquivo para leitura OCR instantânea com Inteligência Artificial.
              </p>
            </div>

            {/* Direct Camera Scan Trigger */}
            <button
              onClick={startCamera}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              Tirar Foto da Nota com Câmera
            </button>

            {/* Mobile / File Dropzone Input */}
            <label className="block p-5 rounded-xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-[#17171A] hover:bg-[#1A1A1E] transition-all cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                capture="environment" // Enables direct camera trigger on mobile devices
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="space-y-1.5">
                <Upload className="w-5 h-5 mx-auto text-zinc-400 group-hover:text-amber-500 transition-colors" />
                <div className="text-xs font-bold text-zinc-300">
                  Ou Escolher Foto / Galeria
                </div>
                <div className="text-[10px] text-zinc-500">
                  Foto, Galeria do Celular ou PDF
                </div>
              </div>
            </label>

            {/* Instant Demo Pre-loaded Sample Buttons */}
            <div className="pt-2 border-t border-zinc-800">
              <div className="text-[11px] font-bold text-zinc-400 mb-2">Testar com Nota de Exemplo:</div>
              <button
                onClick={() => processOCRWithServer(undefined, undefined, 'Nota Atacadão Distribuidora R$ 1450.80')}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs text-amber-400 font-bold border border-zinc-700/50 flex items-center justify-center gap-2"
              >
                <Receipt className="w-3.5 h-3.5" />
                Carregar NF Atacadão (Insumos Padaria)
              </button>
            </div>
          </div>
        </div>

        {/* OCR Result & Database Automation View */}
        <div className="lg:col-span-2 space-y-4">
          
          {loading ? (
            <div className="p-12 rounded-2xl bg-[#121214] border border-zinc-800/80 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
              <div className="text-sm font-bold text-white">Analisando Nota Fiscal com Gemini IA...</div>
              <p className="text-xs text-zinc-400">Extraindo fornecedor, quantidades, custo base por grama/ml e itens.</p>
            </div>
          ) : activeScan ? (
            <div className="p-6 rounded-2xl bg-[#121214] border border-zinc-800/80 space-y-6">
              
              {/* Scan Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-amber-500 font-mono font-bold">
                    <Receipt className="w-4 h-4" />
                    {activeScan.invoiceNumber}
                  </div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    {activeScan.supplierName}
                  </h3>
                  <div className="text-xs text-zinc-400">CNPJ: {activeScan.cnpj} | Emissão: {activeScan.invoiceDate}</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-zinc-400">Valor Total da Nota</div>
                  <div className="text-xl font-black text-emerald-400">{formatCurrency(activeScan.totalAmount)}</div>
                </div>
              </div>

              {/* Extracted Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Itens Mapeados para Estoque ({activeScan.items.length})
                  </h4>
                  {activeScan.processed && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Reabastecido no Banco
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 font-semibold text-[10px]">
                        <th className="py-2">Item Impresso na Nota</th>
                        <th className="py-2">Insumo Mapeado</th>
                        <th className="py-2">Qtd Entrando</th>
                        <th className="py-2">Custo Base Novo</th>
                        <th className="py-2 text-right">Total Item</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {activeScan.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/40">
                          <td className="py-2.5 text-zinc-400 font-mono text-[11px]">{item.rawName}</td>
                          <td className="py-2.5 font-bold text-white">{item.matchedInsumoName}</td>
                          <td className="py-2.5 font-mono text-amber-400 font-bold">
                            +{item.quantity} {item.unit}
                          </td>
                          <td className="py-2.5 font-mono text-emerald-400 font-bold">
                            {formatCurrency(item.unitCost)}/{item.unit}
                          </td>
                          <td className="py-2.5 font-mono text-white font-bold text-right">
                            {formatCurrency(item.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirm Automation Button */}
              {!activeScan.processed ? (
                <div className="p-4 rounded-xl bg-[#1A1A1E] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-zinc-400">
                    O sistema irá atualizar o custo unitário e adicionar as quantidades aos insumos no banco de dados.
                  </div>

                  <button
                    onClick={handleConfirmAndSyncInventory}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/20 whitespace-nowrap"
                  >
                    Confirmar & Atualizar Estoque
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold flex items-center justify-between">
                  <span>Os saldos e custos base de matérias-primas já foram sincronizados com o estoque!</span>
                </div>
              )}

            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-[#121214] border border-zinc-800/80 text-center text-zinc-500">
              Faça o upload ou selecione uma nota de exemplo para visualizar a extração OCR Gemini.
            </div>
          )}

        </div>

      </div>

      {/* LIVE CAMERA CAPTURE MODAL */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                <Camera className="w-4 h-4 text-amber-500" />
                Câmera ao Vivo - Digitalizar Nota Fiscal
              </div>
              <button
                onClick={stopCamera}
                className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Visual Scanning Guide Box */}
              <div className="absolute inset-8 border-2 border-dashed border-amber-500/80 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="text-[10px] bg-black/60 text-amber-400 px-3 py-1 rounded-full font-bold">
                  Enquadre a Nota Fiscal Aqui
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={stopCamera}
                className="w-1/3 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={capturePhotoFromCamera}
                className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-xs shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Capturar Foto da Nota
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
