import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

export function useUnreadCounts() {
  const user = useAuthStore((s) => s.user)

  const { data: notifCount = 0 } = useQuery({
    queryKey: ['unread-notif', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('read', false)
      return count ?? 0
    },
    enabled: !!user,
    refetchInterval: 30_000,
  })

  const { data: msgCount = 0 } = useQuery({
    queryKey: ['unread-msg', user?.id],
    queryFn: async () => {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
      if (!convs?.length) return 0
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convs.map((c) => c.id))
        .eq('read', false)
        .neq('sender_id', user!.id)
      return count ?? 0
    },
    enabled: !!user,
    refetchInterval: 30_000,
  })

  return { notifCount, msgCount }
}
