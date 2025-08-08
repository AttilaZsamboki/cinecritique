import { redirect } from "next/navigation"
import { api } from "~/trpc/server"
import { revalidatePath } from "next/cache"
import PosterUrlField from "./PosterUrlField"

export default function Page() {
  async function create(formData: FormData) {
    'use server'
    const rawFormData = {
      type: formData.get("type") as string,
      year: parseInt((formData.get("year") ?? "") as string),
      genre: formData.get("genre") as string,
      title: formData.get("title") as string,
      posterUrl: (formData.get("posterUrl") as string) || undefined,
    }
    const movie = await api.movie.createMovie(rawFormData)
    if (!movie) return;
    revalidatePath("/")
    redirect("/"+movie[0]?.id)
  }
    return (
        <form action={create} className="px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col w-[512px] max-w-[512px] py-5 max-w-[960px] flex-1">
            <div className="flex flex-wrap justify-between gap-3 p-4"><p className="text-[#191011] tracking-light text-[32px] font-bold leading-tight min-w-72">Add New Movie</p></div>
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-[#191011] text-base font-medium leading-normal pb-2">Title</p>
                <input
                  id="title-input"
                  placeholder="Enter movie title"
                  name="title"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#191011] focus:outline-0 focus:ring-0 border border-[#e3d4d5] bg-[#fbf9f9] focus:border-[#e3d4d5] h-14 placeholder:text-[#8b5b5d] p-[15px] text-base font-normal leading-normal"
                />
              </label>
            </div>
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-[#191011] text-base font-medium leading-normal pb-2">Type</p>
                <input
                  placeholder="Enter a type"
                  name="type"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#191011] focus:outline-0 focus:ring-0 border border-[#e3d4d5] bg-[#fbf9f9] focus:border-[#e3d4d5] h-14 placeholder:text-[#8b5b5d] p-[15px] text-base font-normal leading-normal"
                />
              </label>
            </div>
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-[#191011] text-base font-medium leading-normal pb-2">Release Year</p>
                <input
                  id="year-input"
                  placeholder="Enter release year"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#191011] focus:outline-0 focus:ring-0 border border-[#e3d4d5] bg-[#fbf9f9] focus:border-[#e3d4d5] h-14 placeholder:text-[#8b5b5d] p-[15px] text-base font-normal leading-normal"
                  type="number"
                  name="year"
                />
              </label>
            </div>
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-[#191011] text-base font-medium leading-normal pb-2">Genre</p>
                <input
                  placeholder="Enter genre"
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#191011] focus:outline-0 focus:ring-0 border border-[#e3d4d5] bg-[#fbf9f9] focus:border-[#e3d4d5] h-14 placeholder:text-[#8b5b5d] p-[15px] text-base font-normal leading-normal"
                  name="genre"
                />
              </label>
            </div>
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <PosterUrlField />
            </div>
            <div className="flex px-4 py-3 justify-end">
              <button
              type="submit"
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 px-4 bg-[#e8b4b7] text-[#191011] text-sm font-bold leading-normal tracking-[0.015em]"
              >
                <span className="truncate">Add Movie</span>
              </button>
            </div>
          </div>
        </form>
    )}