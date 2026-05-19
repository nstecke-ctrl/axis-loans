import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './features/auth/pages/LoginPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import { InventoryPage } from './features/inventory/pages/InventoryPage'
import { EquipmentDetailPage } from './features/inventory/pages/EquipmentDetailPage'
import { NewEquipmentPage } from './features/inventory/pages/NewEquipmentPage'
import { ImportEquipmentPage } from './features/inventory/pages/ImportEquipmentPage'
import { LoansPage } from './features/loans/pages/LoansPage'
import { LoanDetailPage } from './features/loans/pages/LoanDetailPage'
import { NewLoanPage } from './features/loans/pages/NewLoanPage'
import { ReturnLoanPage } from './features/loans/pages/ReturnLoanPage'
import { MovementsPage } from './features/movements/pages/MovementsPage'
import { PublicLoanRequestPage } from './features/loan-requests/pages/PublicLoanRequestPage'
import { LoanRequestsPage } from './features/loan-requests/pages/LoanRequestsPage'
import { LoanRequestDetailPage } from './features/loan-requests/pages/LoanRequestDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route
        path="/request-equipment"
        element={<PublicLoanRequestPage />}
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/new" element={<NewEquipmentPage />} />
        <Route path="/inventory/import" element={<ImportEquipmentPage />} />
        <Route
          path="/inventory/:equipmentCode"
          element={<EquipmentDetailPage />}
        />

        <Route path="/loans" element={<LoansPage />} />
        <Route path="/loans/new" element={<NewLoanPage />} />
        <Route path="/loans/:loanCode" element={<LoanDetailPage />} />
        <Route
          path="/loans/:loanCode/return"
          element={<ReturnLoanPage />}
        />

        <Route path="/loan-requests" element={<LoanRequestsPage />} />
        <Route
          path="/loan-requests/:requestCode"
          element={<LoanRequestDetailPage />}
        />

        <Route path="/movements" element={<MovementsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App