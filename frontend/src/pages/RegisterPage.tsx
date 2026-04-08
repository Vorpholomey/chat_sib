import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(username, email, password);
      toast.success("Account created");
      navigate("/", { replace: true, state: { scrollChatToBottom: true } });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail)
          : "Registration failed";
      toast.error(msg || "Registration failed");
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
      >
        <h1 className="text-xl font-semibold text-white">Create account</h1>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Username</label>
          <input
            required
            minLength={1}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
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
            minLength={6}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Register
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-violet-400 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
