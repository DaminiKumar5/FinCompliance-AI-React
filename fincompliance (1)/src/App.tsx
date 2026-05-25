import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, FileText, Scale, FileWarning, CheckCircle, AlertTriangle, Info, Upload } from "lucide-react";
import { AuditEvent, Transaction, TaxRules, AuditReport } from "./types";
import { generateIndianSample } from "./sampleData";

export default function App() {
  const [ledgerInput, setLedgerInput] = useState<string>(
    "TXN-001: 50000 USD - Office Supplies - San Francisco, CA\nTXN-002: 120000 USD - Executive Retreat (Entertainment) - Las Vegas, NV\nTXN-003: 4500 USD - Server Hosting - Seattle, WA\nTXN-004: 85000 USD - Offshore Consulting - Cayman Islands\nTXN-005: 35000 USD - Charity Donation - San Francisco, CA"
  );
  const [region, setRegion] = useState("California, USA");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setLedgerInput(text);
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    setLedgerInput(generateIndianSample());
    setRegion("India");
  };
  const [isAuditing, setIsAuditing] = useState(false);
  
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const startAudit = async () => {
    if (isAuditing) return;
    setIsAuditing(true);
    setEvents([]);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawLedgerText: ledgerInput, region }),
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            const ev = JSON.parse(line) as AuditEvent;
            setEvents((prev) => [...prev, ev]);
            if (ev.type === "complete" || ev.type === "error") {
              setIsAuditing(false);
            }
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      setEvents((prev) => [...prev, { type: "error", message: e.message }]);
      setIsAuditing(false);
    }
  };

  const renderEventObject = (ev: AuditEvent, index: number) => {
    if (ev.type === "log" || ev.type === "error" || ev.type === "complete") return null;

    return (
      <motion.div
        key={`obj-${index}`}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        transition={{ duration: 0.2 }}
        className="mt-2 p-3 rounded bg-slate-800/80 border border-slate-700 shadow-sm overflow-hidden"
      >
        {ev.type === "ledger_data" && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide">
              <FileText className="w-3 h-3" /> Structured Ledger Output
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(ev.data as Transaction[]).map((t, i) => (
                <div key={i} className="p-2 bg-slate-900 rounded border border-slate-700 text-[11px]">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-blue-400">{t.id}</span>
                    <span className="font-bold text-slate-100">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: t.currency || 'USD' }).format(t.amount || 0)}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[10px] flex justify-between space-x-2 font-mono">
                    <span className="text-slate-300 uppercase bg-slate-800 px-1 rounded truncate max-w-[60%]">{t.category}</span>
                    <span className="truncate">{t.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ev.type === "tax_data" && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wide">
              <Scale className="w-3 h-3" /> Tax Rules Context ({ev.data.region})
            </h3>
            <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-3 text-[11px] text-slate-300 font-mono">
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-1">
                <span className="uppercase text-[10px] text-slate-500">Corporate Tax Rate</span>
                <span className="font-bold text-amber-300">{ev.data.corporateTaxRate}%</span>
              </div>
              <div>
                <p className="font-bold text-slate-400 mb-1 uppercase text-[10px]">Context</p>
                <p className="text-slate-300 leading-tight text-[10px]">{ev.data.contextRules}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {ev.data.flaggableCategories?.map((c: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 bg-red-900/40 border border-red-800/50 text-red-300 rounded text-[9px] whitespace-nowrap">
                    FLAG: {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {ev.type === "report_data" && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-red-400 flex items-center gap-2 uppercase tracking-wide">
              <FileWarning className="w-3 h-3" /> Final Audit Variance Report
            </h3>
            
            <div className="bg-slate-800 p-3 rounded border border-slate-700 shadow-xl mb-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Audit Risk Score</span>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-light text-white">{ev.data.overallRiskScore}</span>
                <span className="text-[10px] text-rose-500 mb-1">Risk Rating / 100</span>
              </div>
              <div className="w-full h-1 bg-slate-700 mt-2 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${ev.data.overallRiskScore}%` }}></div>
              </div>
            </div>

            <div className="bg-slate-900 p-2 rounded border border-slate-700 space-y-3 text-[11px] text-slate-300">
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 uppercase font-bold block">Flagged Exceptions</p>
                {(ev.data.flaggedTransactions || []).map((f: any, i: number) => (
                  <div key={i} className={`flex gap-2 p-2 border rounded items-start ${f.severity === 'High' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <AlertTriangle className={`w-3 h-3 mt-0.5 ${f.severity === 'High' ? 'text-red-400' : 'text-amber-400'}`} />
                    <div>
                      <div className="font-mono font-bold text-[10px] text-slate-200 mb-0.5">{f.transactionId}</div>
                      <div className="text-slate-400 text-[10px]">{f.reason}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border border-slate-700/50 bg-slate-800/50 rounded text-[10px] font-mono leading-tight">
                {ev.data.summary}
              </div>
              
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-slate-500 uppercase font-bold block">Recommendations</p>
                <ul className="list-square pl-4 text-slate-400 text-[10px] space-y-1 font-mono">
                  {(ev.data.recommendations || []).map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden select-none">
      
      {/* TOP NAVIGATION BAR */}
      <header className="h-12 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg italic tracking-tighter">FC</div>
          <h1 className="text-sm font-semibold tracking-wider text-slate-300">FINCOMPLIANCE <span className="text-slate-500 font-normal">v4.0.2</span></h1>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-slate-500 uppercase">Process ID</span>
            <span className="text-blue-400">TXN-8849-ALPHA</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 uppercase">Active Agents</span>
            <span className="text-green-400">{isAuditing ? "3 / 3 ACTIVE" : "IDLE"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAuditing ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-slate-600'}`}></div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isAuditing ? "Audit Active" : "System Ready"}</span>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT CONFIGURATION PANEL */}
        <section className="w-full md:w-[320px] lg:w-[350px] border-r border-slate-700 bg-slate-850 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Data Ingestion</span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">INPUT</span>
          </div>
          <div className="p-4 space-y-4 flex-1 flex flex-col overflow-y-auto">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Jurisdiction
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-blue-300"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-1">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                   Raw Ledger Data
                 </label>
                 <div className="flex gap-1">
                   <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] px-2 py-1 rounded flex items-center gap-1 border border-slate-600 transition-colors">
                     <Upload className="w-3 h-3" /> Upload CSV
                     <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                   </label>
                   <button onClick={loadSample} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] px-2 py-1 rounded border border-slate-600 transition-colors">
                     Load Indian Sample
                   </button>
                 </div>
              </div>
              <textarea
                value={ledgerInput}
                onChange={(e) => setLedgerInput(e.target.value)}
                className="w-full flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-[10px] font-mono text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none mt-1"
                placeholder="Paste unstructured transactions here or upload a CSV/TXT file..."
              />
            </div>

            <button
              onClick={startAudit}
              disabled={isAuditing || !ledgerInput}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-2.5 px-4 rounded text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_10px_rgba(37,99,235,0.2)] disabled:shadow-none"
            >
              {isAuditing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {isAuditing ? "Processing..." : "Run AI Audit"}
            </button>
          </div>
        </section>

        {/* CENTER / RIGHT AREA: STREAM & LOGS */}
        <section className="flex-1 flex flex-col bg-slate-900 relative h-full">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.05)_0%,transparent_50%)] pointer-events-none" />
          
          <div className="p-3 bg-slate-800/30 border-b border-slate-700 flex items-center justify-between z-10 shrink-0">
            <div className="flex gap-4 items-center">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Agent Execution Environment</h2>
              <div className="flex gap-1">
                <span className="px-2 py-0.5 bg-slate-700 text-[9px] rounded text-slate-300 font-mono">Stream: Active</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-mono hidden md:block">
              Displaying real-time schema outputs
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth z-10 text-[11px] font-mono"
          >
            {events.length === 0 && !isAuditing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 font-sans">
                <Scale className="w-12 h-12 text-slate-800" />
                <p className="text-[11px] font-bold uppercase tracking-widest bg-slate-800 px-3 py-1.5 rounded">
                  System idle. Awaiting configuration...
                </p>
              </div>
            )}

            <AnimatePresence>
              {events.map((ev, index) => {
                const isLog = ev.type === "log";
                
                if (ev.type === "complete") {
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex border-l-2 border-green-500 bg-slate-800/30 p-2 mt-4"
                    >
                      <span className="flex items-center gap-2 text-green-400 text-[11px] font-bold">
                         [SYSTEM] Audit Lifecycle Completed Successfully.
                      </span>
                    </motion.div>
                  );
                }

                if (ev.type === "error") {
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-2 mt-2 bg-red-900/20 border-l-2 border-red-500 text-red-400 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold">Execution Error:</span> {ev.message}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <div key={index} className="flex flex-col">
                    {isLog && ev.message && (() => {
                       let borderColor = 'border-slate-500';
                       let textColor = 'text-slate-300';
                       let agentTag = 'SYSTEM';
                       if (ev.message.includes('Agent 1')) { borderColor = 'border-blue-500'; textColor = 'text-blue-300'; agentTag = 'LEDGER_INGESTION'; }
                       else if (ev.message.includes('Agent 2')) { borderColor = 'border-amber-500'; textColor = 'text-amber-300'; agentTag = 'TAX_CODE_EXPERT'; }
                       else if (ev.message.includes('Agent 3')) { borderColor = 'border-red-500'; textColor = 'text-red-300'; agentTag = 'AUDITOR_AGENT'; }

                       return (
                        <motion.div
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-2 bg-slate-800 rounded border-l-2 ${borderColor} flex flex-col mb-1`}
                        >
                          <div className="flex justify-between mb-1">
                            <span className={`${textColor} font-bold`}>[{agentTag}]</span>
                          </div>
                          <p className="text-slate-400 text-[10px]">{ev.message}</p>
                        </motion.div>
                       )
                    })()}
                    {renderEventObject(ev, index)}
                  </div>
                );
              })}
            </AnimatePresence>
            {isAuditing && events[events.length - 1]?.type !== "complete" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-2 bg-slate-800/30 rounded border-l-2 border-blue-500/50 opacity-50 mt-2"
              >
                <div className="h-1 w-full bg-slate-700 mt-1 overflow-hidden rounded">
                  <motion.div
                     animate={{ x: ["-100%", "200%"] }}
                     transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                     className="h-full bg-blue-500 w-1/3 rounded"
                  />
                </div>
                <span className="text-[9px] mt-1 block text-slate-500">Processing Stream...</span>
              </motion.div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER STATUS BAR */}
      <footer className="h-8 bg-slate-950 border-t border-slate-800 px-4 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <div className="flex items-center gap-4 font-mono hidden sm:flex">
          <span>MEM: ~2.1GB</span>
          <span className="w-[1px] h-3 bg-slate-800"></span>
          <span>LATENCY: 42ms</span>
          <span className="w-[1px] h-3 bg-slate-800"></span>
          <span>STATUS: {isAuditing ? '[PROCESSING]' : '[READY]'}</span>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {isAuditing && <span className="animate-pulse w-2 h-2 bg-blue-500 rounded-full"></span>}
          <span className="text-slate-400 font-mono">
            {isAuditing ? "STREAMING AGENT COMMUNICATION" : "CONNECTION SECURE"}
          </span>
        </div>
      </footer>
    </div>
  );
}
