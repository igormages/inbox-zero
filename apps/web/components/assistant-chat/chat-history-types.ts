import type { GetChatsResponse } from "@/app/api/chats/route";
import type { InterfaceLanguage } from "@/components/LanguageProvider";

export type ChatHistoryEntry = GetChatsResponse["chats"][number];

export function getChatHistoryLabel(
  chat: Pick<ChatHistoryEntry, "name" | "createdAt">,
  language: InterfaceLanguage,
): string {
  if (chat.name !== null) return chat.name;

  const createdAt = new Date(chat.createdAt);
  if (language === "fr") {
    const date = createdAt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const time = createdAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Conversation du ${date} à ${time}`;
  }

  return `Chat from ${createdAt.toLocaleString("en-US")}`;
}
