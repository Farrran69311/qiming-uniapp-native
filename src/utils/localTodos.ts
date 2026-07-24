import { storageLocal } from "@pureadmin/utils";
import { userKey } from "@/utils/auth";
import type { DataInfo } from "@/utils/auth";

const TODO_STORAGE_PREFIX = "qiming-local-todos";

export function getLocalTodoStorageKey() {
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  if (Number.isFinite(userInfo?.userId)) {
    return `${TODO_STORAGE_PREFIX}:user-${userInfo?.userId}`;
  }

  const username = userInfo?.username?.trim();
  return username
    ? `${TODO_STORAGE_PREFIX}:username-${encodeURIComponent(username)}`
    : null;
}

export function readLocalTodos<T>() {
  const key = getLocalTodoStorageKey();
  if (!key) return [] as T[];

  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [] as T[];
  }
}

export function saveLocalTodos<T>(todos: T[]) {
  const key = getLocalTodoStorageKey();
  if (!key) return false;

  try {
    localStorage.setItem(key, JSON.stringify(todos));
    return true;
  } catch {
    return false;
  }
}
