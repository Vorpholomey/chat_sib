import axios from "axios";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { ACCOUNT_PERMANENTLY_BANNED } from "./authErrors";
import { API_BASE } from "./config";
import { useAuthStore } from "../store/authStore";
import type { ContentType } from "../types/chat";
import type { UserRole } from "../types/user";

/** Matches backend `CHAT_PAGE_SIZE`: initial WS batch and scroll-up pagination. */
export const CHAT_PAGE_SIZE = 10;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for file uploads (JSON default breaks POST /upload)
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    if (
      status === 403 &&
      typeof detail === "string" &&
      detail === ACCOUNT_PERMANENTLY_BANNED
    ) {
      useAuthStore.getState().logout();
      toast.error(detail);
      window.location.href = "/login";
      return Promise.reject(err);
    }
    if (status === 401) {
      useAuthStore.getState().logout();
      toast.error("Session expired. Please sign in again.");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

function errMessage(e: unknown): string {
  const ax = e as AxiosError<{ detail?: string | unknown }>;
  const d = ax.response?.data?.detail;
  if (typeof d === "string") return d;
  return ax.message || "Request failed";
}

export type CreateGlobalMessageBody = {
  text: string;
  content_type: ContentType;
  reply_to_id?: number | null;
  caption?: string | null;
};

export type UpdateMessageBody = {
  text?: string;
  content_type?: ContentType;
  caption?: string | null;
};

export async function postGlobalMessage(body: CreateGlobalMessageBody) {
  try {
    const { data } = await api.post("/api/messages", body);
    return data as unknown;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export async function putMessage(
  messageId: number | string,
  body: UpdateMessageBody,
  scope: "global" | "private"
) {
  try {
    const { data } = await api.put(`/api/messages/${messageId}`, body, {
      params: { scope },
    });
    return data as unknown;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export async function deleteMessage(messageId: number | string, scope: "global" | "private") {
  try {
    await api.delete(`/api/messages/${messageId}`, { params: { scope } });
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export async function pinGlobalMessage(messageId: number | string) {
  try {
    const { data } = await api.post(`/api/messages/${messageId}/pin`);
    return data as unknown;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export async function unpinGlobalMessage(messageId: number | string) {
  try {
    const { data } = await api.delete(`/api/messages/${messageId}/pin`);
    return data as unknown;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

/** Older global messages before `beforeId` (same shape as WebSocket payloads). */
export async function fetchGlobalHistoryBefore(
  beforeId: number | string,
  limit: number = CHAT_PAGE_SIZE
) {
  try {
    const { data } = await api.get<unknown[]>("/api/messages/global/history", {
      params: { before_id: beforeId, limit },
    });
    return data;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

/** Window of global messages around an id (same shape as WebSocket payloads). */
export async function fetchGlobalMessageContext(
  messageId: number | string,
  opts?: { before?: number; after?: number }
) {
  try {
    const { data } = await api.get<unknown[]>("/api/messages/global/context", {
      params: {
        message_id: messageId,
        before: opts?.before ?? 50,
        after: opts?.after ?? 50,
      },
    });
    return data;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

/** Full-history search: message ids in chronological order (text + image captions; not image URLs). */
export async function searchGlobalMessages(q: string): Promise<number[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  try {
    const { data } = await api.get<{ ids: number[] }>("/api/messages/global/search", {
      params: { q: trimmed },
    });
    return data.ids;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export async function searchPrivateMessages(peerId: number, q: string): Promise<number[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  try {
    const { data } = await api.get<{ ids: number[] }>(
      `/api/private/messages/${peerId}/search`,
      { params: { q: trimmed } }
    );
    return data.ids;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

/** Private thread window around an id (same shape as WebSocket / list endpoints). */
export async function fetchPrivateMessageContext(
  peerId: number,
  messageId: number | string,
  opts?: { before?: number; after?: number }
) {
  try {
    const { data } = await api.get<unknown[]>(`/api/private/messages/${peerId}/context`, {
      params: {
        message_id: messageId,
        before: opts?.before ?? 50,
        after: opts?.after ?? 50,
      },
    });
    return data;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export type BanDuration = "1h" | "24h" | "forever";

export async function banUser(userId: number, duration: BanDuration) {
  try {
    const { data } = await api.post(`/api/users/${userId}/ban`, { duration });
    return data as unknown;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}

export async function setUserRole(userId: number, role: Exclude<UserRole, "admin">) {
  try {
    const { data } = await api.put(`/api/users/${userId}/role`, { role });
    return data as unknown;
  } catch (e) {
    toast.error(errMessage(e));
    throw e;
  }
}
