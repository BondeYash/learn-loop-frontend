import { Children, forwardRef, isValidElement } from "react";
import { Link } from "react-router-dom";
import { Archive, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ClipboardCheck, CreditCard, EyeOff, LogIn, Pencil, Plus, RefreshCw, Save, Search, Send, ShieldCheck, SlidersHorizontal, ThumbsDown, ThumbsUp, Trash2, Upload, X } from "lucide-react";

const textOf = children => Children.toArray(children).map(child => typeof child === "string" || typeof child === "number" ? String(child) : isValidElement(child) ? textOf(child.props.children) : "").join(" ");
const hasIcon = children => Children.toArray(children).some(child => isValidElement(child) && (child.type === "svg" || child.type?.displayName || child.type?.render?.displayName || hasIcon(child.props.children)));
function actionIcon(label) {
  const text = label.trim().toLowerCase();
  if (!text || /^\d/.test(text)) return null;
  for (const [pattern, Icon] of [
    [/unpublish|hide/, EyeOff], [/unhelpful|needs help/, ThumbsDown], [/helpful/, ThumbsUp],
    [/remove|delete|revoke|discard/, Trash2], [/cancel|close|clear|dismiss/, X],
    [/back|previous/, ArrowLeft], [/refresh|reload|retry|try again/, RefreshCw],
    [/search|find/, Search], [/filter/, SlidersHorizontal], [/upload|import|extract/, Upload],
    [/save/, Save], [/publish|send|ask|reply/, Send], [/edit|change|rename/, Pencil],
    [/pay|purchase|checkout/, CreditCard], [/sign in|log in|sign up|register/, LogIn],
    [/create|add|new/, Plus], [/archive/, Archive], [/grant|access|restore/, ShieldCheck],
    [/complete|confirm|resolve|apply/, Check], [/test|quiz|attempt/, ClipboardCheck],
    [/course|lesson|learn/, BookOpen], [/view|open|explore|browse|start|continue|next/, ArrowUpRight],
  ]) if (pattern.test(text)) return Icon;
  return ArrowRight;
}
function Content({ children, label, back }) {
  const Icon = hasIcon(children) ? null : back ? ArrowLeft : actionIcon(label || textOf(children));
  return <>{Icon && <Icon className="action-icon" size={17} strokeWidth={2} aria-hidden="true" />}{children}</>;
}
export const Button = forwardRef(function Button({ children, className = "", ...props }, ref) {
  return <button ref={ref} className={`app-button ${className}`} {...props}><Content label={props["aria-label"]}>{children}</Content></button>;
});
export const ActionLink = forwardRef(function ActionLink({ children, className = "", ...props }, ref) {
  return <Link ref={ref} className={`app-action-link ${className}`} {...props}><Content label={props["aria-label"]}>{children}</Content></Link>;
});
export function BackLink({ children, className = "", ...props }) {
  return <Link className={`back-link ${className}`} {...props}><Content back>{children}</Content></Link>;
}
