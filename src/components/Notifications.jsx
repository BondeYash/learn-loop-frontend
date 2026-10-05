import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./notifications.css";

function NotificationIcon({ type }) {
  const Icon = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert }[type] || Info;
  return <span className="notification-icon" aria-hidden="true"><Icon size={22} strokeWidth={2} /></span>;
}

function CloseNotification({ closeToast }) {
  return <button type="button" className="notification-close" aria-label="Dismiss notification" onClick={closeToast}><X size={18} aria-hidden="true" /></button>;
}

export default function Notifications() {
  return <ToastContainer className="lessonloop-toasts" position="bottom-right" limit={2} autoClose={4500} role="status" theme="light" icon={NotificationIcon} closeButton={CloseNotification} closeOnClick={false} pauseOnHover pauseOnFocusLoss draggable={false} />;
}
