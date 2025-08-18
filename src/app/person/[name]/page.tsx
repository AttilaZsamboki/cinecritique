import PersonClient from "./PersonClient";

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const decoded = decodeURIComponent((await params).name ?? "");
  return <PersonClient name={decoded} />;
}
