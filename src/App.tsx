/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyUpdate from './pages/DailyUpdate';
import CloseOrder from './pages/CloseOrder';
import DataBank from './pages/DataBank';
import NewERPPlan from './pages/NewERPPlan';
import CplReport from './pages/CPLReport';
import HMTOD from './pages/HMTOD';
import ProactivePlan from './pages/ProactivePlan';
import IoTTracking from './pages/IoTTracking';
import WashMcLoadPlan from './pages/WashMcLoadPlan';
import Login from './pages/Login';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
