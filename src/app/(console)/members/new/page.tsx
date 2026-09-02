import { redirect } from "next/navigation";

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string; district?: string; territory?: string }>;
}) {
  const q = await searchParams;
  const params = new URLSearchParams({ type: "member" });
  if (q.church) params.set("church", q.church);
  if (q.district) params.set("district", q.district);
  if (q.territory) params.set("territory", q.territory);
  redirect(`/territories?${params.toString()}`);
}
