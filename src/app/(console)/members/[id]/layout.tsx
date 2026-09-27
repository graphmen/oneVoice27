export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function MemberIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
