import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate("/", { replace: true });
    } catch {
      toast.error("Invalid email or password");
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Password</label>
          <input
            type="password"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
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
    </div>
  );
}
