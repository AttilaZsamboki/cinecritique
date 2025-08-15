import MoviePageClient from "./MoviePageClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MoviePageClient movieId={id} />;
}