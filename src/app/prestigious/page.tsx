"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";

export default function PrestigiousMoviesPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: prestigiousMovies, isLoading, error } = api.movie.getMostPrestigiousMovies.useQuery({
    limit: 50,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="glass-strong rounded-2xl p-8 shadow-elegant">
            <div className="animate-pulse">
              <div className="h-8 bg-[#e7d0d1] rounded-xl mb-4 w-1/3"></div>
              <div className="h-4 bg-[#e7d0d1] rounded-lg mb-8 w-2/3"></div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 space-y-3">
                    <div className="h-64 bg-[#e7d0d1] rounded-lg"></div>
                    <div className="h-6 bg-[#e7d0d1] rounded w-3/4"></div>
                    <div className="h-4 bg-[#e7d0d1] rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="glass-strong rounded-2xl p-8 shadow-elegant">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-[#994d51] mb-4">Error Loading Data</h1>
              <p className="text-[#6b4a4c]">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="glass-strong rounded-2xl p-8 shadow-elegant">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold gradient-text mb-4">Most Prestigious Movies</h1>
            <p className="text-[#6b4a4c] text-lg leading-relaxed">
              Movies ranked by their appearances across multiple "Best Of" categories. 
              Position matters: #1 spots earn 10 points, #2 earns 9 points, down to 1 point for #10+.
            </p>
          </div>

          {/* Movies Grid */}
          {prestigiousMovies && prestigiousMovies.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {prestigiousMovies.map((movie, index) => (
                <div key={movie.movieId} className="glass rounded-xl overflow-hidden hover:shadow-elegant-lg transition-all duration-300 hover:scale-105">
                  <Link href={`/${movie.movieId}`} className="block">
                    {/* Movie Poster */}
                    <div className="relative aspect-[2/3] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1]">
                      {movie.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={movie.posterUrl}
                          alt={movie.title ?? "Movie poster"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#6b4a4c]">
                          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      
                      {/* Rank Badge */}
                      <div className="absolute top-3 left-3 bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        #{index + 1}
                      </div>
                      
                      {/* Prestige Score */}
                      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-sm font-medium">
                        {movie.totalScore} pts
                      </div>
                    </div>

                    {/* Movie Info */}
                    <div className="p-4">
                      <h3 className="font-bold text-[#1b0e0e] mb-1 line-clamp-2">
                        {movie.title || movie.movieId}
                      </h3>
                      {movie.year && (
                        <p className="text-[#6b4a4c] text-sm mb-3">{movie.year}</p>
                      )}
                      
                      {/* Appearances Summary */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#6b4a4c]">Appears in:</span>
                          <span className="font-medium text-[#994d51]">
                            {movie.appearances.length} categories
                          </span>
                        </div>
                        
                        {/* Top Categories */}
                        <div className="space-y-1">
                          {(expanded[movie.movieId] ? movie.appearances : movie.appearances.slice(0, 3)).map((appearance) => (
                            <div key={appearance.criteriaId} className="flex items-center justify-between text-xs">
                              <span className="text-[#6b4a4c] truncate flex-1 mr-2">
                                {appearance.criteriaName}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[#994d51] font-medium">#{appearance.position+1}</span>
                                <span className="text-[#6b4a4c]">({appearance.score}pts)</span>
                              </div>
                            </div>
                          ))}
                          {movie.appearances.length > 3 && !expanded[movie.movieId] && (
                            <button
                              type="button"
                              className="text-xs text-[#994d51] hover:underline"
                              onClick={(e) => { e.preventDefault(); setExpanded((prev) => ({ ...prev, [movie.movieId]: true })); }}
                            >
                              +{movie.appearances.length - 3} more categories
                            </button>
                          )}
                          {movie.appearances.length > 3 && expanded[movie.movieId] && (
                            <button
                              type="button"
                              className="text-xs text-[#994d51] hover:underline"
                              onClick={(e) => { e.preventDefault(); setExpanded((prev) => ({ ...prev, [movie.movieId]: false })); }}
                            >
                              Show fewer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-[#6b4a4c] mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-[#994d51] mb-2">No Prestigious Movies Yet</h3>
              <p className="text-[#6b4a4c] mb-4">
                Start creating "Best Of" lists to see which movies appear most frequently across categories.
              </p>
              <Link
                href="/best-of"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white rounded-xl hover:shadow-elegant-lg transition-all duration-300 hover:scale-105"
              >
                Go to Best Of Lists
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
