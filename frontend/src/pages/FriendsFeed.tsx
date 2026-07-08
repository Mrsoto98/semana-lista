import { useInfiniteQuery } from '@tanstack/react-query'
import { feedApi } from '../lib/queries'
import { DreamCard } from '../components/dreams/DreamCard'
import { Button } from '../components/ui/Button'

export default function FriendsFeed() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', 'friends'],
    queryFn: ({ pageParam = 0 }) =>
      feedApi.friends({ limit: 20, offset: pageParam as number }).then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.length < 20 ? undefined : all.flat().length,
  })

  const dreams = data?.pages.flat() ?? []

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Feed de amigos</h1>
        <p className="text-slate-400 text-sm mt-0.5">Sueños que tus amigos han compartido contigo</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-dream-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dreams.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-slate-400 text-lg">Aquí aparecerán los sueños de tus amigos.</p>
          <p className="text-slate-500 text-sm mt-1">Añade amigos y pídeles que compartan sus sueños.</p>
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
