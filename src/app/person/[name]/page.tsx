import PersonClient from "./PersonClient";

export default function Page({ params }: { params: { name: string } }) {
  const decoded = decodeURIComponent(params.name ?? "");
  return <PersonClient name={decoded} />;
}
