export type ContentType = "text" | "image" | "gif";

export type ChatMode = "global" | "private";

/** Normalized row for UI */
export type ChatLine = {
  id: string | number;
  at: string;
  /** Label before colon */
  author: string;
  body: string;
  contentType: ContentType;
  senderId?: number;
  recipientId?: number;
};

export type SidebarUser = {
  id: number;
  username: string;
  online: boolean;
};
