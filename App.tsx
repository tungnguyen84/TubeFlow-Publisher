
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Radio, Clapperboard, CalendarClock, Settings as SettingsIcon, LogOut, UploadCloud, Network, TrendingUp, AlertTriangle, Sparkles, Zap, MessageCircle, Shield, Film, BarChart2, Layers } from 'lucide-react';
import { View, ChannelGroup } from './types';
import { fetchChannelGroups } from './services/supabaseService';

// Components
import Dashboard from './components/Dashboard';
import ChannelManager from './components/ChannelManager';
import VideoLibrary from './components/VideoLibrary';
import Scheduler from './components/Scheduler';
import UploadQueue from './components/UploadQueue';
import Settings from './components/Settings';
import Analytics from './components/Analytics';
import SystemLogs from './components/SystemLogs';
import AdvancedTools from './components/AdvancedTools';

// NEW COMPONENTS
import GrowthTools from './components/GrowthTools';
import CommunityHub from './components/CommunityHub';
import SafetyCenter from './components/SafetyCenter';
import ContentStudio from './components/ContentStudio';

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any; 
  label: string; 
  active: boolean; 
  onClick: () => void 
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg
      ${active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
  >
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // GLOBAL FILTER STATE (App-Level)
  const [activeGroupId, setActiveGroupId] = useState<string>(() => localStorage.getItem('activeGroupId') || '');
  const [groups, setGroups] = useState<ChannelGroup[]>([]);

  useEffect(() => {
      // Load Groups for Selector
      fetchChannelGroups().then(setGroups);
  }, []);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newVal = e.target.value;
      setActiveGroupId(newVal);
      localStorage.setItem('activeGroupId', newVal);
      // Optional: Refresh data by forcing remount or passing prop
  }

  const renderContent = () => {
    // Inject activeGroupId into components
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard selectedGroupId={activeGroupId} />;
      case View.CHANNELS:
        return <ChannelManager selectedGroupId={activeGroupId} />;
      case View.VIDEOS:
        return <VideoLibrary selectedGroupId={activeGroupId} />;
      case View.SCHEDULER:
        return <Scheduler selectedGroupId={activeGroupId} />;
      case View.QUEUE:
        return null; // Rendered persistently
      case View.ANALYTICS:
        return <Analytics />;
      case View.SYSTEM_LOGS:
        return <SystemLogs />;
      case View.SETTINGS:
        return <Settings />;
      case View.ADVANCED_TOOLS:
        return <AdvancedTools onNavigate={setCurrentView} />;
        
      case View.GROWTH_HACKING:
        return <GrowthTools />;
      case View.COMMUNITY_HUB:
        return <CommunityHub />;
      case View.SAFETY_CENTER:
        return <SafetyCenter />;
      case View.CONTENT_STUDIO:
        return <ContentStudio />;
        
      default:
        return <Dashboard selectedGroupId={activeGroupId} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            TF
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">TubeFlow</h1>
        </div>

        {/* --- GLOBAL PROFILE SELECTOR --- */}
        <div className="px-4 mb-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1 mb-1">
                    <Layers className="w-3 h-3" /> Profile / Nhóm Kênh
                </label>
                <select 
                    value={activeGroupId} 
                    onChange={handleGroupChange}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-600 rounded p-1.5 outline-none focus:border-blue-500"
                >
                    <option value="">-- Tất cả Profile --</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                {activeGroupId && <div className="text-[10px] text-green-500 mt-1 text-center">● Đang lọc theo nhóm</div>}
            </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <div className="text-xs font-bold text-gray-500 uppercase px-4 mt-2 mb-1">Core</div>
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={currentView === View.DASHBOARD}
            onClick={() => setCurrentView(View.DASHBOARD)}
          />
          <SidebarItem 
            icon={Radio} 
            label="Channels & Groups" 
            active={currentView === View.CHANNELS}
            onClick={() => setCurrentView(View.CHANNELS)}
          />
          <SidebarItem 
            icon={Clapperboard} 
            label="Video Library" 
            active={currentView === View.VIDEOS}
            onClick={() => setCurrentView(View.VIDEOS)}
          />
          <SidebarItem 
            icon={CalendarClock} 
            label="Scheduler" 
            active={currentView === View.SCHEDULER}
            onClick={() => setCurrentView(View.SCHEDULER)}
          />
          <SidebarItem 
            icon={UploadCloud} 
            label="Upload Queue" 
            active={currentView === View.QUEUE}
            onClick={() => setCurrentView(View.QUEUE)}
          />

          <div className="text-xs font-bold text-gray-500 uppercase px-4 mt-6 mb-1">Advanced</div>
          <SidebarItem 
            icon={BarChart2} 
            label="Growth Hacking" 
            active={currentView === View.GROWTH_HACKING}
            onClick={() => setCurrentView(View.GROWTH_HACKING)}
          />
          <SidebarItem 
            icon={MessageCircle} 
            label="Community Hub" 
            active={currentView === View.COMMUNITY_HUB}
            onClick={() => setCurrentView(View.COMMUNITY_HUB)}
          />
          <SidebarItem 
            icon={Shield} 
            label="Safety Center" 
            active={currentView === View.SAFETY_CENTER}
            onClick={() => setCurrentView(View.SAFETY_CENTER)}
          />
          <SidebarItem 
            icon={Film} 
            label="Content Studio" 
            active={currentView === View.CONTENT_STUDIO}
            onClick={() => setCurrentView(View.CONTENT_STUDIO)}
          />
          <SidebarItem 
            icon={TrendingUp} 
            label="Old Analytics" 
            active={currentView === View.ANALYTICS}
            onClick={() => setCurrentView(View.ANALYTICS)}
          />
          <SidebarItem 
            icon={Sparkles} 
            label="Old Tools" 
            active={currentView === View.ADVANCED_TOOLS}
            onClick={() => setCurrentView(View.ADVANCED_TOOLS)}
          />
        </nav>

        <div className="p-3 border-t border-gray-800">
          <SidebarItem 
            icon={AlertTriangle} 
            label="System Health" 
            active={currentView === View.SYSTEM_LOGS}
            onClick={() => setCurrentView(View.SYSTEM_LOGS)}
          />
          <SidebarItem 
            icon={SettingsIcon} 
            label="Settings" 
            active={currentView === View.SETTINGS}
            onClick={() => setCurrentView(View.SETTINGS)}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-950">
        <div className="max-w-7xl mx-auto p-8">
          {/* Persistent UploadQueue: Keeps running even when hidden */}
          {/* Important: Pass activeGroupId here so Auto Upload respects it */}
          <div className={currentView === View.QUEUE ? 'block' : 'hidden'}>
            <UploadQueue selectedGroupId={activeGroupId} />
          </div>
          
          {/* Other Views */}
          {currentView !== View.QUEUE && renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
