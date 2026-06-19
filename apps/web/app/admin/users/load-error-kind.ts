export function classifyAdminUsersLoadErrorKind(message: string | null): "error" | "offline" | null {
  if (!message) {
    return null;
  }

  return /network|offline|fetch|timeout|econn|enotfound|네트워크|오프라인|연결|status\s*(408|429|502|503|504)/i.test(message)
    ? "offline"
    : "error";
}
