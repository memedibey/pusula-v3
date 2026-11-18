export function isMobileOrTablet(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ""))
  );
}

export async function shareOrDownloadBlob(
  blob: Blob,
  filename: string,
  onNotify?: (msg: string) => void
): Promise<void> {
  if (isMobileOrTablet() && typeof File !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([blob], filename, {
        type: blob.type || "application/octet-stream"
      });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        onNotify?.("Dosya paylaşıldı / kaydedildi.");
        return;
      }
    } catch (err) {
      if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // yoksay
    }
  }, 60000);
}