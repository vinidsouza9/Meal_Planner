import { supabase } from '@/integrations/supabase/client';
export const profileQuery = {
  queryKey: ['profile', 'account'],
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error('Please log in again.');
    const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
    if (error) throw error;
    let avatarSrc: string | null = null;
    if (data.avatar_url) { const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(data.avatar_url, 3600); avatarSrc = signed?.signedUrl ?? null; }
    return { ...data, email: auth.user.email ?? '', avatarSrc };
  },
  staleTime: 60_000,
};