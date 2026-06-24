import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { PasswordResetGate } from './components/auth/PasswordResetGate'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { RequirePermission } from './components/auth/RequirePermission'
import { AppLayout } from './components/layout/AppLayout'

const LoginPage = lazy(() =>
  import('./features/auth/pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
)
const ChangePasswordPage = lazy(() =>
  import('./features/auth/pages/ChangePasswordPage').then((module) => ({
    default: module.ChangePasswordPage,
  })),
)
const UserManagementPage = lazy(() =>
  import('./features/admin/pages/UserManagementPage').then((module) => ({
    default: module.UserManagementPage,
  })),
)
const DashboardPage = lazy(() =>
  import('./features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)
const InventoryPage = lazy(() =>
  import('./features/inventory/pages/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
)
const EquipmentDetailPage = lazy(() =>
  import('./features/inventory/pages/EquipmentDetailPage').then((module) => ({
    default: module.EquipmentDetailPage,
  })),
)
const NewEquipmentPage = lazy(() =>
  import('./features/inventory/pages/NewEquipmentPage').then((module) => ({
    default: module.NewEquipmentPage,
  })),
)
const ImportEquipmentPage = lazy(() =>
  import('./features/inventory/pages/ImportEquipmentPage').then((module) => ({
    default: module.ImportEquipmentPage,
  })),
)
const LoansPage = lazy(() =>
  import('./features/loans/pages/LoansPage').then((module) => ({
    default: module.LoansPage,
  })),
)
const LoanDetailPage = lazy(() =>
  import('./features/loans/pages/LoanDetailPage').then((module) => ({
    default: module.LoanDetailPage,
  })),
)
const NewLoanPage = lazy(() =>
  import('./features/loans/pages/NewLoanPage').then((module) => ({
    default: module.NewLoanPage,
  })),
)
const ReturnLoanPage = lazy(() =>
  import('./features/loans/pages/ReturnLoanPage').then((module) => ({
    default: module.ReturnLoanPage,
  })),
)
const MovementsPage = lazy(() =>
  import('./features/movements/pages/MovementsPage').then((module) => ({
    default: module.MovementsPage,
  })),
)
const PublicLoanRequestPage = lazy(() =>
  import('./features/loan-requests/pages/PublicLoanRequestPage').then(
    (module) => ({
      default: module.PublicLoanRequestPage,
    }),
  ),
)
const LoanRequestsPage = lazy(() =>
  import('./features/loan-requests/pages/LoanRequestsPage').then((module) => ({
    default: module.LoanRequestsPage,
  })),
)
const LoanRequestDetailPage = lazy(() =>
  import('./features/loan-requests/pages/LoanRequestDetailPage').then(
    (module) => ({
      default: module.LoanRequestDetailPage,
    }),
  ),
)

function App() {
  return (
    <Suspense fallback={<RouteLoadingState />}>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          path="/request-equipment"
          element={<PublicLoanRequestPage />}
        />

        <Route
          element={
            <ProtectedRoute>
              <PasswordResetGate>
                <AppLayout />
              </PasswordResetGate>
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/inventory" element={<InventoryPage />} />
          <Route
            path="/inventory/new"
            element={
              <RequirePermission permission="canManageEquipment">
                <NewEquipmentPage />
              </RequirePermission>
            }
          />
          <Route
            path="/inventory/import"
            element={
              <RequirePermission permission="canManageEquipment">
                <ImportEquipmentPage />
              </RequirePermission>
            }
          />
          <Route
            path="/inventory/:equipmentCode"
            element={<EquipmentDetailPage />}
          />

          <Route path="/loans" element={<LoansPage />} />
          <Route
            path="/loans/new"
            element={
              <RequirePermission permission="canManageLoans">
                <NewLoanPage />
              </RequirePermission>
            }
          />
          <Route path="/loans/:loanCode" element={<LoanDetailPage />} />
          <Route
            path="/loans/:loanCode/return"
            element={
              <RequirePermission permission="canManageLoans">
                <ReturnLoanPage />
              </RequirePermission>
            }
          />

          <Route path="/loan-requests" element={<LoanRequestsPage />} />
          <Route
            path="/loan-requests/:requestCode"
            element={<LoanRequestDetailPage />}
          />

          <Route path="/movements" element={<MovementsPage />} />

          <Route
            path="/admin/users"
            element={
              <RequirePermission permission="canManageUsers">
                <UserManagementPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <PasswordResetGate>
                <ChangePasswordPage />
              </PasswordResetGate>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function RouteLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f3] px-6 text-[#171717]">
      <div className="rounded-2xl border border-[#e5e5e2] bg-white px-8 py-7 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
          Demo Assets Control
        </p>

        <p className="mt-3 text-base font-medium text-[#171717]">
          Loading...
        </p>
      </div>
    </div>
  )
}

export default App
