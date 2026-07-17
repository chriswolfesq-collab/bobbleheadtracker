"use client";

/**
 * Copies text, falling back when the async Clipboard API is unavailable.
 *
 * navigator.clipboard is missing outside a secure context and throws
 * NotAllowedError in a handful of real situations the app can't detect ahead of
 * time — an unfocused document, Safari losing the user-gesture chain, an
 * embedded webview with clipboard-write denied by permissions policy. The
 * execCommand path is deprecated but synchronous, needs no permission, and
 * covers those cases, so it's worth keeping as a backstop rather than telling
 * someone their link can't be copied.
 *
 * Returns false only if both paths failed; callers surface that to the user.
 * The real error is logged either way — swallowing it silently is what made the
 * first version of this undiagnosable.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.error("Clipboard API copy failed, trying execCommand:", error);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // readOnly rather than disabled: iOS won't select a disabled field. Kept on
    // screen but invisible, since position:fixed off-screen makes iOS scroll.
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);

    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const didCopy = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!didCopy) console.error("execCommand('copy') returned false");
    return didCopy;
  } catch (error) {
    console.error("Fallback copy failed:", error);
    return false;
  }
}
