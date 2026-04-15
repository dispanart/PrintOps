import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Activity, 
  AlertTriangle, 
  History, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Droplets,
  LayoutDashboard,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Machine {
  id: string;
  name: string;
  ip: string;
  status: 'running' | 'idle' | 'error';
  lastCounter: number;
  lastSeen: any;
  hasLowConsumable?: boolean;
  consumableSummary?: { name: string; level: number }[];
}

interface Notification {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
}

interface Alert {
  machineId: string;
  type: string;
  message: string;
}

interface Consumable {
  name: string;
  level: number;
}

interface Job {
  name: string;
  status: string;
  createdAt: any;
}

// --- Components ---

const StatusIndicator = ({ status }: { status: string }) => {
  const configs = {
    running: { color: 'bg-emerald-500', text: 'Running', icon: Activity },
    idle: { color: 'bg-amber-500', text: 'Idle', icon: Clock },
    error: { color: 'bg-rose-500', text: 'Error', icon: XCircle },
  };
  const config = configs[status as keyof typeof configs] || configs.idle;

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-2 h-2 rounded-full animate-pulse", config.color)} />
      <span className={cn("text-[10px] font-bold uppercase tracking-widest", config.color.replace('bg-', 'text-'))}>
        {config.text}
      </span>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const configs = {
    running: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    idle: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
    error: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
  };
  const config = configs[status as keyof typeof configs] || configs.idle;

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest",
      config.bg, config.text, config.border
    )}>
      {status}
    </span>
  );
};

interface ConsumableBarProps {
  name: string;
  level: number;
}

const ConsumableBar: React.FC<ConsumableBarProps> = ({ name, level }) => {
  const isLow = level < 20;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
        <span className="text-slate-400">{name}</span>
        <span className={cn(isLow ? "text-rose-500" : "text-slate-200")}>{level}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <div 
          className={cn(
            "h-full transition-all duration-1000 ease-out",
            isLow ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" : "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.2)]"
          )} 
          style={{ width: `${level}%` }} 
        />
      </div>
    </div>
  );
};

interface MachineCardProps {
  machine: Machine;
  onClick: () => void;
  isActive: boolean;
}

const MachineCard: React.FC<MachineCardProps> = ({ machine, onClick, isActive }) => {
  const lastSeenDate = machine.lastSeen?.seconds ? new Date(machine.lastSeen.seconds * 1000) : new Date();
  const isStale = (Date.now() - lastSeenDate.getTime()) > 300000; // 5 minutes

  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden group",
        isActive 
          ? "bg-[#1A1F29] border-sky-500/50 ring-1 ring-sky-500/50 shadow-xl shadow-sky-500/10" 
          : "bg-[#151921] border-slate-800 hover:border-slate-700 hover:bg-[#181D26]"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "p-2.5 rounded-xl border transition-colors relative",
          isActive ? "bg-sky-500/10 border-sky-500/20" : "bg-slate-800 border-slate-700"
        )}>
          <Printer className={cn("w-5 h-5", isActive ? "text-sky-500" : "text-slate-400")} />
          {machine.hasLowConsumable && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-[#151921] animate-bounce" />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusIndicator status={machine.status} />
          {machine.hasLowConsumable && (
            <span className="text-[8px] font-bold text-rose-500 uppercase tracking-tighter">Low Supply</span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-white group-hover:text-sky-400 transition-colors">{machine.name}</h3>
        <p className="text-xs text-slate-500 font-mono tracking-tighter">{machine.ip}</p>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-800/50 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-1.5 text-slate-500">
          <TrendingUp className="w-3 h-3" />
          <span>{machine.lastCounter?.toLocaleString()}</span>
        </div>
        <div className={cn(
          "flex items-center gap-1",
          isStale ? "text-rose-400" : "text-slate-500"
        )}>
          <Clock className="w-3 h-3" />
          <span>{formatDistanceToNow(lastSeenDate, { addSuffix: true })}</span>
        </div>
      </div>
      {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-500" />}
    </button>
  );
};

export default function App() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [production, setProduction] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  
  // Add Machine Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineIp, setNewMachineIp] = useState('');
  const [newMachineIsSC170, setNewMachineIsSC170] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Polling Logic
  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashRes = await fetch('/api/dashboard');
        const dashData = await dashRes.json();
        
        // Detect new alerts for notifications
        if (dashData.alerts && dashData.alerts.length > 0) {
          const newNotifications: Notification[] = dashData.alerts.map((a: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            type: a.type === 'machine_error' ? 'error' : 'warning',
            message: a.message,
            timestamp: new Date()
          }));
          
          // Only add if message is unique in current list to avoid spam
          setNotifications(prev => {
            const existingMessages = new Set(prev.map(n => n.message));
            const filtered = newNotifications.filter(n => !existingMessages.has(n.message));
            return [...filtered, ...prev].slice(0, 5);
          });
        }

        setMachines(dashData.machines || []);
        setAlerts(dashData.alerts || []);
        
        if (!selectedId && dashData.machines && dashData.machines.length > 0) {
          setSelectedId(dashData.machines[0].id);
        }

        const prodRes = await fetch('/api/production');
        const prodData = await prodRes.json();
        setProduction(Array.isArray(prodData) ? prodData : []);
      } catch (e) {
        console.error("Polling error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Fetch Detail
  useEffect(() => {
    if (!selectedId) return;
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/machine/${selectedId}`);
        setDetail(await res.json());
      } catch (e) {}
    };
    fetchDetail();
    const interval = setInterval(fetchDetail, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  if (loading) return (
    <div className="min-h-screen bg-[#0F1115] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
        <span className="text-sky-500 font-mono text-xs tracking-[0.3em] uppercase animate-pulse">Initializing PrintOps SaaS</span>
      </div>
    </div>
  );

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName || !newMachineIp) return;
    
    // IP Validation
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(newMachineIp)) {
      alert('Please enter a valid IPv4 address (e.g., 192.168.1.50)');
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMachineName,
          ip: newMachineIp,
          isSC170: newMachineIsSC170
        })
      });
      
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewMachineName('');
        setNewMachineIp('');
        setNewMachineIsSC170(false);
        // The polling will automatically pick up the new machine
      } else {
        alert('Failed to add machine');
      }
    } catch (e) {
      console.error(e);
      alert('Error adding machine');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!selectedId) return;
    if (!confirm('Are you sure you want to delete this machine? This will also delete all its history and logs.')) return;

    try {
      const res = await fetch(`/api/machines/${selectedId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedId(null);
        setDetail(null);
      } else {
        alert('Failed to delete machine');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting machine');
    }
  };

  const selectedMachine = machines?.find(m => m.id === selectedId);

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 selection:bg-sky-500/30">
      {/* Add Machine Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#151921] border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Add New Machine</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddMachine} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Machine Name</label>
                  <input 
                    type="text" 
                    required
                    value={newMachineName}
                    onChange={e => setNewMachineName(e.target.value)}
                    placeholder="e.g. Revoria SC170"
                    className="w-full bg-[#0F1115] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">IP Address</label>
                  <input 
                    type="text" 
                    required
                    value={newMachineIp}
                    onChange={e => setNewMachineIp(e.target.value)}
                    placeholder="e.g. 192.168.1.201"
                    className="w-full bg-[#0F1115] border border-slate-800 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-500">Must be accessible by the Local Agent on your LAN.</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="isSC170"
                    checked={newMachineIsSC170}
                    onChange={e => setNewMachineIsSC170(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-800 bg-[#0F1115] text-sky-500 focus:ring-sky-500 focus:ring-offset-[#151921]"
                  />
                  <label htmlFor="isSC170" className="text-sm font-medium text-slate-300">
                    This is a Revoria SC170 (Enable Job Queue monitoring)
                  </label>
                </div>

                <div className="pt-6 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isAdding}
                    className="flex-1 py-3 px-4 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAdding ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add Machine
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-[#151921] border-r border-slate-800/50 z-50 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
          <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/20">
            <Printer className="w-6 h-6 text-sky-500" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white hidden lg:block">PrintOps</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === 'dashboard' ? "bg-sky-500/10 text-sky-500" : "text-slate-400 hover:bg-slate-800/50"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="hidden lg:block">Dashboard</span>
          </button>
          <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:bg-slate-800/50 rounded-xl font-bold transition-all">
            <Activity className="w-5 h-5" />
            <span className="hidden lg:block">Analytics</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all",
              activeTab === 'history' ? "bg-sky-500/10 text-sky-500" : "text-slate-400 hover:bg-slate-800/50"
            )}
          >
            <History className="w-5 h-5" />
            <span className="hidden lg:block">Machine History</span>
          </button>
          <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:bg-slate-800/50 rounded-xl font-bold transition-all">
            <Settings className="w-5 h-5" />
            <span className="hidden lg:block">Settings</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button className="w-full flex items-center gap-4 px-4 py-3 text-rose-500 hover:bg-rose-500/10 rounded-xl font-bold transition-all">
            <LogOut className="w-5 h-5" />
            <span className="hidden lg:block">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="pl-20 lg:pl-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#0F1115]/80 backdrop-blur-xl border-b border-slate-800/50 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">
              {activeTab === 'dashboard' ? 'Fleet Overview' : 'Machine History'}
            </h1>
            <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Real-time</span>
            </div>
          </div>
          
          {/* Notifications Overlay */}
          <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                  className={cn(
                    "pointer-events-auto p-4 rounded-2xl border shadow-2xl min-w-[300px] max-w-md flex gap-3",
                    n.type === 'error' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  )}
                >
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest mb-1">{n.type} Alert</p>
                    <p className="text-xs text-slate-200 font-medium">{n.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-6 px-6 py-2 bg-slate-800/30 rounded-2xl border border-slate-800/50">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active</span>
                <span className="text-sm font-bold text-white">{machines?.filter(m => m.status === 'running').length || 0}</span>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alerts</span>
                <span className="text-sm font-bold text-rose-500">{alerts?.length || 0}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10 space-y-10">
          {activeTab === 'dashboard' ? (
            <>
              {/* Alerts Panel */}
              {alerts?.length > 0 && (
                <section className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                      <h2 className="font-bold text-rose-500 uppercase tracking-widest text-xs">Critical Alerts</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {alerts.map((alert, i) => (
                        <div key={i} className="flex items-start gap-3 p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <p className="text-xs text-rose-200 font-medium leading-relaxed">{alert.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Machine Grid & Detail Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Machine List */}
                <div className="xl:col-span-4 space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Fleet List</h2>
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="text-[10px] font-bold text-sky-500 hover:text-sky-400 uppercase tracking-widest transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Machine
                    </button>
                  </div>
                  <div className="space-y-3">
                    {machines?.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-slate-800 rounded-2xl">
                        <p className="text-sm text-slate-500 mb-3">No machines configured.</p>
                        <button 
                          onClick={() => setIsAddModalOpen(true)}
                          className="px-4 py-2 bg-sky-500/10 text-sky-500 rounded-xl text-xs font-bold hover:bg-sky-500/20 transition-colors"
                        >
                          Add your first machine
                        </button>
                      </div>
                    ) : (
                      machines?.map(m => (
                        <MachineCard 
                          key={m.id} 
                          machine={m} 
                          onClick={() => setSelectedId(m.id)}
                          isActive={selectedId === m.id}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Detail View */}
                <div className="xl:col-span-8 space-y-8">
                  {detail && selectedMachine ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      {/* Detail Header */}
                      <div className="flex items-center justify-between bg-[#151921] p-6 rounded-3xl border border-slate-800/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center border border-sky-500/20">
                            <Printer className="w-6 h-6 text-sky-500" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-white">{selectedMachine.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-400 font-mono">{selectedMachine.ip}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {selectedMachine.isSC170 ? 'Revoria SC170' : 'Standard Printer'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={handleDeleteMachine}
                          className="px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                        >
                          <XCircle className="w-4 h-4" /> Delete
                        </button>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#151921] p-6 rounded-3xl border border-slate-800/50 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Counter</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">{selectedMachine.lastCounter?.toLocaleString()}</span>
                            <span className="text-xs text-emerald-500 font-bold">+12%</span>
                          </div>
                        </div>
                        <div className="bg-[#151921] p-6 rounded-3xl border border-slate-800/50 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                          <div className="pt-1">
                            <StatusIndicator status={selectedMachine.status} />
                          </div>
                        </div>
                        <div className="bg-[#151921] p-6 rounded-3xl border border-slate-800/50 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Seen</span>
                          <div className="text-lg font-bold text-white">
                            {formatDistanceToNow(new Date(selectedMachine.lastSeen?.seconds * 1000 || Date.now()), { addSuffix: true })}
                          </div>
                        </div>
                      </div>

                      {/* Chart & Consumables */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Production Chart */}
                        <div className="bg-[#151921] p-8 rounded-3xl border border-slate-800/50 space-y-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white">Production Trend</h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <div className="w-2 h-2 rounded-full bg-sky-500" />
                              <span>Prints</span>
                            </div>
                          </div>
                          <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={(detail?.logs || []).slice(0, 20).reverse().map((l: any) => ({
                                time: format(new Date(l.createdAt?.seconds * 1000 || Date.now()), 'HH:mm'),
                                val: l.counter
                              }))}>
                                <defs>
                                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                                  itemStyle={{ color: '#0ea5e9' }}
                                />
                                <Area type="monotone" dataKey="val" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Consumables */}
                        <div className="bg-[#151921] p-8 rounded-3xl border border-slate-800/50 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-sky-500/10 rounded-xl">
                              <Droplets className="w-5 h-5 text-sky-500" />
                            </div>
                            <h3 className="font-bold text-white">Supply Levels</h3>
                          </div>
                          <div className="space-y-6">
                            {detail?.consumables?.map((c: any, i: number) => (
                              <ConsumableBar key={i} name={c.name} level={c.level} />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Job History (SC170 Only) */}
                      {selectedMachine.name.includes('SC170') && (
                        <div className="bg-[#151921] rounded-3xl border border-slate-800/50 overflow-hidden">
                          <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
                            <h3 className="font-bold text-white">Active Job Queue</h3>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{detail?.jobs?.length || 0} Jobs</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                                  <th className="px-6 py-4">Job Name</th>
                                  <th className="px-6 py-4">Status</th>
                                  <th className="px-6 py-4">Time</th>
                                </tr>
                              </thead>
                              <tbody className="text-sm">
                                {detail?.jobs?.map((job: any, i: number) => (
                                  <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                                    <td className="px-6 py-4 font-bold text-white">{job.name}</td>
                                    <td className="px-6 py-4">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest",
                                        job.status === 'printing' ? "bg-sky-500/10 text-sky-500 border-sky-500/20" : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                      )}>
                                        {job.status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                      {format(new Date(job.createdAt?.seconds * 1000 || Date.now()), 'HH:mm:ss')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center p-20 bg-[#151921]/30 border border-dashed border-slate-800 rounded-3xl">
                      <div className="text-center space-y-4">
                        <Printer className="w-12 h-12 text-slate-700 mx-auto" />
                        <p className="text-slate-500 font-medium">Select a machine to view detailed analytics</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <section className="animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white">Machine History</h2>
                  <p className="text-slate-500 text-sm">Comprehensive historical logs for all fleet assets</p>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={selectedId || ''} 
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="bg-[#151921] border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    {machines?.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-[#151921] rounded-3xl border border-slate-800/50 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-800/50">
                      <h3 className="font-bold text-white">Historical Status & Counter Logs</h3>
                    </div>
                    <div className="overflow-x-auto flex-1 max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#151921] z-10">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                            <th className="px-6 py-4">Date & Time</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Counter</th>
                            <th className="px-6 py-4">Production</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {detail?.logs?.map((log: any, i: number) => {
                            const prevLog = detail.logs[i + 1];
                            const diff = prevLog ? log.counter - prevLog.counter : 0;
                            return (
                              <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                                <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                  {format(new Date(log.createdAt?.seconds * 1000 || Date.now()), 'MMM d, yyyy HH:mm:ss')}
                                </td>
                                <td className="px-6 py-4">
                                  <StatusBadge status={log.status} />
                                </td>
                                <td className="px-6 py-4 font-bold text-white">{log.counter.toLocaleString()}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "text-xs font-bold",
                                    diff > 0 ? "text-emerald-500" : "text-slate-500"
                                  )}>
                                    {diff > 0 ? `+${diff}` : '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-sky-500/5 border border-sky-500/20 rounded-3xl p-6 h-fit">
                    <div className="flex items-center gap-3 mb-4">
                      <TrendingUp className="w-5 h-5 text-sky-500" />
                      <h3 className="font-bold text-sky-500 uppercase tracking-widest text-xs">Production Summary</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">Total Lifetime Prints</span>
                        <span className="text-sm font-bold text-white">{selectedMachine?.lastCounter?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">Avg. Daily Production</span>
                        <span className="text-sm font-bold text-emerald-500">~1,240</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Job History */}
                  <div className="bg-[#151921] rounded-3xl border border-slate-800/50 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
                      <h3 className="font-bold text-white">Job History</h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{detail?.jobs?.length || 0} Records</span>
                    </div>
                    <div className="overflow-x-auto flex-1 max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#151921] z-10">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                            <th className="px-6 py-4">Date & Time</th>
                            <th className="px-6 py-4">Job Name</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {detail?.jobs?.length > 0 ? detail.jobs.map((job: any, i: number) => (
                            <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                              <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                {format(new Date(job.createdAt?.seconds * 1000 || Date.now()), 'MMM d, HH:mm:ss')}
                              </td>
                              <td className="px-6 py-4 font-bold text-white">{job.name}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest",
                                  job.status === 'printing' ? "bg-sky-500/10 text-sky-500 border-sky-500/20" : 
                                  job.status === 'error' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                  "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                )}>
                                  {job.status}
                                </span>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-xs">No job history available for this machine.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Consumable History */}
                  <div className="bg-[#151921] rounded-3xl border border-slate-800/50 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
                      <h3 className="font-bold text-white">Consumable History</h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{detail?.consumableLogs?.length || 0} Records</span>
                    </div>
                    <div className="overflow-x-auto flex-1 max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#151921] z-10">
                          <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                            <th className="px-6 py-4">Date & Time</th>
                            <th className="px-6 py-4">Consumable</th>
                            <th className="px-6 py-4">Level</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {detail?.consumableLogs?.length > 0 ? detail.consumableLogs.map((log: any, i: number) => (
                            <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                              <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                {format(new Date(log.createdAt?.seconds * 1000 || Date.now()), 'MMM d, HH:mm:ss')}
                              </td>
                              <td className="px-6 py-4 font-bold text-white">{log.name}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    "font-mono text-xs font-bold",
                                    log.level < 20 ? "text-rose-500" : "text-sky-500"
                                  )}>{log.level}%</span>
                                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full", log.level < 20 ? "bg-rose-500" : "bg-sky-500")}
                                      style={{ width: `${log.level}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-xs">No consumable history available.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
