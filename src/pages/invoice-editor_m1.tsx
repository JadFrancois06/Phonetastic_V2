import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { FileDown, Pencil, X, Plus, Trash2 } from 'lucide-react';
import { AdminLayout } from '../components/Layouts';

interface InvoiceItem {
  id: string;
  designation: string;
  quantity: number;
  unitPrice: number;
  tva: number;
}

export default function InvoiceEditorM2() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState({
    sociétéName: "SASU PHONE TASTIC",
    magasinName:"RÉPUBLIQUE",
    magasinAdresse:"26 Avenue de la République – 06300 Nice",
    magasinMail: "phonetastic06300@gmail.com",
    magasinPhone: "0758545054",
    sociétéSIRET: "993 651 751 00014",
    invoiceStart: 'PT-2026-',
    invoiceNumber: '000792',
    clientName: '',
    invoiceDate: '24/03/2026',
    invoiceTime: '16:37',
    isReparation: false,
    isVente: true,
    items: [
      { id: '1', designation: 'coque de téléphone', quantity: 1, unitPrice: 8.33, tva: 20 },
      { id: '2', designation: "protection d'écran", quantity: 1, unitPrice: 8.33, tva: 20 },
    ] as InvoiceItem[],
    amountPaid: 20,
    paymentMethod: 'Carte',
    dueDate: 'Paiement immédiat'
  });

  // Calculations with strict 2-decimal rounding to prevent floating point errors
  const totalHT = Math.round(data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 100) / 100;
  const totalTVA = Math.round(data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.tva / 100)), 0) * 100) / 100;
  const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;
  const amountDue = Math.round((totalTTC - data.amountPaid) * 100) / 100;

  const formatCurrency = (num: number) => {
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };

  const handleDownloadPDF = async () => {
    try {
      if (!invoiceRef.current) return;
      const el = invoiceRef.current;

      const fullWidth = el.scrollWidth;
      const fullHeight = el.scrollHeight;

      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: fullWidth,
        height: fullHeight,
      });

      const a4Width = 595.28;
      const a4Height = 841.89;

      // Scale: convert px to pt
      const scale = a4Width / fullWidth;
      const totalHeightPt = fullHeight * scale;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      let yOffset = 0;
      let page = 0;
      while (yOffset < totalHeightPt) {
        if (page > 0) pdf.addPage();
        // Place the full image shifted up by yOffset so correct portion shows on this page
        pdf.addImage(dataUrl, 'PNG', 0, -yOffset, a4Width, totalHeightPt);
        yOffset += a4Height;
        page++;
      }

      pdf.save(`Facture-${data.invoiceNumber}.pdf`);
    } catch (err: any) {
      alert('Erreur PDF: ' + err?.message);
      console.error(err);
    }
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), designation: '', quantity: 1, unitPrice: 0, tva: 20 }]
    }));
  };

  const removeItem = (id: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  return (
    <AdminLayout title="Éditeur de Facture M1">
    <div className="min-h-screen bg-gray-400 py-10 px-4 flex flex-col items-center font-sans text-gray-900">

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 z-40 flex flex-col gap-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-colors flex justify-center items-center"
          title="Modifier la facture"
        >
          <Pencil size={24} />
        </button>
        <button onClick={handleDownloadPDF} className="bg-[#10b981] hover:bg-[#059669] text-white p-4 rounded-full shadow-lg transition-colors flex justify-center items-center" title="Télécharger PDF">
          <FileDown size={24} />
        </button>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-start pt-10 pb-10 px-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 relative my-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-black">
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-6">Modifier la facture</h2>

            <div className="space-y-6">
              {/* General Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium mb-1">Société</label>
                  <input type="text" value={data.sociétéName} onChange={e => setData({ ...data, sociétéName: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Magasin</label>
                  <input type="text" value={data.magasinName} onChange={e => setData({ ...data, magasinName: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Adresse du Magasin</label>
                  <input type="text" value={data.magasinAdresse} onChange={e => setData({ ...data, magasinAdresse: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email du Magasin</label>
                  <input type="text" value={data.magasinMail} onChange={e => setData({ ...data, magasinMail: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone du Magasin</label>
                  <input type="text" value={data.magasinPhone} onChange={e => setData({ ...data, magasinPhone: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SIRET de la Société</label>
                  <input type="text" value={data.sociétéSIRET} onChange={e => setData({ ...data, sociétéSIRET: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° Facture Start Date</label>
                  <input type="text" value={data.invoiceStart} onChange={e => setData({ ...data, invoiceStart: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° Facture</label>
                  <input type="text" value={data.invoiceNumber} onChange={e => setData({ ...data, invoiceNumber: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <input type="text" value={data.clientName} onChange={e => setData({ ...data, clientName: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input type="text" value={data.invoiceDate} onChange={e => setData({ ...data, invoiceDate: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Heure</label>
                  <input type="text" value={data.invoiceTime} onChange={e => setData({ ...data, invoiceTime: e.target.value })} className="w-full border rounded p-2" />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={data.isReparation} onChange={e => setData({ ...data, isReparation: e.target.checked })} className="w-4 h-4" />
                    Réparation
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer ">
                    <input type="checkbox" checked={data.isVente} onChange={e => setData({ ...data, isVente: e.target.checked })} className="w-4 h-4" />
                    Vente
                  </label>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Articles</label>
                  <button onClick={addItem} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded flex items-center gap-1 hover:bg-blue-100"><Plus size={16} /> Ajouter</button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {data.items.map((item) => (
                    <div key={item.id} className="flex gap-2 items-start bg-gray-50 p-3 rounded border">
                      <div className="flex-1 space-y-2">
                        <input type="text" placeholder="Désignation" value={item.designation} onChange={e => handleItemChange(item.id, 'designation', e.target.value)} className="w-full border rounded p-2 text-sm" />
                        <div className="flex flex-wrap gap-2">
                          <div className="flex-1 min-w-[80px]">
                            <label className="block text-xs text-gray-500 mb-1">Qté</label>
                            <input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="w-full border rounded p-2 text-sm" />
                          </div>
                          <div className="flex-1 min-w-[100px]">
                            <label className="block text-xs text-gray-500 mb-1">Prix unitaire TTC</label>
                            <input
                              type="number"
                              step="0.01"
                              value={Math.round(item.unitPrice * (1 + item.tva / 100) * 100) / 100}
                              onChange={e => {
                                const ttc = parseFloat(e.target.value) || 0;
                                const ht = Math.round((ttc / (1 + item.tva / 100)) * 100) / 100;
                                handleItemChange(item.id, 'unitPrice', ht);
                              }}
                              className="w-full border rounded p-2 text-sm"
                            />
                          </div>
                          <div className="flex-1 min-w-[80px]">
                            <label className="block text-xs text-gray-500 mb-1">TVA (%)</label>
                            <input type="number" value={item.tva} onChange={e => {
                              const newTva = parseFloat(e.target.value) || 0;
                              handleItemChange(item.id, 'tva', newTva);
                            }} className="w-full border rounded p-2 text-sm" />
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded mt-6"><Trash2 size={20} /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Montant déjà versé (€)</label>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" value={data.amountPaid} onChange={e => setData({ ...data, amountPaid: parseFloat(e.target.value) || 0 })} className="w-full border rounded p-2" />
                    <button onClick={() => setData({ ...data, amountPaid: totalTTC })} className="bg-gray-200 px-3 rounded text-sm hover:bg-gray-300 whitespace-nowrap transition-colors" title="Régler la totalité">Totalité</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reste à payer (€)</label>
                  <div className="w-full border rounded p-2 bg-gray-50 text-gray-700 font-medium h-[42px] flex items-center">
                    {formatCurrency(amountDue)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mode de règlement</label>
                  <input type="text" value={data.paymentMethod} onChange={e => setData({ ...data, paymentMethod: e.target.value })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date limite de règlement</label>
                  <input type="text" value={data.dueDate} onChange={e => setData({ ...data, dueDate: e.target.value })} className="w-full border rounded p-2" />
                </div>
              </div>

            </div>

            <div className="mt-8 flex justify-end">
              <button onClick={() => setIsModalOpen(false)} className="bg-black text-white px-8 py-2 rounded font-medium hover:bg-gray-800">Terminer</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Container */}
      <div ref={invoiceRef} className="bg-white w-full max-w-[794px] min-h-[1123px] shadow-xl px-16 py-12 md:px-[80px] md:py-[40px] relative">

        {/* Header */}
        <div className="flex flex-row md:flex-row justify-between items-start mb-8 gap-6">
          <div className="flex gap-2 items-center md:items-start">
            {/* Logo */}
            <div className="w-33 h-33 relative -left-4">
              <img src="/assets/logo2.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="relative flex flex-col justify-center -left-4 pt-2">
              <h1 className="text-lg font-bold mb-1">{data.sociétéName}</h1>
              <h1 className="text-xl font-bold mb-4">{data.magasinName}</h1>
              <p className="text-xs font-semibold text-gray-500 mb-1">{data.magasinAdresse}</p>
              <p className="text-xs font-semibold text-gray-500 mb-1">Email : {data.magasinMail}</p>
              <p className="text-xs font-semibold text-gray-500 mb-1">Tél : {data.magasinPhone}</p>
              <p className="text-xs font-semibold text-gray-500">SIRET : {data.sociétéSIRET}</p>
            </div>
          </div>
          <div className=" text-left -left-10 pt-2 gap-1.5 max-w-[220px]">
            <h2 className="text-xl font-bold pb-1.5 leading-tight">FACTURE N° {data.invoiceStart}</h2>
            <h2 className="text-xl font-bold leading-tight">{data.invoiceNumber}</h2>
           
          </div>
        </div>

        {/* Thick Divider */}
        <div className="w-full h-[1.8px] bg-gray-800 mb-6"></div>

        {/* Client & Date */}
        <div className="flex flex-row md:flex-row justify-between gap-8">
          <div className="w-full md:w-1/2">
            <h3 className="font-bold text-sm ">Client :</h3>
            <div className="border-b-[1.8px] border-gray-600  w-full md:w-4/5 h-6 flex items-end pb-1">
              <span className="text-sm">{data.clientName}</span>
            </div>
          </div>
          <div className="w-full md:w-1/3 flex flex-col items-start md:items-end">
            <div className="text-left">
              <h3 className="font-bold text-sm mb-1">Date de facture :</h3>
              <p className="text-gray-700 font-semibold mb-1 text-sm">{data.invoiceDate}</p>
              <p className="text-gray-700  text-sm">{data.invoiceTime}</p>
            </div>
          </div>
        </div>

        {/* Type */}
        <div className="mb-10">
          <h3 className="font-bold text-sm mb-4">Type :</h3>
          <div className="space-y-6">
            <div className="flex items-center w-full">
              <span className="font-bold text-sm w-[40%]">Réparation</span>
              <div className="w-[10%] flex justify-end">
                <div className="w-3 h-3 border border-gray-400 rounded-sm flex items-center justify-center bg-[#dedede]">
                  {data.isReparation && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center w-full">
              <span className="font-bold text-sm w-[40%]">Vente</span>
              <div className="w-[10%] flex justify-end">
                <div className="w-3 h-3 border border-gray-400 rounded-sm flex items-center justify-center bg-[#dedede]">
                  {data.isVente && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-6">
          <table className="w-full border-collapse border border-gray-700 text-xs">
            <thead>
              <tr className="border-b-2 border-gray-700 bg-[#f0f0f0]">
                <th className="text-left text-[14px] p-3 border-r-2 border-gray-700 font-bold w-[40%]">
                  Désignation (pièce / service)
                </th>
                <th className="text-left text-[14px] p-3 border-r-2 border-gray-700 font-bold w-[10%]">
                  Qté
                </th>
                <th className="text-left text-[14px] p-3 border-r-2 border-gray-700 font-bold w-[25%]">
                  Prix unitaire HT
                </th>
                <th className="text-left text-[14px] p-3 border-r-2 border-gray-700 font-bold w-[10%]">
                  TVA
                </th>
                <th className="text-left text-[14px] p-3 font-bold w-[20%]">
                  Total HT
                </th>
              </tr>
            </thead>

            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b-2 border-gray-700">
                  <td className="p-3 text-[14px] font-semibold border-r-2 border-gray-700">
                    {item.designation}
                  </td>
                  <td className="p-3 text-[14px] border-r-2 border-gray-700">
                    {item.quantity}
                  </td>
                  <td className="p-3 text-[14px] border-r-2 border-gray-700">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="p-3 text-[14px] border-r-2 border-gray-700">
                    {item.tva}%
                  </td>
                  <td className="p-3 text-[14px]">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}

              {data.items.length === 0 && (
                <tr className="border-b-2 border-gray-700">
                  <td colSpan={5} className="p-3 text-center text-gray-500 italic">
                    Aucun article
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Thick Divider Below Table */}
        <div className="w-full h-[1.6px] bg-black mb-8"></div>

        {/* Totals */}
        <div className="flex justify-end mb-16">
          <div className="w-full md:w-2/5 lg:w-1/3">
            <div className="flex justify-between mb-4">
              <span className="font-bold text-sm">Total HT :</span>
              <span className="text-sm font-semibold">{formatCurrency(totalHT)}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span className="font-bold text-sm">Total TVA :</span>
              <span className="text-sm font-semibold">{formatCurrency(totalTVA)}</span>
            </div>
            <div className="w-full h-[1.6px] bg-black mb-4"></div>
            <div className="flex justify-between">
              <span className="font-bold text-sm">Total TTC :</span>
              <span className="text-sm font-semibold">{formatCurrency(totalTTC)}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mb-12 space-y-3">
          <div className="flex justify-between w-full">
            <span className="font-bold text-sm">Montant déjà versé :</span>
            <span className="text-sm font-semibold">{formatCurrency(data.amountPaid)}</span>
          </div>
          <div className="flex justify-between w-full">
            <span className="font-bold text-sm">Reste à payer :</span>
            <span className="text-sm font-semibold">{formatCurrency(amountDue)}</span>
          </div>
          <div className="flex gap-2 pt-4">
            <span className="font-bold text-sm">Mode de règlement :</span>
            <span className="text-sm font-semibold">{data.paymentMethod}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-sm">Date limite de règlement :</span>
            <span className="text-sm font-semibold">{data.dueDate}</span>
          </div>
        </div>

        {/* Footer Divider */}
        <div className="w-full h-[1px] bg-gray-300 mb-6"></div>

        {/* Footer */}
        <div className="text-[13px] text-gray-7600 space-y-3">
          <p><span className="font-bold text-black">Garantie :</span> Pièces et réparations garanties 3 mois (hors casse, oxydation et mauvaise utilisation).</p>
          <p>En cas de retard de paiement, des pénalités sont exigibles sans qu'un rappel soit nécessaire. Indemnité forfaitaire pour frais de recouvrement : 40 € (article L441-10 du Code de commerce).</p>
        </div>

      </div>
    </div>
    </AdminLayout>
  );
}
