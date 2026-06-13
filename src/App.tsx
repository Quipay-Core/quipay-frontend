import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import DashboardLayout from "./components/layout/DashboardLayout";
import WalletGuard from "./components/WalletGuard";
import RoleGuard from "./components/RoleGuard";
import SubdomainDetector from "./components/SubdomainDetector";
import { RoleProvider } from "./context/RoleContext";
import { TooltipProvider } from "./components/ui";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";

// ─── Lazy pages ───────────────────────────────────────────────────────────────

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Debugger = lazy(() => import("./pages/DebuggerStub"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UIPrimitivesPreview = lazy(() => import("./pages/StellarOnlyStub"));
const SelectRole = lazy(() => import("./pages/SelectRole"));

// Employer pages
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const PayrollDashboard = lazy(() => import("./pages/PayrollDashboard"));
const TreasuryManager = lazy(() => import("./pages/TreasuryManager"));
const TreasuryAnalytics = lazy(() => import("./pages/TreasuryAnalytics"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const CreateStream = lazy(() => import("./pages/CreateStream"));
const GovernanceOverview = lazy(() => import("./pages/StellarOnlyStub"));
const Reports = lazy(() => import("./pages/Reports"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const WorkforceRegistry = lazy(() => import("./pages/WorkforceRegistry"));
const AddressBook = lazy(() => import("./pages/AddressBook"));
const DashboardCustomization = lazy(
  () => import("./pages/DashboardCustomization"),
);
const StreamTemplates = lazy(() => import("./pages/StreamTemplates"));
const StreamComparison = lazy(() => import("./pages/StellarOnlyStub"));

// Employee pages
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));

// Onboarding
const EmployerOnboarding = lazy(() => import("./pages/EmployerOnboarding"));
const JoinPage = lazy(() => import("./pages/JoinPage"));

// ─── Public layout ────────────────────────────────────────────────────────────

function PublicLayout() {
  const { t } = useTranslation();
  const { isHelpModalOpen, toggleHelpModal } = useKeyboardShortcuts();

  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          {t("common.skip_to_content")}
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <Suspense
            fallback={
              <div className="p-8 text-center text-neutral-500">
                {t("common.loading")}
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
        <Footer />
        <KeyboardShortcutsModal
          isOpen={isHelpModalOpen}
          onClose={toggleHelpModal}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { t } = useTranslation();
  return (
    <RoleProvider>
      <SubdomainDetector />
      <Suspense
        fallback={<div className="p-8 text-center">{t("common.loading")}</div>}
      >
        <Routes>
          {/* ── Bare routes (no layout) ── */}
          <Route path="/onboard" element={<EmployerOnboarding />} />
          <Route path="/select-role" element={<SelectRole />} />

          {/* ── Public routes ── */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/ui-primitives" element={<UIPrimitivesPreview />} />
            <Route path="/debug" element={<Debugger />} />
            <Route path="/debug/:contractName" element={<Debugger />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/join/:token" element={<JoinPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ── Employer routes ── */}
          <Route
            element={
              <WalletGuard>
                <RoleGuard requiredRole="employer">
                  <DashboardLayout view="employer" />
                </RoleGuard>
              </WalletGuard>
            }
          >
            <Route path="/employer/dashboard" element={<EmployerDashboard />} />
            <Route path="/employer/payroll" element={<PayrollDashboard />} />
            <Route path="/employer/create-stream" element={<CreateStream />} />
            <Route path="/employer/treasury" element={<TreasuryManager />} />
            <Route
              path="/employer/treasury-analytics"
              element={<TreasuryAnalytics />}
            />
            <Route path="/employer/workforce" element={<WorkforceRegistry />} />
            <Route path="/employer/analytics" element={<Analytics />} />
            <Route path="/employer/reports" element={<Reports />} />
            <Route
              path="/employer/governance"
              element={<GovernanceOverview />}
            />
            <Route path="/employer/address-book" element={<AddressBook />} />
            <Route path="/employer/templates" element={<StreamTemplates />} />
            <Route
              path="/employer/stream-comparison"
              element={<StreamComparison />}
            />
            <Route
              path="/employer/customization"
              element={<DashboardCustomization />}
            />
            <Route path="/employer/withdraw" element={<WithdrawPage />} />
            <Route path="/employer/settings" element={<Settings />} />
          </Route>

          {/* ── Employee routes ── */}
          <Route
            element={
              <WalletGuard>
                <RoleGuard requiredRole="worker">
                  <DashboardLayout view="employee" />
                </RoleGuard>
              </WalletGuard>
            }
          >
            <Route path="/employee/dashboard" element={<WorkerDashboard />} />
            <Route
              path="/employee/transactions"
              element={<TransactionsPage />}
            />
            <Route path="/employee/withdraw" element={<WithdrawPage />} />
            <Route path="/employee/settings" element={<Settings />} />
          </Route>

          {/* ── Legacy path redirects (bookmarks / old links) ── */}
          <Route
            path="/dashboard"
            element={<Navigate to="/employer/dashboard" replace />}
          />
          <Route
            path="/payroll"
            element={<Navigate to="/employer/payroll" replace />}
          />
          <Route
            path="/create-stream"
            element={<Navigate to="/employer/create-stream" replace />}
          />
          <Route
            path="/treasury-management"
            element={<Navigate to="/employer/treasury" replace />}
          />
          <Route
            path="/treasury-analytics"
            element={<Navigate to="/employer/treasury-analytics" replace />}
          />
          <Route
            path="/workforce"
            element={<Navigate to="/employer/workforce" replace />}
          />
          <Route
            path="/analytics"
            element={<Navigate to="/employer/analytics" replace />}
          />
          <Route
            path="/reports"
            element={<Navigate to="/employer/reports" replace />}
          />
          <Route
            path="/governance"
            element={<Navigate to="/employer/governance" replace />}
          />
          <Route
            path="/address-book"
            element={<Navigate to="/employer/address-book" replace />}
          />
          <Route
            path="/templates"
            element={<Navigate to="/employer/templates" replace />}
          />
          <Route
            path="/stream-comparison"
            element={<Navigate to="/employer/stream-comparison" replace />}
          />
          <Route
            path="/dashboard-customization"
            element={<Navigate to="/employer/customization" replace />}
          />
          <Route
            path="/worker"
            element={<Navigate to="/employee/dashboard" replace />}
          />
          <Route
            path="/transactions"
            element={<Navigate to="/employee/transactions" replace />}
          />
          <Route
            path="/settings"
            element={<Navigate to="/employer/settings" replace />}
          />
          <Route
            path="/withdraw"
            element={<Navigate to="/employer/withdraw" replace />}
          />
        </Routes>
      </Suspense>
    </RoleProvider>
  );
}

export default App;
