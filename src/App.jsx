import { useEffect, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout.jsx";
import PublicCatalogPage from "./pages/public/PublicCatalogPage.jsx";
const PublicCoursePage = lazy(() => import("./pages/public/PublicCoursePage.jsx"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage.jsx"));
import DashboardLayout, { DashboardIndex } from "./layouts/DashboardLayout.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
const CoursesPage = lazy(() => import("./pages/courses/CoursesPage.jsx"));
const CourseDetailsPage = lazy(() => import("./pages/courses/CourseDetailsPage.jsx"));
const MyCoursesPage = lazy(() => import("./pages/courses/MyCoursesPage.jsx"));
const CreateCoursePage = lazy(() => import("./pages/courses/CreateCoursePage.jsx"));
const CurriculumPage = lazy(() => import("./pages/courses/CurriculumPage.jsx"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboardPage.jsx"));
import { fetchCurrentUser, sessionExpired } from "./slices/authSlice.js";
const ChangePasswordPage = lazy(() => import("./pages/auth/ChangePasswordPage.jsx"));
const AdminPage = lazy(() => import("./pages/admin/AdminPage.jsx"));
const PaymentStatusPage = lazy(() => import("./pages/PaymentStatusPage.jsx"));
const PaymentHistoryPage = lazy(() => import("./pages/PaymentHistoryPage.jsx"));
const AssessmentAuthorPage = lazy(() => import("./pages/assessments/AssessmentAuthorPage.jsx"));
const StudentAssessmentsPage = lazy(() => import("./pages/assessments/StudentAssessmentsPage.jsx"));
const AssessmentAttemptPage = lazy(() => import("./pages/assessments/AssessmentAttemptPage.jsx"));
const LearningSupportPage = lazy(() => import("./pages/courses/LearningSupportPage.jsx"));
const AcquisitionPage = lazy(() => import("./pages/courses/AcquisitionPage.jsx"));
const DoubtDostPage = lazy(() => import("./pages/courses/DoubtDostPage.jsx"));
const DoubtKnowledgePage = lazy(() => import("./pages/admin/DoubtKnowledgePage.jsx"));
export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(fetchCurrentUser());
    const expired = () => dispatch(sessionExpired());
    const changed = (event) => { if (event.key === "lms_account_changed") { dispatch(sessionExpired()); dispatch(fetchCurrentUser()); } };
    window.addEventListener("lms-session-expired", expired);
    window.addEventListener("storage", changed);
    const passwordRequired = () => dispatch(fetchCurrentUser());
    window.addEventListener("lms-password-change-required", passwordRequired);
    return () => { window.removeEventListener("lms-session-expired", expired); window.removeEventListener("storage", changed); window.removeEventListener("lms-password-change-required", passwordRequired); };
  }, [dispatch]);
  return <Routes key={user?.id || "signed-out"}>
    <Route element={<PublicLayout />}><Route path="/" element={<PublicCatalogPage home />} /><Route path="/catalog" element={<PublicCatalogPage />} /><Route path="/catalog/:slug" element={<PublicCoursePage />} /></Route>
    <Route element={<ProtectedRoute publicOnly />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /></Route>
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute allowPasswordChange />}><Route path="/change-password" element={<ChangePasswordPage />} /></Route>
    <Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}>
      <Route path="/dashboard" element={<DashboardIndex />} />
      <Route path="/courses" element={<CoursesPage />} /><Route path="/courses/:id" element={<CourseDetailsPage />} />
      <Route element={<ProtectedRoute roles={["student"]} />}><Route path="/courses/:id/support" element={<Suspense fallback={<p role="status">Loading learning support…</p>}><LearningSupportPage /></Suspense>} /></Route>
      <Route element={<ProtectedRoute roles={["student"]} />}><Route path="/doubts" element={<Suspense fallback={<p role="status">Loading Doubt Dost…</p>}><DoubtDostPage /></Suspense>} /><Route path="/courses/:id/doubts" element={<Suspense fallback={<p role="status">Loading Doubt Dost…</p>}><DoubtDostPage /></Suspense>} /></Route>
      <Route element={<ProtectedRoute roles={["student"]} />}><Route path="/student" element={<StudentDashboardPage />} /><Route path="/payments" element={<PaymentHistoryPage />} /><Route path="/payments/:id" element={<PaymentStatusPage />} /><Route path="/courses/:id/assessments" element={<StudentAssessmentsPage />} /><Route path="/assessment-attempts/:id" element={<AssessmentAttemptPage />} /></Route>
      <Route element={<ProtectedRoute roles={["instructor", "admin"]} />}>
        <Route path="/instructor" element={<MyCoursesPage />} /><Route path="/instructor/courses" element={<MyCoursesPage />} />
        <Route path="/instructor/courses/new" element={<CreateCoursePage />} /><Route path="/instructor/courses/:id/curriculum" element={<CurriculumPage />} />
        <Route path="/instructor/courses/:id/edit" element={<CreateCoursePage />} />
        <Route path="/instructor/courses/:id/assessments" element={<Suspense fallback={<p role="status">Loading assessment editor…</p>}><AssessmentAuthorPage /></Suspense>} />
        <Route path="/instructor/courses/:id/acquisition" element={<Suspense fallback={<p role="status">Loading course acquisition…</p>}><AcquisitionPage /></Suspense>} />
        <Route path="/instructor/courses/:id/support" element={<Suspense fallback={<p role="status">Loading learning support…</p>}><LearningSupportPage /></Suspense>} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}><Route path="/admin" element={<AdminPage />} /><Route path="/admin/doubt-dost" element={<Suspense fallback={<p role="status">Loading knowledge base…</p>}><DoubtKnowledgePage /></Suspense>} /><Route path="/admin/courses/upload" element={<CreateCoursePage />} /></Route>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
