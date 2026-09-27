"use client";

import { useParams, usePathname } from "next/navigation";

/** Reads a dynamic segment from the URL so static Hosting rewrites still resolve the real id. */
export function useRouteParam(name: string) {
  const params = useParams();
  const pathname = usePathname();
  const baked = params?.[name];
  const value = Array.isArray(baked) ? baked[0] : baked;
  if (value && value !== "_") return value;
  const parts = pathname.split("/").filter(Boolean);
  return parts[1] || value || "";
}
