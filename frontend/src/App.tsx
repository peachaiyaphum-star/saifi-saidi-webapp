import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Upload } from "./pages/Upload";
import { Dashboard } from "./pages/Dashboard";
import { Targets } from "./pages/Targets";

function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <nav className="border-b bg-white px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-800 mr-4">SAIFI / SAIDI Dashboard</span>
        <NavLink to="/" end className={linkClass}>
          Dashboard
        </NavLink>
        {(user.role === "ADMIN" || user.role === "ENGINEER") && (
          <NavLink to="/upload" className={linkClass}>
            อัปโหลดรายงาน 50
          </NavLink>
        )}
        {user.role === "ADMIN" && (
          <NavLink to="/targets" className={linkClass}>
            ตั้งค่าเป้าหมาย
          </NavLink>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>
          {user.name} · {user.role}
        </span>
        <button onClick={logout} className="text-blue-600 hover:underline">
          ออกจากระบบ
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="p-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/targets"
            element={
              <ProtectedRoute>
                <Targets />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
