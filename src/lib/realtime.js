import { supabase } from '@/lib/supabase';

export function subscribePostgresChanges(channelName, bindings) {
  const channel = supabase.channel(channelName);

  for (const binding of bindings) {
    const config = {
      event: binding.event || '*',
      schema: 'public',
      table: binding.table,
    };
    if (binding.filter) config.filter = binding.filter;
    channel.on('postgres_changes', config, (payload) => {
      binding.callback?.(payload);
    });
  }

  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.log('Realtime lỗi', channelName, status, err?.message || err);
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}
