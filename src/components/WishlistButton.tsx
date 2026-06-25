import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { MouseEvent } from "react";

interface Props {
  productId: string;
  title?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "floating" | "inline";
}

const SIZE = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-11 w-11" } as const;
const ICON = { sm: "h-4 w-4", md: "h-4 w-4", lg: "h-5 w-5" } as const;

export function WishlistButton({ productId, title, className, size = "md", variant = "floating" }: Props) {
  const { user } = useAuth();
  const { isSaved, toggle } = useWishlist();
  const navigate = useNavigate();
  const saved = isSaved(productId);

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    void toggle(productId, title);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-smooth",
        SIZE[size],
        variant === "floating"
          ? "bg-background/85 backdrop-blur shadow-card hover:bg-background"
          : "bg-muted hover:bg-muted/70",
        saved && "text-rose-deep",
        !saved && "text-foreground/70 hover:text-rose-deep",
        className,
      )}
    >
      <Heart className={cn(ICON[size], saved && "fill-current")} strokeWidth={1.75} />
    </button>
  );
}
