
import React, { useState, useEffect } from 'react';
import { X, Key, Plus, Trash2, CheckCircle2, Loader2, Save } from 'lucide-react';
import { ApiKeyGemini, ApiKeyGroq } from '../../types';
import { manageApiKeys } from '../../services/gasService';
import { showXeenapsToast } from '../../utils/toastUtils';
import { showXeenapsDeleteConfirm } from '../../utils/confirmUtils';
import { StandardTableContainer, StandardTableWrapper, StandardTh, StandardTr, StandardTd } from '../Common/TableComponents';

interface ApiKeyManagerModalProps {
  onClose: () => void;
}

const ApiKeyManagerModal: React.FC<ApiKeyManagerModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'GEMINI' | 'GROQ' | 'SCRAPING'>('GEMINI');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [geminiKeys, setGeminiKeys] = useState<ApiKeyGemini[]>([]);
  const [groqKeys, setGroqKeys] = useState<ApiKeyGroq[]>([]);
  const [scrapingKey, setScrapingKey] = useState<string>('');

  // Form States
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await manageApiKeys({ action: 'get_keys' });
      if (response.status === 'success' && response.data) {
        setGeminiKeys(response.data.gemini || []);
        setGroqKeys(response.data.groq || []);
        setScrapingKey(response.data.scraping || '');
      }
    } catch (e) {
      showXeenapsToast('error', 'Failed to load API Keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddGemini = async () => {
    if (!newKey.trim() || !newLabel.trim()) return;
    setIsProcessing(true);
    try {
      const success = await manageApiKeys({ 
        action: 'add_gemini', 
        key: newKey.trim(), 
        label: newLabel.trim() 
      });
      if (success.status === 'success') {
        showXeenapsToast('success', 'Gemini Key Added');
        setNewKey('');
        setNewLabel('');
        loadData();
      } else {
        showXeenapsToast('error', 'Failed to add key');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddGroq = async () => {
    if (!newKey.trim()) return;
    setIsProcessing(true);
    try {
      const success = await manageApiKeys({ 
        action: 'add_groq', 
        api: newKey.trim() 
      });
      if (success.status === 'success') {
        showXeenapsToast('success', 'Groq Key Added');
        setNewKey('');
        loadData();
      } else {
        showXeenapsToast('error', 'Failed to add key');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveScraping = async () => {
    setIsProcessing(true);
    try {
      const success = await manageApiKeys({ 
        action: 'save_scraping', 
        key: scrapingKey.trim() 
      });
      if (success.status === 'success') {
        showXeenapsToast('success', 'ScrapingAnt Key Saved');
      } else {
        showXeenapsToast('error', 'Failed to save key');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string, type: 'GEMINI' | 'GROQ') => {
    const confirmed = await showXeenapsDeleteConfirm(1);
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const action = type === 'GEMINI' ? 'delete_gemini' : 'delete_groq';
      const success = await manageApiKeys({ action, id });
      if (success.status === 'success') {
        showXeenapsToast('success', 'Key Deleted');
        loadData();
      } else {
        showXeenapsToast('error', 'Delete failed');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const TabButton = ({ label, tab }: { label: string, tab: typeof activeTab }) => (
    <button 
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
        activeTab === tab 
          ? 'bg-[#004A74] text-white shadow-md' 
          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20">
        
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#004A74] text-[#FED400] rounded-2xl flex items-center justify-center shadow-lg">
                 <Key size={24} />
              </div>
              <div>
                 <h2 className="text-xl font-black text-[#004A74] uppercase tracking-tight">API Key Manager</h2>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manage Service Credentials</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all">
              <X size={24} />
           </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-gray-100">
           <TabButton label="Gemini AI" tab="GEMINI" />
           <TabButton label="Groq AI" tab="GROQ" />
           <TabButton label="Scraping Ant" tab="SCRAPING" />
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden p-8 bg-[#fcfcfc] flex flex-col">
           {isLoading ? (
             <div className="flex-1 flex items-center justify-center">
                <Loader2 size={40} className="text-[#004A74] animate-spin" />
             </div>
           ) : (
             <>
               {/* GEMINI TAB */}
               {activeTab === 'GEMINI' && (
                 <div className="flex-1 flex flex-col h-full space-y-6">
                    <div className="flex gap-4 items-end bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shrink-0">
                       <div className="flex-1 space-y-2">
                          <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Label</label>
                          <input 
                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-bold text-[#004A74] outline-none border border-transparent focus:bg-white focus:border-[#004A74]/20 transition-all"
                            placeholder="e.g. My Pro Key"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                          />
                       </div>
                       <div className="flex-[2] space-y-2">
                          <label className="text-[9px] font-black uppercase text-gray-400 ml-1">API Key</label>
                          <input 
                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-[#004A74] outline-none border border-transparent focus:bg-white focus:border-[#004A74]/20 transition-all"
                            placeholder="AIza..."
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                          />
                       </div>
                       <button 
                         onClick={handleAddGemini}
                         disabled={isProcessing}
                         className="px-6 py-2.5 bg-[#004A74] text-[#FED400] rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 h-[38px]"
                       >
                         {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                       </button>
                    </div>

                    <div className="flex-1 overflow-hidden border border-gray-100 rounded-[2rem] bg-white">
                      <StandardTableContainer>
                        <StandardTableWrapper>
                          <table className="w-full text-left">
                             <thead>
                               <tr>
                                  <StandardTh>Label</StandardTh>
                                  <StandardTh>Key Prefix</StandardTh>
                                  <StandardTh>Status</StandardTh>
                                  <StandardTh>Action</StandardTh>
                               </tr>
                             </thead>
                             <tbody>
                               {geminiKeys.map(k => (
                                 <StandardTr key={k.id}>
                                    <StandardTd className="font-bold text-[#004A74]">{k.label}</StandardTd>
                                    <StandardTd className="font-mono text-gray-500 text-xs">...{k.key.slice(-6)}</StandardTd>
                                    <StandardTd>
                                       <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${k.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          {k.status}
                                       </span>
                                    </StandardTd>
                                    <StandardTd>
                                       <button onClick={() => handleDelete(k.id, 'GEMINI')} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                                          <Trash2 size={16} />
                                       </button>
                                    </StandardTd>
                                 </StandardTr>
                               ))}
                             </tbody>
                          </table>
                        </StandardTableWrapper>
                      </StandardTableContainer>
                    </div>
                 </div>
               )}

               {/* GROQ TAB */}
               {activeTab === 'GROQ' && (
                 <div className="flex-1 flex flex-col h-full space-y-6">
                    <div className="flex gap-4 items-end bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shrink-0">
                       <div className="flex-1 space-y-2">
                          <label className="text-[9px] font-black uppercase text-gray-400 ml-1">Groq API Key</label>
                          <input 
                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-[#004A74] outline-none border border-transparent focus:bg-white focus:border-[#004A74]/20 transition-all"
                            placeholder="gsk_..."
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                          />
                       </div>
                       <button 
                         onClick={handleAddGroq}
                         disabled={isProcessing}
                         className="px-6 py-2.5 bg-[#004A74] text-[#FED400] rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 h-[38px]"
                       >
                         {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                       </button>
                    </div>

                    <div className="flex-1 overflow-hidden border border-gray-100 rounded-[2rem] bg-white">
                      <StandardTableContainer>
                        <StandardTableWrapper>
                          <table className="w-full text-left">
                             <thead>
                               <tr>
                                  <StandardTh>Key Prefix</StandardTh>
                                  <StandardTh>Action</StandardTh>
                               </tr>
                             </thead>
                             <tbody>
                               {groqKeys.map(k => (
                                 <StandardTr key={k.id}>
                                    <StandardTd className="font-mono text-gray-500 text-xs">{k.api.slice(0, 10)}...</StandardTd>
                                    <StandardTd>
                                       <button onClick={() => handleDelete(k.id, 'GROQ')} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                                          <Trash2 size={16} />
                                       </button>
                                    </StandardTd>
                                 </StandardTr>
                               ))}
                             </tbody>
                          </table>
                        </StandardTableWrapper>
                      </StandardTableContainer>
                    </div>
                 </div>
               )}

               {/* SCRAPING TAB */}
               {activeTab === 'SCRAPING' && (
                 <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                    <div className="w-full max-w-md space-y-4">
                       <div className="text-center space-y-2 mb-8">
                          <div className="w-16 h-16 bg-[#FED400]/20 text-[#004A74] rounded-2xl flex items-center justify-center mx-auto mb-4">
                             <Key size={32} />
                          </div>
                          <h3 className="text-lg font-black text-[#004A74] uppercase">ScrapingAnt Configuration</h3>
                          <p className="text-xs text-gray-400 font-medium">Single key for web extraction service</p>
                       </div>

                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-gray-400 ml-1">API Key</label>
                          <input 
                            className="w-full bg-white px-6 py-4 rounded-2xl border border-gray-200 text-sm font-mono font-bold text-[#004A74] outline-none focus:ring-4 focus:ring-[#004A74]/5 transition-all text-center"
                            placeholder="Enter ScrapingAnt Key..."
                            value={scrapingKey}
                            onChange={(e) => setScrapingKey(e.target.value)}
                          />
                       </div>

                       <button 
                         onClick={handleSaveScraping}
                         disabled={isProcessing}
                         className="w-full py-4 bg-[#004A74] text-[#FED400] rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                       >
                         {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
                       </button>
                    </div>
                 </div>
               )}
             </>
           )}
        </div>

      </div>
    </div>
  );
};

export default ApiKeyManagerModal;
