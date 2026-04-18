/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { PointagePage } from './pages/PointagePage';
import { HistoryPage } from './pages/HistoryPage';
import { HoursPage } from './pages/HoursPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminInventoryPage } from './pages/AdminInventoryPage';
import { AdminSparePartsPage } from './pages/AdminSparePartsPage';
import { EmployeeInventoryPage } from './pages/EmployeeInventoryPage';
import { EmployeeSparePartsPage } from './pages/EmployeeSparePartsPage';
import { ChatPage } from './pages/ChatPage';
import { EmployeeRecordPage } from './pages/EmployeeRecordPage';
import { EmployeeRecordsListPage } from './pages/EmployeeRecordsListPage';
import InvoiceEditorM1 from './pages/invoice_editor_m2';
import InvoiceEditorM2 from './pages/invoice-editor_m1';


export default function App() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Shared Routes */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/employees" element={<EmployeesPage />} />
        <Route path="/admin/attendance" element={<AttendancePage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/inventory" element={<AdminInventoryPage />} />
        <Route path="/admin/spare-parts" element={<AdminSparePartsPage />} />
        <Route path="/admin/records" element={<EmployeeRecordsListPage />} />
        <Route path="/admin/employee/:id" element={<EmployeeRecordPage />} />
        <Route path="/admin/invoice-editor_m1" element={<InvoiceEditorM1 />} />
        <Route path="/admin/invoice-editor_m2" element={<InvoiceEditorM2 />} />
        <Route path="/admin/chat" element={<ChatPage />} />
        
        {/* Employee Routes */}
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee/pointage" element={<PointagePage />} />
        <Route path="/employee/history" element={<HistoryPage />} />
        <Route path="/employee/hours" element={<HoursPage />} />
        <Route path="/employee/inventory" element={<EmployeeInventoryPage />} />
        <Route path="/employee/spare-parts" element={<EmployeeSparePartsPage />} />
        <Route path="/employee/chat" element={<ChatPage />} />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
