import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Calculator,
  LogOut,
  User,
  Warehouse,
  ShoppingBag,
  MessageCircle
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  user: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onLogout, user }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'sale', label: 'Point of Sale', icon: ShoppingBag },
    { id: 'invoices', label: 'All Invoices', icon: FileText },
    // { id: 'gst', label: 'GST Filing', icon: Calculator },
    { id: 'ai-chat', label: 'AI Assistant', icon: MessageCircle },
    { id: 'profile', label: 'Profile Settings', icon: User },
  ];

  return (
    <div className="bg-gray-900 text-white w-64 min-h-screen flex flex-col fixed lg:sticky lg:top-0 z-30 lg:z-auto">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm truncate">{user?.businessName}</h2>
            <p className="text-xs text-gray-400 truncate">{user?.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    activeTab === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Logout</span>
        </button>
      </div>
    </div>
  );
};