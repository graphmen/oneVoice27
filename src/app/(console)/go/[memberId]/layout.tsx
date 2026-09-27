export function generateStaticParams() {
  return [{ memberId: "_" }];
}

export default function GoMemberLayout({ children }: { children: React.ReactNode }) {
  return children;
}
