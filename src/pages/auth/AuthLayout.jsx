import { Link } from "react-router-dom";
import Brand from "../../components/Brand.jsx";
import { ThemeToggle } from "../../theme/ThemeProvider.jsx";
export default function AuthLayout({ children }) {
  return <main className="auth-shell relative grid min-h-screen place-items-center px-4 py-16"><div className="absolute right-5 top-5"><ThemeToggle /></div><section className="w-full max-w-md"><Link to="/" className="mb-8 flex justify-center"><Brand large /></Link>{children}</section></main>;
}
