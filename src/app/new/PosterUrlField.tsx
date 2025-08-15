"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export default function PosterUrlField() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchMovieData = api.omdb.getByTitle.useMutation()

  const handleFetch = async () => {
    const titleInput = document.getElementById("title-input") as HTMLInputElement | null;
    const yearInput = document.getElementById("year-input") as HTMLInputElement | null;
    const title = titleInput?.value?.trim();
    const year = yearInput?.value?.trim();
    if (!title) {
      setError("Enter a title first");
      return;
    }
    setError(null);
    setLoading(true);
    fetchMovieData.mutate({title, year}, {onSuccess: (data) => setValue(data?.data?.Poster??"")})
  };

  return (
    <label className="flex flex-col min-w-40 flex-1">
      <p className="text-[#191011] text-base font-medium leading-normal pb-2">Poster URL</p>
      <div className="flex gap-2">
        <input
          id="poster-url-input"
          name="posterUrl"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://..."
          className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#191011] focus:outline-0 focus:ring-0 border border-[#e3d4d5] bg-[#fbf9f9] focus:border-[#e3d4d5] h-14 placeholder:text-[#8b5b5d] p-[15px] text-base font-normal leading-normal"
        />
        <button type="button" onClick={handleFetch} className="h-14 px-3 rounded-xl bg-[#f3e7e8] text-sm font-medium" disabled={loading}>
          {loading ? "Fetching..." : "Fetch Poster"}
        </button>
      </div>
      {error && <span className="text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}


