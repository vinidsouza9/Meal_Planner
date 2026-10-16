import { useState } from 'react';
import Cropper from 'react-easy-crop';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/Loading';
import { PHOTO_SIZES, cropPhoto, type PhotoCrop, type PixelCrop } from '@/lib/photo-crop';

export function PhotoEditor({ src, kind, initial, onSave, onCancel }: { src: string; kind: 'recipe' | 'avatar'; initial?: PhotoCrop | null; onSave: (blob: Blob, crop: PhotoCrop) => Promise<void> | void; onCancel: () => void }) {
  const [crop, setCrop] = useState({ x: initial?.x ?? 0, y: initial?.y ?? 0 });
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [rotation, setRotation] = useState(initial?.rotation ?? 0);
  const [pixels, setPixels] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!pixels || busy) return;
    setBusy(true);
    try { await onSave(await cropPhoto(src, pixels, rotation, kind), { ...crop, zoom, rotation }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the photo."); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-y-auto" onInteractOutside={(e) => { if (busy) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}>
      <DialogHeader><DialogTitle>Adjust photo</DialogTitle><DialogDescription>{kind === 'avatar' ? 'Profile photo' : 'Recipe picture'}</DialogDescription></DialogHeader>
      <div className="photo-crop relative h-64 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-80">
        <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={PHOTO_SIZES[kind].aspect} cropShape={kind === 'avatar' ? 'round' : 'rect'} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_, area) => setPixels(area)} keyboardStep={10} cropperProps={{ 'aria-label': 'Photo crop frame', tabIndex: 0 }} />
      </div>
      <div className="flex items-center gap-4"><Label htmlFor="photo-zoom">Zoom</Label><input id="photo-zoom" aria-label="Photo zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="min-w-0 flex-1 accent-primary" /><span className="w-12 text-right text-sm tabular-nums">{zoom.toFixed(1)}×</span><Button type="button" variant="outline" size="icon" aria-label="Rotate photo 90 degrees" title="Rotate photo" onClick={() => setRotation((r) => (r + 90) % 360)} disabled={busy}><RotateCw /></Button></div>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button><LoadingButton onClick={save} disabled={!pixels} loading={busy} loadingText="Saving...">Save</LoadingButton></div>
    </DialogContent>
  </Dialog>;
}