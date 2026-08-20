"use client";

import { useRef, useState } from "react";

// One photo's edit controls, spelled out rather than hung on the thumbnail as
// glyphs. The corner ✕ this replaces was unlabeled and — because it rendered
// for anyone with edit rights, all the time — read as a broken-image marker
// sitting on every photo.
//
// Shared by the gallery card and by the thumbnail strip under the main photo,
// so a rep meets the same three words wherever a photo is on screen.
export function PhotoManageControls({
  onSetAsMain,
  onReplace,
  onDelete,
  isCurrentMain = false,
}: {
  // Absent when this photo can't be promoted — it's already the main photo, or
  // it's the seed image, which has no row to promote.
  onSetAsMain?: () => void;
  onReplace?: (file: File) => void;
  onDelete?: () => void;
  // Shown as a label rather than a button: this is the one on the listing.
  isCurrentMain?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Removing a photo is confirmed here, the way deleting a listing is (see the
  // isConfirmingDelete block in EditBobbleheadDialog). It used to call
  // window.confirm, which is not a control we own: a browser that suppresses
  // JS dialogs — an iOS "Block Alerts from this webpage" that the user can't
  // easily undo, or an in-app webview like Facebook's or Gmail's — hands back
  // false, so the click returned before it ever reached the database and the
  // button looked simply dead. Reported by the Padres rep, on whose phone
  // Remove did nothing at all while working everywhere we tried it.
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const buttonClass =
    "rounded border border-border-soft bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-navy transition hover:border-accent hover:text-accent";
  const dangerClass =
    "rounded border border-red-400/60 bg-red-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-500 transition hover:bg-red-500 hover:text-white";

  if (isConfirmingRemove && onDelete) {
    return (
      <div className="mt-1 flex w-20 flex-wrap justify-center gap-1">
        <p className="w-full text-center text-[10px] font-black uppercase tracking-wide text-red-500">
          Remove for everyone?
        </p>
        <button
          type="button"
          onClick={() => {
            setIsConfirmingRemove(false);
            onDelete();
          }}
          className={dangerClass}
        >
          Yes
        </button>
        <button type="button" onClick={() => setIsConfirmingRemove(false)} className={buttonClass}>
          No
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex w-20 flex-wrap justify-center gap-1">
      {isCurrentMain ? (
        <span className="rounded border border-accent bg-accent/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent">
          Main
        </span>
      ) : onSetAsMain ? (
        <button type="button" onClick={onSetAsMain} className={buttonClass}>
          Main
        </button>
      ) : null}
      {onReplace ? (
        <>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonClass}>
            Swap
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset so picking the same file twice still fires a change.
              event.target.value = "";
              if (file) onReplace(file);
            }}
          />
        </>
      ) : null}
      {onDelete ? (
        <button type="button" onClick={() => setIsConfirmingRemove(true)} className={dangerClass}>
          Remove
        </button>
      ) : null}
    </div>
  );
}
