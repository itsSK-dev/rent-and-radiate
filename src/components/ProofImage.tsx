import { useSignedProofUrl } from "@/lib/proofUrl";
import { ImgHTMLAttributes } from "react";

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
}

/** Renders a rental-proofs image via short-lived signed URL. */
export function ProofImage({ src, alt = "", ...rest }: Props) {
  const signed = useSignedProofUrl(src);
  if (!signed) {
    return <div className={`bg-muted animate-pulse ${rest.className ?? ""}`} aria-label={alt} />;
  }
  return <img src={signed} alt={alt} {...rest} />;
}

export function ProofLink({ src, children, className }: { src: string; children: React.ReactNode; className?: string }) {
  const signed = useSignedProofUrl(src);
  return (
    <a
      href={signed ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(e) => { if (!signed) e.preventDefault(); }}
    >
      {children}
    </a>
  );
}
