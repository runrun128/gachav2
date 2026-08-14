const onlineUsers = new Map<string, Set<string>>();

export function addSocket(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

export function removeSocket(userId: string, socketId: string) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}
