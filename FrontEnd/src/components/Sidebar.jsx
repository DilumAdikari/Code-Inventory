import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { confirmDialog } from './AppDialog';
import { 
  LayoutDashboard, Bell, FileText, DollarSign, Truck, FileClock, 
  Database, Settings, ChevronDown, Palette, Scale, Building2, LogOut, GitBranch, Users, Warehouse,
  ClipboardList, 
  UserCheck, 
  Shirt,
  ShoppingCart,
  Tag,
  FileBarChart, 
  RotateCcw,    // 🌟 GRN Return සඳහා අයිකන් එක
  PackageMinus  // 🌟 Goods Issue Report සඳහා අයිකන් එක
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate(); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPartnersOpen, setIsPartnersOpen] = useState(false);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false); 
  const [isReportsOpen, setIsReportsOpen] = useState(false); 

  const storedPermissions = JSON.parse(localStorage.getItem('userPermissions') || '{}');
  const userRole = localStorage.getItem('userRole');

  const hasAccess = (moduleName) => {
    if (userRole === 'Admin') return true; 
    if (moduleName === 'notifications') return true; 
    if (moduleName === 'stockOverview') return true; 
    return !!storedPermissions[moduleName];
  };

  // 🌟 Reports dropdown එක පෙන්වන්න — අඩුම තරමේ එක report එකකටවත් access තියෙනවා නම්
  const hasAnyReportAccess = hasAccess('grnHistory') || hasAccess('materialIssuing');

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard', permissionKey: 'dashboard' },
    { icon: <Bell size={20} />, label: 'Notifications', path: '/notifications', permissionKey: 'notifications' },
    { icon: <FileText size={20} />, label: 'Sales Orders', path: '/sales-orders', permissionKey: 'salesOrders' },
    { icon: <DollarSign size={20} />, label: 'Costing', path: '/costing', permissionKey: 'costing' },
    { icon: <ClipboardList size={20} />, label: 'Production Orders', path: '/production-orders', permissionKey: 'materialIssuing' },
    { icon: <ShoppingCart size={20} />, label: 'Purchasing', path: '/purchases', permissionKey: 'materialIssuing' },
    { icon: <Truck size={20} />, label: 'Material Issuing', path: '/material-issuing', permissionKey: 'materialIssuing' },
    { icon: <FileText size={20} />, label: 'Sales Invoices', path: '/invoices', permissionKey: 'materialIssuing' },
    { icon: <FileClock size={20} />, label: 'GRN History', path: '/grn-history', permissionKey: 'grnHistory' },
    // 🌟 GRN Return මෙනු අයිතමය GRN History එකට යටින් කෙලින්ම එකතු කළා
    { icon: <RotateCcw size={20} />, label: 'GRN Return', path: '/grn-return', permissionKey: 'grnHistory' },
    { icon: <Warehouse size={20} />, label: 'Live Stock Ledger', path: '/stock-overview', permissionKey: 'stockOverview' },
  ];

  const handleLogout = async () => {
    if (await confirmDialog("Are you sure you want to log out from the system?")) {
      localStorage.clear(); 
      navigate('/login'); 
    }
  };

  const closeOtherDropdowns = (current) => {
    if (current !== 'materials') setIsMaterialsOpen(false);
    if (current !== 'partners') setIsPartnersOpen(false);
    if (current !== 'settings') setIsSettingsOpen(false);
    if (current !== 'reports') setIsReportsOpen(false); 
  };

  return (
    <div className="h-screen bg-emerald-900 shadow-xl w-20 hover:w-64 transition-all duration-300 ease-in-out z-50 shrink-0 flex flex-col group justify-between sticky top-0 left-0 overflow-hidden select-none">
      
      {/* UPPER MAIN NAVIGATION BLOCK */}
      <div className="flex flex-col w-full h-full overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        
        {/* LOGO */}
        <div className="flex items-center h-20 px-6 border-b border-emerald-800/60 overflow-hidden shrink-0 w-full bg-emerald-900 sticky top-0 z-10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-emerald-900 font-bold shrink-0">E</div>
          <span className="ml-4 font-bold text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Elisha <span className="text-emerald-300">ERP</span>
          </span>
        </div>

        {/* MENU LIST */}
        <nav className="p-4 space-y-2 w-full pb-20">
          {menuItems.map((item, index) => {
            if (!hasAccess(item.permissionKey)) return null;

            return (
              <NavLink
                key={index}
                to={item.path}
                onClick={() => closeOtherDropdowns('none')}
                className={({ isActive }) => `flex items-center w-full px-3 py-3 rounded-xl transition-all duration-200 text-left overflow-hidden
                  ${isActive ? 'bg-emerald-950 text-white font-semibold' : 'text-white/90 hover:bg-emerald-800'}`}
              >
                <div className="shrink-0">{item.icon}</div>
                <span className="ml-4 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">{item.label}</span>
              </NavLink>
            );
          })}

          {/* MATERIALS & FINISHED GOODS DROPDOWN */}
          {hasAccess('materialRegistry') && (
            <div className="space-y-1 w-full">
              <button
                onClick={() => { setIsMaterialsOpen(!isMaterialsOpen); closeOtherDropdowns('materials'); }}
                className={`flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all duration-200 text-left text-white/90 hover:bg-emerald-800 overflow-hidden
                  ${(location.pathname.startsWith('/material-registry') || location.pathname.startsWith('/finished-goods')) ? 'bg-emerald-950/50 text-white font-semibold' : ''}`}
              >
                <div className="flex items-center">
                  <div className="shrink-0"><Database size={20} /></div>
                  <span className="ml-4 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Material Registry</span>
                </div>
                <ChevronDown size={16} className={`opacity-0 group-hover:opacity-100 transition-transform duration-200 ${isMaterialsOpen ? 'rotate-180' : ''}`} />
              </button>
              {isMaterialsOpen && (
                <div className="pl-4 space-y-1 group-hover:block hidden animate-in slide-in-from-top-2 duration-150">
                  <NavLink to="/material-registry" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Database size={14} /> Raw Materials</NavLink>
                  <NavLink to="/finished-goods" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Shirt size={14} /> Finished Goods</NavLink>
                </div>
              )}
            </div>
          )}

          {/* PARTNERS DROPDOWN */}
          {hasAccess('partners') && (
            <div className="space-y-1 w-full">
              <button
                onClick={() => { setIsPartnersOpen(!isPartnersOpen); closeOtherDropdowns('partners'); }}
                className={`flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all duration-200 text-left text-white/90 hover:bg-emerald-800 overflow-hidden
                  ${(location.pathname.startsWith('/supplier-registration') || location.pathname.startsWith('/factory-registration') || location.pathname.startsWith('/customers')) ? 'bg-emerald-950/50 text-white font-semibold' : ''}`}
              >
                <div className="flex items-center">
                  <div className="shrink-0"><Building2 size={20} /></div>
                  <span className="ml-4 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Partners</span>
                </div>
                <ChevronDown size={16} className={`opacity-0 group-hover:opacity-100 transition-transform duration-200 ${isPartnersOpen ? 'rotate-180' : ''}`} />
              </button>
              {isPartnersOpen && (
                <div className="pl-4 space-y-1 group-hover:block hidden animate-in slide-in-from-top-2 duration-150">
                  <NavLink to="/supplier-registration" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Building2 size={14} /> Supplier Master</NavLink>
                  <NavLink to="/factory-registration" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Building2 size={14} /> Factory Master</NavLink>
                  <NavLink to="/customers" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><UserCheck size={14} /> Customer Master</NavLink>
                </div>
              )}
            </div>
          )}

          {/* 🌟 REPORTS DROPDOWN (GRN Report + Goods Issue Report) */}
          {hasAnyReportAccess && (
            <div className="space-y-1 w-full">
              <button
                onClick={() => { setIsReportsOpen(!isReportsOpen); closeOtherDropdowns('reports'); }}
                className={`flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all duration-200 text-left text-white/90 hover:bg-emerald-800 overflow-hidden
                  ${location.pathname.startsWith('/reports') ? 'bg-emerald-950/50 text-white font-semibold' : ''}`}
              >
                <div className="flex items-center">
                  <div className="shrink-0"><FileBarChart size={20} /></div>
                  <span className="ml-4 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Reports</span>
                </div>
                <ChevronDown size={16} className={`opacity-0 group-hover:opacity-100 transition-transform duration-200 ${isReportsOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isReportsOpen && (
                <div className="pl-4 space-y-1 group-hover:block hidden animate-in slide-in-from-top-2 duration-150">
                  {hasAccess('grnHistory') && (
                    <NavLink to="/reports/grn" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><FileBarChart size={14} /> GRN Report</NavLink>
                  )}
                  {hasAccess('materialIssuing') && (
                    <NavLink to="/reports/goods-issue" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><PackageMinus size={14} /> Goods Issue Report</NavLink>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS DROPDOWN */}
          {hasAccess('settings') && (
            <div className="space-y-1 w-full">
              <button
                onClick={() => { setIsSettingsOpen(!isSettingsOpen); closeOtherDropdowns('settings'); }}
                className={`flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all duration-200 text-left text-white/90 hover:bg-emerald-800 overflow-hidden
                  ${(location.pathname.startsWith('/user-registry') || location.pathname.startsWith('/workflow-registry') || location.pathname.startsWith('/color-master') || location.pathname.startsWith('/uom-master') || location.pathname.startsWith('/warehouse-registry') || location.pathname.startsWith('/size-master') || location.pathname.startsWith('/transaction-types')) ? 'bg-emerald-950/50 text-white font-semibold' : ''}`}
              >
                <div className="flex items-center">
                  <div className="shrink-0"><Settings size={20} /></div>
                  <span className="ml-4 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Settings</span>
                </div>
                <ChevronDown size={16} className={`opacity-0 group-hover:opacity-100 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSettingsOpen && (
                <div className="pl-4 space-y-1 group-hover:block hidden animate-in slide-in-from-top-2 duration-150">
                  <NavLink to="/workflow-registry" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><GitBranch size={14} /> Workflow Registry</NavLink>
                  <NavLink to="/user-registry" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Users size={14} /> User Registry</NavLink>
                  <NavLink to="/color-master" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Palette size={14} /> Color Master</NavLink>
                  <NavLink to="/uom-master" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Scale size={14} /> UOM Master</NavLink>
                  <NavLink to="/warehouse-registry" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Warehouse size={14} /> Warehouse Registry</NavLink>
                  <NavLink to="/size-master" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Scale size={14} /> Size Master</NavLink>
                  <NavLink to="/transaction-types" className={({ isActive }) => `flex items-center w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all gap-2 text-left ${isActive ? 'bg-emerald-800 text-emerald-300' : 'text-white/80 hover:bg-emerald-800/60'}`}><Tag size={14} /> Transaction Types</NavLink>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* LOWER LOGOUT CONTROLLER BUTTON BLOCK */}
      <div className="p-4 border-t border-emerald-800/60 w-full shrink-0 bg-emerald-900">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-3 rounded-xl transition-all duration-200 text-left overflow-hidden text-rose-300 hover:bg-rose-950/30 hover:text-rose-400 cursor-pointer"
        >
          <div className="shrink-0"><LogOut size={20} /></div>
          <span className="ml-4 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">Log Out</span>
        </button>
      </div>

    </div>
  );
};

export default Sidebar;