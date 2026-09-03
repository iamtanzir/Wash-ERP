/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

// Code-splitting with Rollup dynamic imports
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DailyUpdate = lazy(() => import('./pages/DailyUpdate'));
const CloseOrder = lazy(() => import('./pages/CloseOrder'));
const DataBank = lazy(() => import('./pages/DataBank'));
const NewERPPlan = lazy(() => import('./pages/NewERPPlan'));
const CplReport = lazy(() => import('./pages/CPLReport'));
const HMTOD = lazy(() => import('./pages/HMTOD'));
const ProactivePlan = lazy(() => import('./pages/ProactivePlan'));
const IoTTracking = lazy(() => import('./pages/IoTTracking'));
const WashMcLoadPlan = lazy(() => import('./pages/WashMcLoadPlan'));
const Admin = lazy(() => import('./pages/Admin'));

function PageFallback() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading module...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="cpl-report" element={<CplReport />} />
                <Route path="daily-update" element={<DailyUpdate />} />
                <Route path="hm-tod" element={<HMTOD />} />
                <Route path="proactive-plan" element={<ProactivePlan />} />
                <Route path="iot-tracking" element={<IoTTracking />} />
                <Route path="wash-mc-plan" element={<WashMcLoadPlan />} />
                <Route path="close-order" element={<CloseOrder />} />
                <Route path="data-bank" element={<DataBank />} />
                
                {/* Open to all authenticated users, but read-only for viewers */}
                <Route path="new-plan" element={<NewERPPlan />} />
                
                {/* Admin Only for management, but listing open to all */}
                <Route path="admin" element={<Admin />} />
              </Route>
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
