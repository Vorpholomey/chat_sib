import { api } from "./api";

export type ReadStateResponse = {
  last_read_message_id: number | null;
};

export async function getReadState(
  params: { scope: "global" } | { scope: "private"; peerId: number }
): Promise<ReadStateResponse> {
  if (params.scope === "global") {
    const { data } = await api.get<ReadStateResponse>("/api/read-state/global");
    return data;
  }
  const { data } = await api.get<ReadStateResponse>("/api/read-state/private", {
    params: { peer_id: params.peerId },
  });
  return data;
}

export type PatchReadStateInput =
  | { scope: "global"; last_read_message_id: number }
  | { scope: "private"; peer_id: number; last_read_message_id: number };

export async function patchReadState(body: PatchReadStateInput): Promise<ReadStateResponse> {
  if (body.scope === "global") {
    const { data } = await api.patch<ReadStateResponse>("/api/read-state/global", {
      last_read_message_id: body.last_read_message_id,
    });
    return data;
  }
  const { data } = await api.patch<ReadStateResponse>("/api/read-state/private", {
    peer_id: body.peer_id,
    last_read_message_id: body.last_read_message_id,
  });
  return data;
}
