import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { TEMPORARY_PASSWORD_EXPIRED } from "../lib/authErrors";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const login = useAuthStore((s) => s.login);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      const must = useAuthStore.getState().user?.must_change_password === true;
      if (must) {
        toast.success("Please set a new password to continue.");
        navigate("/change-password", { replace: true });
      } else {
        toast.success("Welcome back");
        navigate("/", { replace: true, state: { scrollChatToBottom: true } });
      }
    } catch (e) {
      const ax = e as AxiosError<{ detail?: string }>;
      const d = ax.response?.data?.detail;
      if (d === TEMPORARY_PASSWORD_EXPIRED) {
        toast.error("This recovery password has expired. Use “Forgot password?” to get a new one.");
        return;
      }
      toast.error(typeof d === "string" ? d : "Invalid email or password");
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSubmitting(true);
    try {
      const message = await requestPasswordReset(forgotEmail.trim());
      toast.success(message);
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>;
      const d = ax.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Something went wrong. Try again later.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white">Sign in</h1>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Email</label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-xs text-slate-400">Password</label>
            <button
              type="button"
              className="text-xs text-violet-400 hover:underline"
              onClick={() => {
                setForgotEmail(email.trim());
                setForgotOpen(true);
              }}
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Login
        </button>
        <p className="text-center text-sm text-slate-500">
          No account?{" "}
          <Link to="/register" className="text-violet-400 hover:underline">
            Register
          </Link>
        </p>
      </form>

      {forgotOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !forgotSubmitting) setForgotOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="forgot-password-title" className="text-lg font-semibold text-white">
              Reset password
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Enter your email. If an account exists, we will send password recovery instructions.
            </p>
            <form onSubmit={submitForgot} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Email</label>
                <input
                  type="email"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-slate-600 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  disabled={forgotSubmitting}
                  onClick={() => setForgotOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  disabled={forgotSubmitting}
                >
                  {forgotSubmitting ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
