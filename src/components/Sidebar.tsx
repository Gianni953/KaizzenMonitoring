import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  FileText, 
  HardDrive,
  Shield,
  Settings,
  HelpCircle
} from 'lucide-react';
import logo from '../img/logo.png';

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Utilisateurs', icon: Users, path: '/users' },
  { name: 'Teams', icon: MessageSquare, path: '/teams' },
  { name: 'SharePoint', icon: FileText, path: '/sharepoint' },
  { name: 'OneDrive', icon: HardDrive, path: '/onedrive' },
  { name: 'Sécurité', icon: Shield, path: '/security' },
];

const secondaryNavigation = [
  { name: 'Paramètres', icon: Settings, path: '/settings' },
  { name: 'Centre d\'aide', icon: HelpCircle, path: '/help' },
];

const Sidebar = () => {
  return (
    <div className="w-64 flex-shrink-0 backdrop-blur-md bg-glass border-r border-glass-border z-10">
      <div className="flex flex-col items-center py-8 px-6 border-b border-glass-border">
        <img src={logo} alt="M365 Monitor" className="h-16 w-auto mb-4" />
      </div>
      
      <div className="h-[calc(100vh-8rem)] overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-neon'
                    : 'text-white/70 hover:bg-glass hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-glass-border">
          <div className="space-y-1">
            {secondaryNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className="flex items-center px-3 py-2.5 text-sm font-medium text-white/40 rounded-xl hover:bg-glass hover:text-white transition-all"
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;