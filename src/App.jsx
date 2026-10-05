import { useEffect, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout.jsx";
import PublicCatalogPage from "./pages/public/PublicCatalogPage.jsx";
import PublicCoursePage from "./pages/public/PublicCoursePage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.jsx";
import DashboardLayout, { DashboardIndex } from "./layouts/DashboardLayout.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import CoursesPage from "./pages/courses/CoursesPage.jsx";
import CourseDetailsPage from "./pages/courses/CourseDetailsPage.jsx";
import MyCoursesPage from "./pages/courses/MyCoursesPage.jsx";
import CreateCoursePage from "./pages/courses/CreateCoursePage.jsx";
import CurriculumPage from "./pages/courses/CurriculumPage.jsx";
import StudentDashboardPage from "./pages/StudentDashboardPage.jsx";
import { fetchCurrentUser, sessionExpired } from "./slices/authSlice.js";
import ChangePasswordPage from "./pages/auth/ChangePasswordPage.jsx";
import AdminPage from "./pages/admin/AdminPage.jsx";
import PaymentStatusPage from "./pages/PaymentStatusPage.jsx";
import PaymentHistoryPage from "./pages/PaymentHistoryPage.jsx";
import AssessmentAuthorPage from "./pages/assessments/AssessmentAuthorPage.jsx";
import StudentAssessmentsPage from "./pages/assessments/StudentAssessmentsPage.jsx";
import AssessmentAttemptPage from "./pages/assessments/AssessmentAttemptPage.jsx";
const LearningSupportPage = lazy(() => import("./pages/courses/LearningSupportPage.jsx"));
const AcquisitionPage = lazy(() => import("./pages/courses/AcquisitionPage.jsx"));
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
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const refresh = () => dispatch(fetchCurrentUser({ background: true }));
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, [dispatch, userId]);
  return <Routes key={user?.id || "signed-out"}>
    <Route element={<PublicLayout />}><Route path="/" element={<PublicCatalogPage home />} /><Route path="/catalog" element={<PublicCatalogPage />} /><Route path="/catalog/:slug" element={<PublicCoursePage />} /></Route>
    <Route element={<ProtectedRoute publicOnly />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /></Route>
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute allowPasswordChange />}><Route path="/change-password" element={<ChangePasswordPage />} /></Route>
    <Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}>
      <Route path="/dashboard" element={<DashboardIndex />} />
      <Route path="/courses" element={<CoursesPage />} /><Route path="/courses/:id" element={<CourseDetailsPage />} />
      <Route element={<ProtectedRoute roles={["student"]} />}><Route path="/courses/:id/support" element={<Suspense fallback={<p role="status">Loading learning support…</p>}><LearningSupportPage /></Suspense>} /></Route>
      <Route element={<ProtectedRoute roles={["student"]} />}><Route path="/student" element={<StudentDashboardPage />} /><Route path="/payments" element={<PaymentHistoryPage />} /><Route path="/payments/:id" element={<PaymentStatusPage />} /><Route path="/courses/:id/assessments" element={<StudentAssessmentsPage />} /><Route path="/assessment-attempts/:id" element={<AssessmentAttemptPage />} /></Route>
      <Route element={<ProtectedRoute roles={["instructor", "admin"]} />}>
        <Route path="/instructor" element={<MyCoursesPage />} /><Route path="/instructor/courses" element={<MyCoursesPage />} />
        <Route path="/instructor/courses/new" element={<CreateCoursePage />} /><Route path="/instructor/courses/:id/curriculum" element={<CurriculumPage />} />
        <Route path="/instructor/courses/:id/edit" element={<CreateCoursePage />} />
        <Route path="/instructor/courses/:id/assessments" element={<AssessmentAuthorPage />} />
        <Route path="/instructor/courses/:id/acquisition" element={<Suspense fallback={<p role="status">Loading course acquisition…</p>}><AcquisitionPage /></Suspense>} />
        <Route path="/instructor/courses/:id/support" element={<Suspense fallback={<p role="status">Loading learning support…</p>}><LearningSupportPage /></Suspense>} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}><Route path="/admin" element={<AdminPage />} /><Route path="/admin/courses/upload" element={<CreateCoursePage />} /></Route>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
