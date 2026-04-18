import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

type Props = {
  children: React.ReactNode;
  /** Chat and other app areas that require a completed password (not temporary). */
  mode?: "app" | "changePassword";
};

export function ProtectedRoute({ children, mode = "app" }: Props) {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionChecked, setSessionChecked] = useState(() => {
    const s = useAuthStore.getState();
    return !s.accessToken || s.user != null;
  });

  useEffect(() => {
    if (!token) {
      setSessionChecked(true);
      return;
    }
    if (user) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    setSessionChecked(false);
    (async () => {
      try {
        await fetchMe();
      } catch {
        if (!cancelled) {
          logout();
          navigate("/login", { replace: true });
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, fetchMe, logout, navigate]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!sessionChecked || (token && !user)) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const mustChange = user.must_change_password === true;

  if (mode === "app" && mustChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (mode === "changePassword" && !mustChange) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
