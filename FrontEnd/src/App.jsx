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


import InvoiceRegister from './pages/InvoiceRegister'; 


import TransactionTypeMaster from './pages/TransactionTypeMaster'; 


import ProductionOrders from './pages/ProductionOrders'; 


import Purchases from './pages/Purchases'; 


import Customers from './pages/Customers'; 


import FinishedGoods from './pages/FinishedGoods';  


import GrnReportView from './pages/reports/GrnReportView'; 


import GoodsIssueReportView from './pages/reports/GoodsIssueReportView';


import GrnReturn from './pages/GrnReturn'; 

function App() {
  const location = useLocation();

  
  const isAuthenticated = !!localStorage.getItem('token');


  const currentUsername = localStorage.getItem('username') || 'Guest';

  const firstLetter = currentUsername.charAt(0).toUpperCase();

 
  const hasRouteAccess = (moduleName) => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'Admin') return true; 
    const permissions = JSON.parse(localStorage.getItem('userPermissions') || '{}');
    return !!permissions[moduleName];
  };


  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/customers')) return 'Customers'; 
    if (path.startsWith('/finished-goods')) return 'Finished Goods'; 
    if (path.startsWith('/purchases')) return 'Purchasing'; 
    if (path.startsWith('/invoices')) return 'Sales Invoices'; 
    if (path.startsWith('/reports/grn')) return 'GRN Report'; 
    if (path.startsWith('/reports/goods-issue')) return 'Goods Issue Report'; 
    if (path.startsWith('/grn-return')) return 'GRN Return'; 
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


  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }


  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-sm font-normal text-slate-700">
      
  
      {location.pathname !== '/login' && <Sidebar />} 


      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        

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

       
              <Route path="/customers" element={hasRouteAccess('partners') ? <Customers /> : <Navigate to="/dashboard" replace />} />

          
              <Route path="/finished-goods" element={hasRouteAccess('materialRegistry') ? <FinishedGoods /> : <Navigate to="/dashboard" replace />} />


              <Route path="/purchases" element={hasRouteAccess('materialIssuing') ? <Purchases /> : <Navigate to="/dashboard" replace />} />
              <Route path="/purchases/:id" element={hasRouteAccess('materialIssuing') ? <Purchases /> : <Navigate to="/dashboard" replace />} />

       
              <Route path="/invoices" element={hasRouteAccess('materialIssuing') ? <InvoiceRegister /> : <Navigate to="/dashboard" replace />} />

           
              <Route path="/reports/grn" element={hasRouteAccess('grnHistory') ? <GrnReportView /> : <Navigate to="/dashboard" replace />} />
              <Route path="/reports/grn/view" element={hasRouteAccess('grnHistory') ? <GrnReportView /> : <Navigate to="/dashboard" replace />} />

          
              <Route path="/reports/goods-issue" element={hasRouteAccess('materialIssuing') ? <GoodsIssueReportView /> : <Navigate to="/dashboard" replace />} />

        
              <Route path="/grn-return" element={hasRouteAccess('grnHistory') ? <GrnReturn /> : <Navigate to="/dashboard" replace />} />

       
              <Route path="/notifications" element={<Notifications />} />
              

              <Route path="/stock-overview" element={<StockOverview />} />
              
          
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
              
         
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;