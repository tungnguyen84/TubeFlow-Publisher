
import React, { useState, useEffect } from 'react';
import { LinkAsset, VideoItem } from '../types';
import { fetchLinkAssets, saveLinkAsset, deleteLinkAsset, fetchVideos, bulkUpdateVideos } from '../services/supabaseService';
import { Link, Plus, Trash2, Edit3, Save, Search, RefreshCw, BarChart2 } from 'lucide-react';

const GrowthTools: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'LINKS' | 'AB_TESTING'>('LINKS');

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-green-500" />
                Growth Hacking Tools
            </h2>
            
            <div className="flex border-b border-gray-700 space-x-6">
                <button onClick={() => setActiveTab('LINKS')} className={`pb-2 ${activeTab === 'LINKS' ? 'border-b-2 border-green-500 text-green-400' : 'text-gray-400'}`}>Link Manager (Affiliate)</button>
                <button onClick={() => setActiveTab('AB_TESTING')} className={`pb-2 ${activeTab === 'AB_TESTING' ? 'border-b-2 border-green-500 text-green-400' : 'text-gray-400'}`}>A/B Testing (Simulation)</button>
            </div>

            {activeTab === 'LINKS' ? <LinkManager /> : <ABTestSimulator />}
        </div>
    );
};

const LinkManager = () => {
    const [links, setLinks] = useState<LinkAsset[]>([]);
    const [newLink, setNewLink] = useState({ name: '', url: '', description: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [bulkReplaceStatus, setBulkReplaceStatus] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const [l, v] = await Promise.all([fetchLinkAssets(), fetchVideos({ status: 'DRAFT', limit: 2000 })]);
        setLinks(l);
        setVideos(v);
        setIsLoading(false);
    }

    const handleAdd = async () => {
        if(!newLink.name || !newLink.url) return alert("Nhập Tên và URL!");
        await saveLinkAsset(newLink);
        setNewLink({ name: '', url: '', description: '' });
        loadData();
    }

    const handleDelete = async (id: string) => {
        if(confirm("Xóa link này?")) {
            await deleteLinkAsset(id);
            loadData();
        }
    }

    const handleBulkInject = async (link: LinkAsset) => {
        const confirmMsg = `Bạn có muốn chèn link "${link.name}" vào cuối mô tả của ${videos.length} video DRAFT không?`;
        if(!confirm(confirmMsg)) return;

        setBulkReplaceStatus('Processing...');
        try {
            const updates = videos.map(v => ({
                id: v.id,
                desc_template: (v.metadata.description || '') + `\n\n${link.description || link.name}: ${link.url}`
            }));
            
            // Chunk updates if needed, for now loop
            for(const u of updates) {
                await bulkUpdateVideos([u.id], { desc_template: u.desc_template });
            }
            alert("Đã cập nhật xong!");
            loadData(); // refresh videos
        } catch(e: any) {
            alert("Lỗi: " + e.message);
        } finally {
            setBulkReplaceStatus('');
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <h3 className="font-bold text-white mb-3">Thêm Link Mới</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={newLink.name} onChange={e => setNewLink({...newLink, name: e.target.value})} placeholder="Tên (VD: Shopee)" className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                    <input value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} placeholder="URL (https://...)" className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                    <input value={newLink.description} onChange={e => setNewLink({...newLink, description: e.target.value})} placeholder="Mô tả ngắn (Optional)" className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" />
                </div>
                <button onClick={handleAdd} className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4"/> Lưu Link
                </button>
            </div>

            <div className="space-y-2">
                {links.map(link => (
                    <div key={link.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-white">{link.name}</h4>
                            <a href={link.url} target="_blank" className="text-blue-400 text-sm hover:underline">{link.url}</a>
                            {link.description && <p className="text-gray-500 text-xs">{link.description}</p>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleBulkInject(link)} className="px-3 py-1.5 bg-blue-900/50 text-blue-400 border border-blue-800 rounded text-xs hover:bg-blue-900" title="Chèn vào tất cả Draft Video">
                                {bulkReplaceStatus ? '...' : 'Bulk Inject'}
                            </button>
                            <button onClick={() => handleDelete(link.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                ))}
                {links.length === 0 && <p className="text-gray-500 text-center">Chưa có link nào.</p>}
            </div>
        </div>
    )
}

const ABTestSimulator = () => {
    return (
        <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center">
            <RefreshCw className="w-12 h-12 text-yellow-500 mx-auto mb-4"/>
            <h3 className="text-xl font-bold text-white mb-2">A/B Testing Simulator</h3>
            <p className="text-gray-400 mb-4 max-w-md mx-auto">
                Tính năng này yêu cầu Backend Server chạy liên tục để thay đổi Title/Thumbnail sau mỗi 24h dựa trên chỉ số CTR thực tế từ YouTube API.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-800 p-4 rounded text-left mx-auto max-w-lg">
                <p className="text-yellow-400 font-bold mb-2">Cơ chế hoạt động:</p>
                <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>Bước 1: Upload Video với Option A.</li>
                    <li>Bước 2: Sau 24h, check CTR (Click-Through Rate).</li>
                    <li>Bước 3: Đổi sang Option B.</li>
                    <li>Bước 4: Sau 24h tiếp theo, so sánh CTR của A và B.</li>
                    <li>Bước 5: Giữ lại Option có CTR cao nhất vĩnh viễn.</li>
                </ul>
            </div>
            <button className="mt-6 bg-gray-700 text-gray-400 px-6 py-2 rounded cursor-not-allowed" disabled>
                Cần Backend Server để kích hoạt
            </button>
        </div>
    )
}

export default GrowthTools;
