import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { feedApi } from '../lib/queries'
import { DreamCard } from '../components/dreams/DreamCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function PublicFeed() {
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', 'public', activeSearch],
    queryFn: ({ pageParam = 0 }) =>
      feedApi
        .public({ limit: 20, offset: pageParam as number, search: activeSearch || undefined })
        .then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.length < 20 ? undefined : all.flat().length,
  })

  const dreams = data?.pages.flat() ?? []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Feed público</h1>
        <p className="text-slate-400 text-sm mt-0.5">Sueños que la comunidad ha elegido compartir</p>
      </div>

      {/* Search */}
      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => { e.preventDefault(); setActiveSearch(search) }}
      >
        <Input
          placeholder="Buscar por símbolo o tema…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">Buscar</Button>
        {activeSearch && (
          <Button type="button" variant="ghost" onClick={() => { setSearch(''); setActiveSearch('') }}>
            ✕
          </Button>
        )}
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-dream-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dreams.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🌐</div>
          <p className="text-slate-400 text-lg">
            {activeSearch ? `Sin resultados para "${activeSearch}"` : 'Aún no hay sueños públicos.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dreams.map((dream) => (
            <DreamCard key={dream.id} dream={dream} showAuthor />
          ))}
          {hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
              className="self-center mt-4"
            >
              Cargar más
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
