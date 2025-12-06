
import React, { useState, useEffect } from 'react';
import { ProxyItem } from '../types';
import { Network, Shield, Trash2, Plus, Globe, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { fetchProxies, saveProxy, deleteProxy } from '../services/supabaseService';

const ProxyManager: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form Data
  const [formData, setFormData] = useState<Partial<ProxyItem>>({
      ip: '',
      port: 8080,
      protocol: 'http',
      username: '',
      password: '',
      location: 'VN'
  });

  const loadData = async () => {
      setIsLoading(true);
      const data = await fetchProxies();
      setProxies(data);
      setIsLoading(false);
  };

  useEffect(() => {
      loadData();
  }, []);

  const handleSave = async () => {
      if (!formData.ip || !formData.port) return alert("Vui lòng nhập IP và Port");
      try {
          await saveProxy(formData);
          setIsModalOpen(false);
          setFormData({ ip: '', port: 8080, protocol: 'http', username: '', password: '', location: 'VN' });
          loadData();
      } catch (e: any) {
          alert("Lỗi lưu Proxy: " + e.message);
      }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Xóa Proxy này? Các kênh đang dùng sẽ mất kết nối Proxy.")) {
          await deleteProxy(id);
          loadData();
      }
  };

  const checkProxy = (id: string) => {
      // Vì trình duyệt chặn request qua proxy tùy chỉnh (CORS/Safety), 
      // ta chỉ có thể mô phỏng check hoặc cần backend.
      // Ở đây chỉ cập nhật UI giả lập.
      alert("Lưu ý: Trình duyệt không thể trực tiếp kiểm tra kết nối qua Proxy do bảo mật. Tính năng này cần Backend hoặc Desktop Agent để thực thi chính xác. Dữ liệu đã được lưu vào DB để sử dụng.");
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-green-500" />
            Quản Lý Proxy
          </h2>
          <p className="text-gray-400 text-sm mt-1">Gán IP riêng cho từng kênh để tránh checkpoint khi nuôi nhiều kênh.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
            <Plus className="w-5 h-5" /> Thêm Proxy
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {proxies.length === 0 ? (
             <div className="p-8 text-center text-gray-500">Chưa có Proxy nào. Hãy thêm mới.</div>
        ) : (
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-900/50 text-gray-400 text-sm border-b border-gray-700">
                        <th className="p-4 font-medium">Location</th>
                        <th className="p-4 font-medium">IP : Port</th>
                        <th className="p-4 font-medium">Protocol</th>
                        <th className="p-4 font-medium">Auth (User/Pass)</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 text-sm">
                    {proxies.map(p => (
                        <tr key={p.id} className="hover:bg-gray-750">
                            <td className="p-4">
                                <span className="flex items-center gap-2 text-white font-medium">
                                    <Globe className="w-4 h-4 text-blue-400" /> {p.location}
                                </span>
                            </td>
                            <td className="p-4 text-white font-mono">{p.ip}:{p.port}</td>
                            <td className="p-4">
                                <span className="bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-300 uppercase">{p.protocol}</span>
                            </td>
                            <td className="p-4 text-gray-400">
                                {p.username ? (
                                    <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-yellow-500"/> Có</span>
                                ) : (
                                    <span>Không</span>
                                )}
                            </td>
                            <td className="p-4">
                                <span className={`flex items-center gap-1 ${p.status === 'ACTIVE' ? 'text-green-400' : 'text-gray-500'}`}>
                                    {p.status === 'ACTIVE' ? <CheckCircle2 className="w-4 h-4"/> : <RefreshCw className="w-4 h-4"/>}
                                    {p.status}
                                </span>
                            </td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={() => checkProxy(p.id)} className="p-2 hover:bg-gray-700 rounded text-blue-400" title="Check Connection">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-900/30 rounded text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>

      {/* Modal Add Proxy */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 space-y-4">
                  <h3 className="text-xl font-bold text-white mb-4">Thêm Proxy Mới</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                          <label className="block text-xs text-gray-400 mb-1">IP Address</label>
                          <input 
                            value={formData.ip} 
                            onChange={e => setFormData({...formData, ip: e.target.value})} 
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" 
                            placeholder="192.168.1.1" 
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">Port</label>
                          <input 
                            type="number"
                            value={formData.port} 
                            onChange={e => setFormData({...formData, port: Number(e.target.value)})} 
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" 
                            placeholder="8080" 
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">Protocol</label>
                          <select 
                            value={formData.protocol} 
                            onChange={e => setFormData({...formData, protocol: e.target.value as any})}
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                          >
                              <option value="http">HTTP</option>
                              <option value="https">HTTPS</option>
                              <option value="socks4">SOCKS4</option>
                              <option value="socks5">SOCKS5</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">Quốc gia (Mã)</label>
                          <input 
                            value={formData.location} 
                            onChange={e => setFormData({...formData, location: e.target.value})} 
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" 
                            placeholder="VN, US..." 
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">Username (Optional)</label>
                          <input 
                            value={formData.username} 
                            onChange={e => setFormData({...formData, username: e.target.value})} 
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" 
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">Password (Optional)</label>
                          <input 
                            type="password"
                            value={formData.password} 
                            onChange={e => setFormData({...formData, password: e.target.value})} 
                            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" 
                          />
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Hủy</button>
                      <button onClick={handleSave} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium">Lưu Proxy</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ProxyManager;
