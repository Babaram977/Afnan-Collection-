import { createServerFn } from "@tanstack/react-start";
import type { Product } from "./catalog";
export const loadCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest() as Request & {
      runtime?: { cloudflare?: { env?: import("../backend/types").CommerceEnv } };
    };
    const env = request.runtime?.cloudflare?.env;
    const { publicCatalog } = await import("../backend/api");
    if (!env?.DB) return [];
    return publicCatalog(env as import("../backend/types").CommerceEnv);
  },
);
export const loadCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest() as Request & {
    runtime?: { cloudflare?: { env?: import("../backend/types").CommerceEnv } };
  };
  const db = request.runtime?.cloudflare?.env?.DB;
  if (!db) return (await import("./catalog")).CATEGORIES;
  return (
    await db
      .prepare("SELECT slug,label FROM categories ORDER BY label")
      .all<{ slug: import("./catalog").CategorySlug; label: string }>()
  ).results;
});
export const loadBusiness = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest() as Request & {
    runtime?: { cloudflare?: { env?: import("../backend/types").CommerceEnv } };
  };
  if (!request.runtime?.cloudflare?.env?.DB) return (await import("./business")).business;
  return (await import("../backend/api")).businessConfig(request.runtime.cloudflare.env);
});
export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
export interface Me {
  userId: string | null;
  email: string | null;
  role: string | null;
}
export interface Zone {
  id: string;
  name: string;
  state: string;
  fee_kobo: number;
}
export interface Order {
  id: string;
  status: string;
  total_kobo: number;
  created_at: number;
  expires_at: number;
}
