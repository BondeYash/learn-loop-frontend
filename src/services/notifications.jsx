import { toast as showToast } from "react-toastify";

const labels = { success: "Success", error: "Error", info: "Information", warning: "Attention" };
const pending = new Map();

function notify(type, message) {
  // Include queued notifications so repeat submissions cannot fill the queue.
  const key = JSON.stringify([type, message]);
  if (pending.has(key)) return pending.get(key);
  const id = showToast[type](<div className="notification-copy"><strong>{labels[type]}</strong><p tabIndex={typeof message === "string" && message.length > 280 ? 0 : undefined}>{message}</p></div>, {
    role: type === "error" || type === "warning" ? "alert" : "status",
    autoClose: type === "error" || type === "warning" ? false : type === "info" ? 6500 : 4500,
    progressStyle: { "--notification-duration": type === "info" ? "6500ms" : "4500ms" },
    onClose: () => pending.delete(key),
  });
  pending.set(key, id);
  return id;
}

export const toast = Object.fromEntries(Object.keys(labels).map((type) => [type, (message) => notify(type, message)]));
