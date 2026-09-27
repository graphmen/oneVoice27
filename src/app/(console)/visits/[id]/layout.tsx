export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function VisitIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
