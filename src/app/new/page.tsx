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
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col w-full max-w-[600px] py-8 flex-1">
            <div className="glass-strong rounded-2xl p-8 shadow-elegant-xl border border-white/30">
              <div className="text-center mb-8">
                <h1 className="gradient-text text-4xl font-bold leading-tight mb-2">Add New Movie</h1>
                <p className="text-[#6b4a4c] text-sm">Create a new movie entry for evaluation</p>
              </div>
              
              <form action={create} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#6b4a4c] mb-2">🎬 Movie Title</label>
                  <input
                    id="title-input"
                    placeholder="Enter movie title (e.g., Inception)"
                    name="title"
                    className="focus-ring w-full px-4 py-3 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e] font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#6b4a4c] mb-2">📺 Type</label>
                  <select
                    name="type"
                    className="focus-ring w-full px-4 py-3 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 text-[#1b0e0e] font-medium"
                  >
                    <option value="">Select type</option>
                    <option value="movie">Movie</option>
                    <option value="series">Series</option>
                    <option value="episode">Episode</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#6b4a4c] mb-2">📅 Release Year</label>
                  <input
                    id="year-input"
                    placeholder="Enter release year (e.g., 2010)"
                    className="focus-ring w-full px-4 py-3 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e] font-medium"
                    type="number"
                    name="year"
                    min="1900"
                    max="2030"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#6b4a4c] mb-2">🎭 Genre</label>
                  <input
                    placeholder="Enter genres (e.g., Action, Sci-Fi, Thriller)"
                    className="focus-ring w-full px-4 py-3 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e] font-medium"
                    name="genre"
                  />
                </div>
                <div className="space-y-2">
                  <PosterUrlField />
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full px-6 py-4 bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white rounded-xl font-semibold shadow-elegant hover:shadow-elegant-lg transition-all duration-300 hover:scale-105 hover:from-[#7a3d41] hover:to-[#5d2e32] flex items-center justify-center gap-2"
                  >
                    <span>✨</span>
                    Add Movie
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
    )}