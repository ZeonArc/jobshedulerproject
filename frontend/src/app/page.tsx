'use client';
import { useEffect, useState, useMemo } from 'react';
import { Activity, Plus, Layers, CheckCircle, XCircle, Clock, Zap, Play, Pause, RefreshCw, LogOut, Key, User, Cpu, BarChart3, Database, Server, FolderRoot, ChevronDown, Sparkles } from 'lucide-react';
import io from 'socket.io-client';
import ReactFlow, { Background, Controls, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queues' | 'jobs' | 'workers' | 'workflow'>('queues');
  
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  
  const [aiModalState, setAiModalState] = useState<{show: boolean, jobId: string | null, summary: string, analyzing: boolean}>({ show: false, jobId: null, summary: '', analyzing: false });

  // Forms
  const [jobForm, setJobForm] = useState<{ queueId: string, url: string, method: string, priority: number, retryStrategy: string, dependsOn: string[] }>({ queueId: '', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST', priority: 0, retryStrategy: 'exponential', dependsOn: [] });
  const [queueForm, setQueueForm] = useState({ name: '', concurrencyLimit: 10, rateLimit: '' });
  const [projectForm, setProjectForm] = useState({ name: '' });
  const [authForm, setAuthForm] = useState({ email: 'intern@example.com', password: 'password123', isLogin: true });

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) setToken(savedToken);
  }, []);

  const fetchData = async () => {
    if (!token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [projectsRes, jobsRes, workersRes] = await Promise.all([
        fetch(`${API_URL}/projects`, { headers }),
        fetch(`${API_URL}/jobs?limit=500`, { headers }),
        fetch(`${API_URL}/workers`, { headers })
      ]);

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
        if (projectsData.length > 0 && !activeProjectId) {
          setActiveProjectId(projectsData[0].id);
        }
      }
      
      if (jobsRes.ok) setAllJobs(await jobsRes.json());
      if (workersRes.ok) setWorkers(await workersRes.json());
      
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Replaced polling with WebSockets! No more setInterval.
  }, [token, activeProjectId]);

  useEffect(() => {
    if (!token) return;
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('jobUpdated', () => {
      fetchData();
    });

    newSocket.on('jobProgress', (data: { id: string, progress: number }) => {
      setAllJobs(prev => prev.map(job => job.id === data.id ? { ...job, progress: data.progress } : job));
    });

    return () => { newSocket.disconnect(); };
  }, [token]);

  // Derived Project State
  const activeProject = projects.find(p => p.id === activeProjectId);
  const queues = activeProject?.queues || [];
  
  // Scoped Jobs
  const jobs = useMemo(() => {
    const validQueueIds = queues.map((q: any) => q.id);
    return allJobs.filter(j => validQueueIds.includes(j.queueId));
  }, [allJobs, queues]);

  // Derived Stats
  const stats = useMemo(() => {
    const activeWorkers = workers.filter(w => new Date().getTime() - new Date(w.lastHeartbeatAt).getTime() <= 60000).length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const runningJobs = jobs.filter(j => j.status === 'running').length;
    return { activeWorkers, completedJobs, runningJobs, totalQueues: queues.length };
  }, [jobs, workers, queues]);

  const handleAuth = async (e: any) => {
    e.preventDefault();
    const endpoint = authForm.isLogin ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (err) {
      alert('Network error during authentication');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const handleCreateProject = async (e: any) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: projectForm.name })
      });
      const newProj = await res.json();
      setActiveProjectId(newProj.id);
      setShowProjectModal(false);
      setShowProjectDropdown(false);
      setProjectForm({ name: '' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreateQueue = async (e: any) => {
    e.preventDefault();
    if (!activeProjectId) return alert("Please create a project first");
    try {
      const res = await fetch(`${API_URL}/queues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          name: queueForm.name, 
          projectId: activeProjectId, 
          concurrencyLimit: queueForm.concurrencyLimit,
          rateLimit: queueForm.rateLimit ? parseInt(queueForm.rateLimit) : undefined
        })
      });
      setShowQueueModal(false);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleCreateJob = async (e: any) => {
    e.preventDefault();
    if (!jobForm.queueId) return alert("Select a queue first!");
    try {
      await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          queueId: jobForm.queueId,
          payload: { url: jobForm.url, method: jobForm.method },
          priority: Number(jobForm.priority),
          retryStrategy: jobForm.retryStrategy,
          dependsOn: jobForm.dependsOn
        })
      });
      setShowJobModal(false);
      setJobForm({ ...jobForm, dependsOn: [] }); // reset dependencies
      fetchData();
    } catch (err) { console.error(err); }
  };

  const toggleQueue = async (id: string, isPaused: boolean) => {
    await fetch(`${API_URL}/queues/${id}/${isPaused ? 'resume' : 'pause'}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const retryJob = async (id: string) => {
    await fetch(`${API_URL}/jobs/${id}/retry`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  const analyzeJob = async (id: string) => {
    setAiModalState({ show: true, jobId: id, summary: '', analyzing: true });
    try {
      const res = await fetch(`${API_URL}/jobs/${id}/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAiModalState({ show: true, jobId: id, summary: data.summary, analyzing: false });
    } catch (err) {
      setAiModalState({ show: true, jobId: id, summary: "Failed to connect to AI analysis endpoint.", analyzing: false });
    }
  };

  // --- UI HELPERS ---
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle className="w-3.5 h-3.5" /> Completed</span>;
      case 'failed': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> Failed</span>;
      case 'dead_letter': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20"><XCircle className="w-3.5 h-3.5" /> Dead Letter</span>;
      case 'running': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Activity className="w-3.5 h-3.5 animate-pulse" /> Running</span>;
      case 'queued': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Queued</span>;
      case 'waiting': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"><Clock className="w-3.5 h-3.5 opacity-75" /> Waiting (DAG)</span>;
      default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">{status}</span>;
    }
  };

  // --- RENDER LOGIN SCREEN ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-slate-300 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/10 relative z-10">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-3 rounded-xl shadow-lg shadow-indigo-500/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center text-white mb-2 tracking-tight">JobSheduler</h2>
          <p className="text-center text-slate-400 mb-8">{authForm.isLogin ? 'Sign in to your workspace' : 'Create a new account'}</p>
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" />
                <input 
                  type="email" required
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-black/40 outline-none transition-all"
                  value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Key className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" />
                <input 
                  type="password" required
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-black/40 outline-none transition-all"
                  value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-[0.98]">
              {authForm.isLogin ? 'Access Dashboard' : 'Create Account'}
            </button>
          </form>
          <div className="mt-8 text-center text-sm text-slate-400">
            {authForm.isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setAuthForm({...authForm, isLogin: !authForm.isLogin})} className="text-indigo-400 font-semibold hover:text-indigo-300 hover:underline transition-colors">
              {authForm.isLogin ? 'Register now' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <main className="min-h-screen bg-[#0B0F19] text-slate-300 font-sans selection:bg-indigo-500/30 pb-20">
      
      {/* Top Navbar */}
      <nav className="border-b border-white/5 sticky top-0 z-20 bg-[#0B0F19]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              
              <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                <div className="bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">JobSheduler</h1>
              </div>

              {/* Project Selector */}
              <div className="relative">
                <button 
                  onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <FolderRoot className="w-4 h-4 text-indigo-400" />
                  {activeProject ? activeProject.name : 'Select Project'}
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
                
                {showProjectDropdown && (
                  <div className="absolute top-full mt-2 w-64 bg-[#111827] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 pb-2 mb-2 border-b border-white/5">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Projects</span>
                    </div>
                    {projects.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { setActiveProjectId(p.id); setShowProjectDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${p.id === activeProjectId ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        {p.name}
                        {p.id === activeProjectId && <CheckCircle className="w-4 h-4" />}
                      </button>
                    ))}
                    <div className="px-2 mt-2 pt-2 border-t border-white/5">
                      <button 
                        onClick={() => setShowProjectModal(true)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors rounded-lg flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Create New Project
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => setShowQueueModal(true)} className="flex items-center gap-2 text-sm font-medium text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-lg transition-all shadow-sm">
                <Layers className="w-4 h-4" /> New Queue
              </button>
              <button onClick={() => setShowJobModal(true)} className="flex items-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                <Plus className="w-4 h-4" /> Enqueue Job
              </button>
              <div className="w-px h-6 bg-white/10 mx-2"></div>
              <button onClick={handleLogout} className="flex items-center justify-center p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:bg-white/[0.07] transition-colors">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Project Queues</p>
              <p className="text-2xl font-bold text-white">{stats.totalQueues}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:bg-white/[0.07] transition-colors">
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Running Jobs</p>
              <p className="text-2xl font-bold text-white">{stats.runningJobs}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:bg-white/[0.07] transition-colors">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Completed Jobs</p>
              <p className="text-2xl font-bold text-white">{stats.completedJobs}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:bg-white/[0.07] transition-colors">
            <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl border border-fuchsia-500/20">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Global Workers</p>
              <p className="text-2xl font-bold text-white">{stats.activeWorkers}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 mb-8 gap-8">
          <button onClick={() => setActiveTab('queues')} className={`pb-4 font-medium text-sm transition-all border-b-2 ${activeTab === 'queues' ? 'border-indigo-500 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <div className="flex items-center gap-2"><Database className="w-4 h-4"/> Queue Management</div>
          </button>
          <button onClick={() => setActiveTab('jobs')} className={`pb-4 font-medium text-sm transition-all border-b-2 ${activeTab === 'jobs' ? 'border-cyan-500 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Job Executions</div>
          </button>
          <button onClick={() => setActiveTab('workers')} className={`pb-4 font-medium text-sm transition-all border-b-2 ${activeTab === 'workers' ? 'border-fuchsia-500 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <div className="flex items-center gap-2"><Server className="w-4 h-4"/> Worker Cluster</div>
          </button>
          <button onClick={() => setActiveTab('workflow')} className={`pb-4 font-medium text-sm transition-all border-b-2 ${activeTab === 'workflow' ? 'border-emerald-500 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <div className="flex items-center gap-2"><Layers className="w-4 h-4"/> Workflow Graph</div>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'queues' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {queues.length === 0 ? (
              <div className="col-span-3 bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500">
                <Layers className="w-12 h-12 mb-4 text-slate-600" />
                <p className="text-lg">No queues in this project.</p>
                <p className="text-sm mt-1">Create one to start processing jobs.</p>
              </div>
            ) : (
              queues.map((q: any) => (
                <div key={q.id} className="bg-white/5 rounded-2xl border border-white/5 p-6 hover:border-white/10 transition-colors relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-full h-1 ${q.isPaused ? 'bg-amber-500/50' : 'bg-emerald-500/50'}`}></div>
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-white text-lg tracking-tight flex items-center gap-2">
                        {q.name}
                        {q.rateLimit && (
                          <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-0.5">
                            <Zap className="w-3 h-3" /> {q.rateLimit}/min
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-1">{q.id}</p>
                    </div>
                    <button onClick={() => toggleQueue(q.id, q.isPaused)} className={`p-2 rounded-xl transition-all ${q.isPaused ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`} title={q.isPaused ? 'Resume Queue' : 'Pause Queue'}>
                      {q.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Status</span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${q.isPaused ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {q.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Concurrency</span>
                      <span className="text-slate-300 font-mono text-sm bg-black/30 px-2 py-0.5 rounded-md border border-white/5">{q.concurrencyLimit} / tick</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'workers' && (
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/5">
                <thead className="bg-black/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Worker Node ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Hostname</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">State</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-transparent">
                  {workers.map((w: any) => {
                    const isStale = new Date().getTime() - new Date(w.lastHeartbeatAt).getTime() > 60000;
                    const status = isStale ? 'offline' : w.status;
                    return (
                    <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-400">{w.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">{w.hostname}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                          {status === 'active' ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {new Date(w.lastHeartbeatAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  )})}
                  {workers.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">No active worker nodes detected in the cluster.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/5">
                <thead className="bg-black/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Job ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Queue</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Attempts</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-transparent">
                   {jobs.length === 0 && (
                     <tr>
                       <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">No jobs found in this project's queues.</td>
                     </tr>
                   )}
                   {jobs.map((job: any) => {
                    const queueName = queues.find((q: any) => q.id === job.queueId)?.name || 'Unknown';
                    return (
                    <tr key={job.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-400">
                        {job.id.split('-')[0]}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
                        {queueName}
                        {job.dependencies && job.dependencies.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-1 flex gap-1">
                            Deps: {job.dependencies.map((d: any) => d.id.split('-')[0]).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-2">
                          {getStatusBadge(job.status)}
                          {job.status === 'running' && (
                            <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-white/5">
                              <div className="bg-cyan-500 h-1.5 transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{ width: `${job.progress || 0}%` }}></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1 font-mono">
                          <span className={job.attempts > 0 && job.status !== 'completed' ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                            {job.attempts}
                          </span>
                          <span className="text-slate-600">/ {job.maxRetries}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right flex justify-end gap-2">
                        {(job.status === 'failed' || job.status === 'dead_letter') && (
                          <>
                            {job.status === 'dead_letter' && (
                              <button onClick={() => analyzeJob(job.id)} className="text-fuchsia-400 hover:text-fuchsia-300 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold shadow-sm">
                                <Sparkles className="w-3.5 h-3.5" /> Analyze
                              </button>
                            )}
                            <button onClick={() => retryJob(job.id)} className="text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold shadow-sm">
                              <RefreshCw className="w-3.5 h-3.5" /> Requeue
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden h-[600px] shadow-2xl">
             {(() => {
                const nodes: Node[] = [];
                const edges: Edge[] = [];
                
                allJobs.forEach((job, index) => {
                  let bgColor = '#1e293b';
                  let borderColor = '#334155';
                  if (job.status === 'completed') { bgColor = '#064e3b'; borderColor = '#10b981'; }
                  if (job.status === 'running') { bgColor = '#164e63'; borderColor = '#06b6d4'; }
                  if (job.status === 'dead_letter') { bgColor = '#7f1d1d'; borderColor = '#ef4444'; }
                  if (job.status === 'waiting') { bgColor = '#4c1d95'; borderColor = '#8b5cf6'; }
                  
                  nodes.push({
                    id: job.id,
                    position: { x: (index % 4) * 280 + 50, y: Math.floor(index / 4) * 150 + 50 },
                    data: { label: (
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-xs">{job.id.split('-')[0]}</span>
                        <span className="text-[10px] mt-1 uppercase tracking-wider font-bold opacity-80">{job.status}</span>
                        {job.status === 'running' && (
                           <div className="w-full bg-black/50 mt-2 rounded-full h-1.5 overflow-hidden">
                             <div className="bg-cyan-500 h-1.5 transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{ width: `${job.progress || 0}%` }}></div>
                           </div>
                        )}
                      </div>
                    ) },
                    style: { background: bgColor, color: 'white', border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '12px', width: 180, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }
                  });
                  
                  if (job.dependencies) {
                    job.dependencies.forEach((dep: any) => {
                      edges.push({
                        id: `e-${dep.id}-${job.id}`,
                        source: dep.id,
                        target: job.id,
                        animated: job.status === 'waiting' || job.status === 'running',
                        style: { stroke: job.status === 'running' ? '#06b6d4' : (job.status === 'waiting' ? '#8b5cf6' : '#64748b'), strokeWidth: 2 }
                      });
                    });
                  }
                });

                return (
                  <ReactFlow nodes={nodes} edges={edges} fitView className="bg-[#0B0F19]">
                    <Background color="#334155" gap={20} />
                    <Controls className="bg-slate-800 text-white border-slate-700 fill-white" />
                  </ReactFlow>
                );
             })()}
          </div>
        )}

      </div>

      {/* --- MODALS --- */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl shadow-black max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><FolderRoot className="w-5 h-5 text-indigo-400"/> New Project</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name</label>
                <input 
                  type="text" required placeholder="e.g. Email Processing"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})}
                />
              </div>
              <div className="pt-5 mt-6 border-t border-white/5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowProjectModal(false)} className="px-4 py-2 font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJobModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl shadow-black max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-400"/> Dispatch New Job</h3>
              <button onClick={() => setShowJobModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateJob} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Queue</label>
                <select 
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                  value={jobForm.queueId} onChange={e => setJobForm({...jobForm, queueId: e.target.value})} required
                >
                  <option value="" disabled className="bg-slate-900">Select a Queue</option>
                  {queues.map((q: any) => <option key={q.id} value={q.id} className="bg-slate-900">{q.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Webhook URL</label>
                <input 
                  type="url" required placeholder="https://api.example.com/webhook"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={jobForm.url} onChange={e => setJobForm({...jobForm, url: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">HTTP Method</label>
                  <select 
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                    value={jobForm.method} onChange={e => setJobForm({...jobForm, method: e.target.value})}
                  >
                    <option className="bg-slate-900">POST</option><option className="bg-slate-900">GET</option><option className="bg-slate-900">PUT</option><option className="bg-slate-900">DELETE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority (0-10)</label>
                  <input 
                    type="number" min="0" max="10" required
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    value={jobForm.priority} onChange={e => setJobForm({...jobForm, priority: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Retry Strategy</label>
                <select 
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none"
                  value={jobForm.retryStrategy} onChange={e => setJobForm({...jobForm, retryStrategy: e.target.value})}
                >
                  <option value="exponential" className="bg-slate-900">Exponential Backoff</option>
                  <option value="linear" className="bg-slate-900">Linear Backoff</option>
                  <option value="fixed" className="bg-slate-900">Fixed Delay</option>
                </select>
              </div>
              
              {/* Workflow Dependencies (DAGs) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Upstream Dependencies (Optional)</label>
                <div className="w-full bg-black/20 border border-white/10 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                  {jobs.filter(j => j.status !== 'completed').length === 0 ? (
                    <div className="p-2 text-xs text-slate-500 text-center">No running/queued jobs to depend on.</div>
                  ) : (
                    jobs.filter(j => j.status !== 'completed').map(j => (
                      <label key={j.id} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors text-sm text-slate-300">
                        <input 
                          type="checkbox" 
                          className="rounded border-white/10 bg-black/50 text-indigo-500 focus:ring-indigo-500"
                          checked={jobForm.dependsOn.includes(j.id)}
                          onChange={(e) => {
                            if (e.target.checked) setJobForm({ ...jobForm, dependsOn: [...jobForm.dependsOn, j.id] });
                            else setJobForm({ ...jobForm, dependsOn: jobForm.dependsOn.filter(id => id !== j.id) });
                          }}
                        />
                        <span className="font-mono text-xs">{j.id.split('-')[0]}</span> - {getStatusBadge(j.status)}
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="pt-5 mt-6 border-t border-white/5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowJobModal(false)} className="px-4 py-2 font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQueueModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl shadow-black max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-400"/> Provision Queue</h3>
              <button onClick={() => setShowQueueModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateQueue} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Queue Name</label>
                <input 
                  type="text" required placeholder="e.g. email-delivery"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={queueForm.name} onChange={e => setQueueForm({...queueForm, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Concurrency Limit (Jobs per tick)</label>
                <input 
                  type="number" min="1" max="100" required
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={queueForm.concurrencyLimit} onChange={e => setQueueForm({...queueForm, concurrencyLimit: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Rate Limit (Jobs per minute, Optional)</label>
                <input 
                  type="number" min="1" placeholder="e.g. 60"
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  value={queueForm.rateLimit} onChange={e => setQueueForm({...queueForm, rateLimit: e.target.value})}
                />
              </div>
              <div className="pt-5 mt-6 border-t border-white/5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowQueueModal(false)} className="px-4 py-2 font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)]">Create Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {aiModalState.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(217,70,239,0.15)] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-400"/> AI Failure Analysis</h3>
              <button onClick={() => setAiModalState({...aiModalState, show: false})} className="text-slate-500 hover:text-slate-300 transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              {aiModalState.analyzing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-400 text-sm animate-pulse">Analyzing error stacktrace...</p>
                </div>
              ) : (
                <div className="bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Sparkles className="w-24 h-24 text-fuchsia-500" />
                  </div>
                  <p className="text-slate-300 leading-relaxed relative z-10">{aiModalState.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
