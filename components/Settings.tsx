import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Save, Database, Key, Server, CheckCircle, Youtube, Lock, Copy, Globe, AlertTriangle, ExternalLink, ArrowRight, RefreshCw } from 'lucide-react';
import { generateSchemaSQL, fetchSystemSettings, saveSystemSettings } from '../services/supabaseService';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    supabaseUrl: 'https://yirtnjaxbtenoqbyfkxe.supabase.co',
    supabaseKey: '********************',
    youtubeApiKey: '',
    googleClientId: '',
    maxConcurrentUploads: 2,
    uploadDelay: 5000,
    defaultVideoPath: ''
  });

  const [activeTab, setActiveTab] = useState<'general' | 'database'>('general');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    // 1. Load LocalStorage first (for non-sensitive configs like upload delay)
    const savedLocal = localStorage.getItem('tubeflow_settings');
    if (savedLocal) {
      setSettings(prev => ({ ...prev, ...JSON.parse(savedLocal) }));
    }
    
    // 2. Load API Keys from Database
    const loadFromDB = async () => {
      setIsLoading(true);
      try {
        const dbSettings = await fetchSystemSettings();
        if (dbSettings.youtubeApiKey || dbSettings.googleClientId) {
          setSettings(prev => ({
            ...prev,
            youtubeApiKey: dbSettings.youtubeApiKey,
            googleClientId: dbSettings.googleClientId
          }));
        }
      } catch (e) {
        console.error("Lỗi load settings từ DB:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadFromDB();

    // Check Origin & Iframe
    let origin = window.location.origin;
    if (origin.endsWith('/')) origin = origin.slice(0, -1);
    setCurrentOrigin(origin);

    // URL đầy đủ (bỏ hash/search) & Bỏ trailing slash để khớp với OAuth
    let url = window.location.origin + window.location.pathname;
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    setCurrentUrl(url);

    try {
      if (window.self !== window.top) {
        setIsIframe(true);
      }
    } catch (e) {
      setIsIframe(true);
    }
  }, []);

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 1. Save keys to DB
      await saveSystemSettings(settings.youtubeApiKey, settings.googleClientId);
      
      // 2. Save full config to LocalStorage (as cache)
      localStorage.setItem('tubeflow_settings', JSON.stringify(settings));
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      alert("Đã lưu cấu hình vào Database và LocalStorage!");
    } catch (e: any) {
      alert("Lỗi khi lưu vào Database: " + e.message + "\n(Hãy chắc chắn bạn đã tạo bảng global_settings trong Database)");
    } finally {
      setIsLoading(false);
    }
  };

  const sqlCode = generateSchemaSQL();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Đã copy!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-white">Cấu hình Hệ thống</h2>
         {isLoading && <div className="text-blue-400 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/> Đang đồng bộ DB...</div>}
      </div>

      {/* Warning nếu chạy trong iframe */}
      {isIframe && (
        <div className="bg-yellow-900/30 border border-yellow-700 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0 mt-1" />
          <div>
            <h4 className="text-yellow-400 font-bold">Cảnh báo môi trường Preview</h4>
            <p className="text-sm text-gray-300 mt-1">
              Ứng dụng đang chạy trong khung Preview (Iframe). Google OAuth thường <strong>chặn kết nối</strong> từ trong iframe.
            </p>
            <p className="text-sm text-white mt-2 font-semibold">
              👉 Hãy bấm nút "Open in new window" (hoặc Fullscreen) ở góc trên bên phải để mở App ra tab mới rồi mới kết nối.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700 flex gap-6">
        <button 
          onClick={() => setActiveTab('general')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${activeTab === 'general' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Chung & API Keys
        </button>
        <button 
          onClick={() => setActiveTab('database')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${activeTab === 'database' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          Cài đặt Database
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Keys */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-yellow-500" />
              Thông tin xác thực
            </h3>
            
            {/* Helper để lấy Origin đúng */}
            <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-blue-400 font-medium text-sm border-b border-blue-800 pb-2">
                <Globe className="w-4 h-4" />
                Cấu hình Google Cloud Console (Bắt buộc)
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-medium">1. Authorized JavaScript origins</p>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-black/30 p-2 rounded text-xs text-green-400 font-mono truncate border border-green-900/50">
                        {currentOrigin}
                        </code>
                        <button onClick={() => copyToClipboard(currentOrigin)} className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white" title="Copy Origin">
                        <Copy className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                        2. Authorized redirect URIs 
                        <span className="text-yellow-500 text-[10px] bg-yellow-900/30 px-1 rounded">(Dùng cho Redirect Mode)</span>
                    </p>
                    <p className="text-[10px] text-gray-500">Phải khớp chính xác từng ký tự (không có dấu / ở cuối).</p>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-black/30 p-2 rounded text-xs text-purple-400 font-mono truncate border border-purple-900/50">
                        {currentUrl}
                        </code>
                        <button onClick={() => copyToClipboard(currentUrl)} className="p-2 bg-purple-600 hover:bg-purple-700 rounded text-white" title="Copy Redirect URL">
                        <Copy className="w-3 h-3" />
                        </button>
                    </div>
                </div>
              </div>

              <div className="pt-2 border-t border-blue-800/50 text-[10px] text-gray-400 italic">
                 Lưu ý: Sau khi Save trên Google Console, phải chờ 5-10 phút để hệ thống cập nhật.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                YouTube Data API Key
              </label>
              <input 
                type="password" 
                value={settings.youtubeApiKey}
                onChange={(e) => handleChange('youtubeApiKey', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                placeholder="AIzaSy... (Lưu vào DB)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-500" />
                Google OAuth 2.0 Client ID
              </label>
              <input 
                type="text" 
                value={settings.googleClientId}
                onChange={(e) => handleChange('googleClientId', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                placeholder="xxx.apps.googleusercontent.com (Lưu vào DB)"
              />
            </div>
          </div>

          {/* Upload Config */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-green-500" />
              Cấu hình Engine
            </h3>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Số luồng upload song song</label>
              <input 
                type="number" 
                value={settings.maxConcurrentUploads}
                onChange={(e) => handleChange('maxConcurrentUploads', parseInt(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
            
            <div className="bg-green-900/20 border border-green-800 p-3 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-400">Database đã được kết nối (Supabase)</p>
                <p className="text-xs text-gray-400 truncate w-64">{settings.supabaseUrl}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isLoading}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition ${isSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
              {isSaved ? 'Đã lưu cấu hình' : 'Lưu Cấu Hình (Lên DB)'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-900/20 border border-blue-900 p-4 rounded-lg flex items-start gap-3">
             <Database className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
             <div>
               <h4 className="text-blue-400 font-semibold">Khởi tạo Database</h4>
               <p className="text-sm text-gray-300 mt-1">
                 Copy đoạn mã SQL dưới đây và chạy trong <strong>Supabase SQL Editor</strong> để tạo các bảng cần thiết (bao gồm bảng lưu Keys mới).
               </p>
             </div>
          </div>

          <div className="relative group">
            <div className="absolute top-3 right-3">
              <button 
                onClick={() => copyToClipboard(sqlCode)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 text-xs rounded shadow-lg transition"
              >
                Copy SQL
              </button>
            </div>
            <pre className="bg-gray-950 p-6 rounded-xl border border-gray-800 text-gray-300 font-mono text-sm overflow-x-auto h-[400px]">
              {sqlCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;