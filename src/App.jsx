import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import Brand from "./components/Brand.jsx";
import { ThemeToggle } from "./theme/ThemeProvider.jsx";
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
function Home() {
  return <main className="auth-shell relative flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center"><div className="absolute right-5 top-5"><ThemeToggle /></div><Brand large /><h1 className="max-w-2xl font-display text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">A little progress.<br /><span className="text-slate-500 dark:text-slate-400">A world of possibility.</span></h1><p className="max-w-lg text-slate-600 dark:text-slate-300">A focused place to teach and learn. Instructors share video courses with their students; students find their assigned learning in one place.</p><div className="flex gap-3"><Link className="btn-primary" to="/dashboard">Go to dashboard</Link><Link className="btn-secondary" to="/register">Create an account</Link></div></main>;
}
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
    <Route path="/" element={<Home />} />
    <Route element={<ProtectedRoute publicOnly />}><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /></Route>
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute allowPasswordChange />}><Route path="/change-password" element={<ChangePasswordPage />} /></Route>
    <Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}>
      <Route path="/dashboard" element={<DashboardIndex />} />
      <Route path="/courses" element={<CoursesPage />} /><Route path="/courses/:id" element={<CourseDetailsPage />} />
      <Route element={<ProtectedRoute roles={["student"]} />}><Route path="/student" element={<StudentDashboardPage />} /></Route>
      <Route element={<ProtectedRoute roles={["instructor", "admin"]} />}>
        <Route path="/instructor" element={<MyCoursesPage />} /><Route path="/instructor/courses" element={<MyCoursesPage />} />
        <Route path="/instructor/courses/new" element={<CreateCoursePage />} /><Route path="/instructor/courses/:id/curriculum" element={<CurriculumPage />} />
        <Route path="/instructor/courses/:id/edit" element={<CreateCoursePage />} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}><Route path="/admin" element={<AdminPage />} /><Route path="/admin/courses/upload" element={<CreateCoursePage />} /></Route>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
