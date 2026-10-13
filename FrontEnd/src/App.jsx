import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login'; 
import Dashboard from './pages/Dashboard';
import SalesOrders from './pages/SalesOrders';
import SalesOrderDetails from './pages/SalesOrderDetails'; 
import Costing from './pages/Costing';
import MaterialIssuing from './pages/MaterialIssuing';
import GRNRegister from './pages/GRNRegister'; 
import Settings from './pages/Settings'; 
import UomMaster from './pages/UomMaster'; 
import SupplierRegistration from './pages/SupplierRegistration'; 
import FactoryRegistration from './pages/FactoryRegistration'; 
import WorkflowRegistry from './pages/WorkflowRegistry'; 
import UserRegistry from './pages/UserRegistry'; 
import Notifications from './pages/Notifications'; 
import WarehouseRegistry from './pages/WarehouseRegistry'; 
import StockOverview from './pages/StockOverview'; 
import SizeMaster from './pages/SizeMaster'; 
import GoodsIssueWindow from './pages/GoodsIssueWindow'; 
import MaterialRegistry from './pages/MaterialRegistry'; 

// 🌟 අලුතින් එක් කළ Invoice Register පේජ් එක සම්බන්ධ කිරීම
import InvoiceRegister from './pages/InvoiceRegister'; 

// 🌟 Transaction Type Master පේජ් එක සම්බන්ධ කිරීම
import TransactionTypeMaster from './pages/TransactionTypeMaster'; 

// 🌟 Production Orders මොඩියුලය සම්බන්ධ කිරීම
import ProductionOrders from './pages/ProductionOrders'; 

// 🌟 Purchases / Procurement මොඩියුලය සම්බන්ධ කිරීම
import Purchases from './pages/Purchases'; 

// 🌟 Customers මොඩියුලය සම්බන්ධ කිරීම
import Customers from './pages/Customers'; 

// 🌟 Finished Goods මොඩියුලය සම්බන්ධ කිරීම
import FinishedGoods from './pages/FinishedGoods';  

// 🌟 GRN Report View (ෆෝම් එක සහ ටේබල් එක පෙන්වන එකම පේජ් එක) සම්බන්ධ කිරීම
import GrnReportView from './pages/reports/GrnReportView'; 

// 🌟 Goods Issue Report View සම්බන්ධ කිරීම (අලුතින් එක් කළා)
import GoodsIssueReportView from './pages/reports/GoodsIssueReportView';

// 🌟 GRN Return පේජ් එක සම්බන්ධ කිරීම (අලුතින් එක් කළා)
import GrnReturn from './pages/GrnReturn'; 

function App() {
  const location = useLocation();

  // LOCAL STORAGE එකෙන් TOKEN එක කියවා USER LOG වෙලාද නැද්ද යන්න පරික්ෂා කිරීම
  const isAuthenticated = !!localStorage.getItem('token');

  // shadow-wide uppercase string processing
  const currentUsername = localStorage.getItem('username') || 'Guest';

  // යූසර්ගේ නමේ පළමු අකුර Avatar Icon එක සඳහා ලබා ගැනීම
  const firstLetter = currentUsername.charAt(0).toUpperCase();

  // යූසර් බලෙන් URL එක ගහලා පිටුවකට යන්න හැදුවොත් පර්මිෂන් චෙක් කරන ශ්‍රිතය (Admin ට සේරම විවෘතයි)
  const hasRouteAccess = (moduleName) => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'Admin') return true; 
    const permissions = JSON.parse(localStorage.getItem('userPermissions') || '{}');
    return !!permissions[moduleName];
  };

  // දැනට ඉන්න පිටුවේ නම නිවැරදිව Header එකේ පෙන්වීමට
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/customers')) return 'Customers'; 
    if (path.startsWith('/finished-goods')) return 'Finished Goods'; 
    if (path.startsWith('/purchases')) return 'Purchasing'; 
    if (path.startsWith('/invoices')) return 'Sales Invoices'; // 🌟 Invoice Title එක එක් කළා
    if (path.startsWith('/reports/grn')) return 'GRN Report'; // 🌟 GRN Report Title එක එක් කළා
    if (path.startsWith('/reports/goods-issue')) return 'Goods Issue Report'; // 🌟 Goods Issue Report Title එක එක් කළා
    if (path.startsWith('/grn-return')) return 'GRN Return'; // 🌟 GRN Return Title එක එක් කළා
    if (path.startsWith('/notifications')) return 'Notifications'; 
    if (path.startsWith('/sales-orders/print')) return 'Sales Order Print View'; 
    if (path.startsWith('/sales-orders')) return 'Sales Orders';
    if (path.startsWith('/costing')) return 'Costing';
    if (path.startsWith('/material-issuing/view')) return 'Goods Issue Window';
    if (path.startsWith('/material-issuing')) return 'Material Issuing';
    if (path.startsWith('/production-orders')) return 'Production Orders';
    if (path.startsWith('/grn-history')) return 'GRN History';
    if (path.startsWith('/transaction-types')) return 'Transaction Types Master';
    if (path.startsWith('/stock-overview')) return 'Live Stock Ledger'; 
    if (path.startsWith('/warehouse-registry')) return 'Warehouse Registry'; 
    if (path.startsWith('/material-registry')) return 'Material Registry';
    if (path.startsWith('/supplier-registration')) return 'Supplier Registration';
    if (path.startsWith('/factory-registration')) return 'Factory Registration';
    if (path.startsWith('/workflow-registry')) return 'Workflow Registry'; 
    if (path.startsWith('/user-registry')) return 'User Registry'; 
    if (path.startsWith('/color-master')) return 'Color Master';
    if (path.startsWith('/uom-master')) return 'UOM Master';
    if (path.startsWith('/size-master')) return 'Size Master'; 
    return 'Dashboard';
  };

  // 1. USER LOG වෙලා නැත්නම් සහ ඉන්නේ /login පිටුවේ නෙමෙයි නම්, ඔටෝ ලොගින් පිටුවට හරවා යැවීම (Guard)
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // 2. USER ලොග් වෙලා ඉන්නවනම් ආපහු /login එකට යාම වැළැක්වීම
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-sm font-normal text-slate-700">
      
      {/* USER ඉන්නේ /login පිටුවේ නම් Sidebar සහ Header පෙන්වන්නේ නැත (Clean Login UI) */}
      {location.pathname !== '/login' && <Sidebar />} 

      {/* දකුණු පැත්තේ ප්‍රධාන Layout Area එක */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* TOP HEADER BAR - Login පිටුවේදී සඟවනු ලැබේ */}
        {location.pathname !== '/login' && (
          <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0 w-full">
            <h1 className="text-lg font-semibold text-slate-800">{getPageTitle()} Overview</h1>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-600 tracking-wide uppercase">{currentUsername}</span>
              <div className="w-9 h-9 rounded-full bg-emerald-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {firstLetter}
              </div>
            </div>
          </header>
        )}
        
        {/* MAIN BODY WINDOW */}
        <main className={`flex-1 overflow-y-auto bg-slate-50 min-w-0 w-full ${location.pathname === '/login' ? 'p-0' : 'p-6 md:p-8'}`}>
          <div className="w-full">
            <Routes>
              {/* AUTH ROUTES */}
              <Route path="/login" element={<Login />} />

              {/* ERP SYSTEM ROUTES WITH LIVE ACCESS CONTROL PROTECTION */}
              <Route 
                path="/" 
                element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
              />
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Customers Route එක */}
              <Route path="/customers" element={hasRouteAccess('partners') ? <Customers /> : <Navigate to="/dashboard" replace />} />

              {/* Finished Goods Route එක */}
              <Route path="/finished-goods" element={hasRouteAccess('materialRegistry') ? <FinishedGoods /> : <Navigate to="/dashboard" replace />} />

              {/* Purchases Route එක */}
              <Route path="/purchases" element={hasRouteAccess('materialIssuing') ? <Purchases /> : <Navigate to="/dashboard" replace />} />

              {/* 🌟 Sales Invoices Route එක (Material Issuing / Sales පර්මිෂන් එක යටතේ) */}
              <Route path="/invoices" element={hasRouteAccess('materialIssuing') ? <InvoiceRegister /> : <Navigate to="/dashboard" replace />} />

              {/* 🌟 GRN Report Routes (GrnReportView එකම පාවිච්චි කරයි) */}
              <Route path="/reports/grn" element={hasRouteAccess('grnHistory') ? <GrnReportView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/reports/grn/view" element={hasRouteAccess('grnHistory') ? <GrnReportView /> : <Navigate to="/dashboard" replace />} />

              {/* 🌟 Goods Issue Report Route (අලුතින් එක් කළා) */}
              <Route path="/reports/goods-issue" element={hasRouteAccess('materialIssuing') ? <GoodsIssueReportView /> : <Navigate to="/dashboard" replace />} />

              {/* 🌟 GRN Return Route එක (අලුතින් එක් කළා) */}
              <Route path="/grn-return" element={hasRouteAccess('grnHistory') ? <GrnReturn /> : <Navigate to="/dashboard" replace />} />

              {/* Notifications එක හැමෝටම විවෘත පොදු පිටුවක් (Inbox) */}
              <Route path="/notifications" element={<Notifications />} />
              
              {/* Live Stock Overview පේජ් රූට් එක */}
              <Route path="/stock-overview" element={<StockOverview />} />
              
              {/* Warehouse Setup එක */}
              <Route path="/warehouse-registry" element={hasRouteAccess('settings') ? <WarehouseRegistry /> : <Navigate to="/dashboard" replace />} />

              {/* Sales Orders & Costing Routes */}
              <Route path="/sales-orders" element={hasRouteAccess('salesOrders') ? <SalesOrders /> : <Navigate to="/dashboard" replace />} />
              <Route path="/sales-orders/:id" element={hasRouteAccess('salesOrders') ? <SalesOrderDetails /> : <Navigate to="/dashboard" replace />} /> 
              <Route path="/sales-orders/print/:id" element={hasRouteAccess('salesOrders') ? <SalesOrderDetails /> : <Navigate to="/dashboard" replace />} />
              <Route path="/costing" element={hasRouteAccess('costing') ? <Costing /> : <Navigate to="/dashboard" replace />} />
              
              {/* Live Material Issuing Modules */}
              <Route path="/material-issuing" element={hasRouteAccess('materialIssuing') ? <MaterialIssuing /> : <Navigate to="/dashboard" replace />} /> 
              <Route path="/material-issuing/view/:id" element={hasRouteAccess('materialIssuing') ? <GoodsIssueWindow /> : <Navigate to="/dashboard" replace />} />

              <Route path="/production-orders" element={hasRouteAccess('materialIssuing') ? <ProductionOrders /> : <Navigate to="/dashboard" replace />} />

              <Route path="/grn-history" element={hasRouteAccess('grnHistory') ? <GRNRegister /> : <Navigate to="/dashboard" replace />} />
              
              {/* Transaction Types Master Route එක */}
              <Route path="/transaction-types" element={hasRouteAccess('settings') ? <TransactionTypeMaster /> : <Navigate to="/dashboard" replace />} />
              
              <Route path="/material-registry" element={hasRouteAccess('materialRegistry') ? <MaterialRegistry /> : <Navigate to="/dashboard" replace />} />
              
              <Route path="/supplier-registration" element={hasRouteAccess('partners') ? <SupplierRegistration /> : <Navigate to="/dashboard" replace />} /> 
              <Route path="/factory-registration" element={hasRouteAccess('partners') ? <FactoryRegistration /> : <Navigate to="/dashboard" replace />} /> 
              
              <Route path="/workflow-registry" element={hasRouteAccess('settings') ? <WorkflowRegistry /> : <Navigate to="/dashboard" replace />} /> 
              <Route path="/user-registry" element={hasRouteAccess('settings') ? <UserRegistry /> : <Navigate to="/dashboard" replace />} /> 
              <Route path="/color-master" element={hasRouteAccess('settings') ? <Settings /> : <Navigate to="/dashboard" replace />} /> 
              <Route path="/uom-master" element={hasRouteAccess('settings') ? <UomMaster /> : <Navigate to="/dashboard" replace />} />  
              <Route path="/size-master" element={hasRouteAccess('settings') ? <SizeMaster /> : <Navigate to="/dashboard" replace />} />  
              
              {/* වැරදි Route එකක් ගැහුවොත් ඔටෝ ඩෑෂ්බෝඩ් එකට යවයි */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;