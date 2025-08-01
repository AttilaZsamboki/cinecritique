import MovieDetailsClient from "./MovieDetailsClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MovieDetailsClient movieId={id} />;
}