import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { TEMPORARY_PASSWORD_EXPIRED } from "../lib/authErrors";
import { useAuthStore } from "../store/authStore";

export function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const changePasswordAfterTemporary = useAuthStore((s) => s.changePasswordAfterTemporary);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await changePasswordAfterTemporary(password, confirm);
      toast.success("Password updated");
      navigate("/", { replace: true, state: { scrollChatToBottom: true } });
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>;
      const d = ax.response?.data?.detail;
      if (d === TEMPORARY_PASSWORD_EXPIRED) {
        toast.error("This temporary password has expired. Use “Forgot password?” on the login page.");
        return;
      }
      toast.error(typeof d === "string" ? d : "Could not update password");
    }
  };

  const cancel = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white">Set a new password</h1>
        <p className="text-sm text-slate-400">
          Your account is using a temporary password. Choose a new one to continue.
        </p>
        <div>
          <label className="mb-1 block text-xs text-slate-400">New password</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Confirm password</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Save password
        </button>
        <button
          type="button"
          onClick={cancel}
          className="w-full rounded-lg border border-slate-600 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
