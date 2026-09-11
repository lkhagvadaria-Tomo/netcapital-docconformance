import { Routes, Route } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SignIn } from "@/components/SignIn";
import { mn } from "@/i18n/mn";
import { Home } from "@/pages/Home";
import { Admin } from "@/pages/Admin";
import { Frameworks } from "@/pages/Frameworks";
import { ComingSoon } from "@/pages/ComingSoon";

export default function App() {
  const { loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-2">
        {mn.common.loading}
      </div>
    );
  }

  if (!profile) {
    return <SignIn />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/okr"
        element={<ComingSoon title={mn.nav.okrDocuments} phase="Phase 3–5" />}
      />
      <Route path="/frameworks" element={<Frameworks />} />
      <Route
        path="/audit"
        element={<ComingSoon title={mn.nav.audit} phase="Phase 3–5" />}
      />
      <Route
        path="/findings"
        element={<ComingSoon title={mn.nav.findings} phase="Phase 3–5" />}
      />
      <Route
        path="/outputs"
        element={<ComingSoon title={mn.nav.outputs} phase="Phase 6" />}
      />
      <Route
        path="/approvals"
        element={<ComingSoon title={mn.nav.approvals} phase="Phase 7" />}
      />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
