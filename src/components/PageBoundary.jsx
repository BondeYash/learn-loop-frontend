import { Component } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous) { if (this.state.failed && previous.path !== this.props.path) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="page-recovery" aria-labelledby="page-recovery-title"><p className="eyebrow">Let’s get you back to learning</p><h1 id="page-recovery-title">This page couldn’t open.</h1><p role="alert">A connection problem or a recent update may have interrupted it. Reload to try again. Check any unsaved work before leaving.</p><div><button type="button" className="btn-primary" onClick={() => window.location.reload()}><RefreshCw size={18} aria-hidden="true" />Reload page</button><Link className="btn-secondary" to="/"><ArrowLeft size={18} aria-hidden="true" />Home</Link></div></main>;
  }
}
export default function PageBoundary({ children }) {
  const { pathname } = useLocation();
  return <Boundary path={pathname}>{children}</Boundary>;
}
