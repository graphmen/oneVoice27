export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function PastorIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
