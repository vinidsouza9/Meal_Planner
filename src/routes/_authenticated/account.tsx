import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { profileQuery } from '@/lib/profile';
import { pageMeta } from '@/lib/metadata';
import { readablePhoto, type PhotoCrop } from '@/lib/photo-crop';
import { PhotoEditor } from '@/components/PhotoEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton, ListSkeleton } from '@/components/Loading';

export const Route = createFileRoute('/_authenticated/account')({ head: () => pageMeta('Account', 'Manage your Meal Planner name, profile photo and password.'), component: Account });
function Account() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery(profileQuery);
  const [first, setFirst] = useState(''); const [last, setLast] = useState('');
  const [busy, setBusy] = useState(false); const [resetBusy, setResetBusy] = useState(false);
  const [editor, setEditor] = useState<{ src: string; original?: Blob; crop?: PhotoCrop | null } | null>(null);
  useEffect(() => { if (profile) { setFirst(profile.first_name); setLast(profile.last_name); } }, [profile?.id, profile?.first_name, profile?.last_name]);
  function close() { if (editor?.src.startsWith('blob:')) URL.revokeObjectURL(editor.src); setEditor(null); }
  async function pick(file?: File) {
    if (!file) return;
    if (!/image\/(jpeg|png|heic|heif)/i.test(file.type) && !/\.(jpe?g|png|heic|heif)$/i.test(file.name)) { toast.error('Please use a JPG, PNG or HEIC photo.'); return; }
    try { const original = await readablePhoto(file); setEditor({ src: URL.createObjectURL(original), original }); }
    catch { toast.error("Couldn't open the photo. Try a JPG or PNG."); }
  }
  async function adjust() {
    const path = profile?.original_avatar_url || profile?.avatar_url;
    if (!path) return;
    const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
    if (error || !data) { toast.error("Couldn't open the original photo."); return; }
    setEditor({ src: data.signedUrl, crop: profile?.avatar_crop as PhotoCrop | null });
  }
  async function savePhoto(blob: Blob, crop: PhotoCrop) {
    if (!profile || !editor) return;
    const bucket = supabase.storage.from('avatars');
    const uploaded: string[] = [];
    async function upload(file: Blob) { const path = `${profile?.id}/${crypto.randomUUID()}.jpg`; const { error } = await bucket.upload(path, file, { contentType: 'image/jpeg' }); if (error) throw new Error("Couldn't upload the photo."); uploaded.push(path); return path; }
    try {
      const avatar_url = await upload(blob);
      const original_avatar_url = editor.original ? await upload(editor.original) : profile.original_avatar_url || profile.avatar_url;
      const { error } = await supabase.from('profiles').update({ avatar_url, original_avatar_url, avatar_crop: crop }).eq('id', profile.id);
      if (error) throw new Error("Couldn't save the photo.");
      const obsolete = [...new Set([profile.avatar_url, profile.original_avatar_url])].filter((p): p is string => !!p && p !== avatar_url && p !== original_avatar_url);
      if (obsolete.length) await bucket.remove(obsolete);
      await qc.invalidateQueries({ queryKey: ['profile'] }); close(); toast.success('Photo saved');
    } catch (e) { await bucket.remove(uploaded); throw e; }
  }
  async function remove() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: null, original_avatar_url: null, avatar_crop: null }).eq('id', profile.id);
      if (error) throw error;
      const paths = [...new Set([profile.avatar_url, profile.original_avatar_url])].filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from('avatars').remove(paths);
      await qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Photo removed');
    } catch { toast.error("Couldn't remove the photo."); } finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!profile || busy) return;
    if (!first.trim() || !last.trim()) { toast.error('Enter your first and last name.'); return; }
    setBusy(true);
    try { const { error } = await supabase.from('profiles').update({ first_name: first.trim(), last_name: last.trim() }).eq('id', profile.id); if (error) throw error; await qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Account saved'); }
    catch { toast.error("Couldn't save your account."); } finally { setBusy(false); }
  }
  async function reset() {
    if (!profile || resetBusy) return; setResetBusy(true);
    try { const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error; toast.success('Password reset email sent. Check your inbox.'); }
    catch { toast.error("Couldn't send the reset email. Try again."); } finally { setResetBusy(false); }
  }
  if (isLoading) return <main className="mx-auto max-w-xl px-5 py-8"><ListSkeleton label="Loading account" /></main>;
  if (!profile) return <main className="mx-auto max-w-xl px-5 py-8"><p role="alert">Couldn't load your account.</p><Button onClick={() => qc.invalidateQueries({ queryKey: ['profile'] })}>Try again</Button></main>;
  return <main className="mx-auto max-w-xl space-y-8 px-5 py-8">
    <h1 className="font-display text-3xl">Account</h1>
    <section className="space-y-4"><h2 className="font-semibold">Profile photo</h2><div className="flex flex-wrap items-center gap-4">
      {profile.avatarSrc ? <img src={profile.avatarSrc} alt={`${profile.first_name || 'Your'} profile photo`} className="size-24 rounded-full object-cover" /> : <span className="grid size-24 place-items-center rounded-full bg-primary font-display text-3xl text-primary-foreground">{(profile.first_name[0] || profile.email[0] || '?').toUpperCase()}</span>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><label><ImagePlus />Upload photo<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" className="sr-only" aria-label="Upload profile photo" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label></Button>
      {profile.avatar_url && <><Button variant="outline" onClick={adjust}>Adjust photo</Button><Button variant="ghost" onClick={remove} disabled={busy}><Trash2 />Remove photo</Button></>}</div>
    </div></section>
    <form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="account-first">First name</Label><Input id="account-first" required maxLength={100} autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="account-last">Last name</Label><Input id="account-last" required maxLength={100} autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} /></div></div>
    <div className="space-y-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" readOnly value={profile.email} /><p className="text-sm text-muted-foreground">Email can't be changed.</p></div><LoadingButton type="submit" loading={busy} loadingText="Saving...">Save</LoadingButton></form>
    <section className="border-t pt-6"><LoadingButton variant="outline" onClick={reset} loading={resetBusy} loadingText="Sending...">Send password reset email</LoadingButton></section>
    {editor && <PhotoEditor src={editor.src} kind="avatar" initial={editor.crop} onSave={savePhoto} onCancel={close} />}
  </main>;
}