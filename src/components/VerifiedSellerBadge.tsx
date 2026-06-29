import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  verified?: boolean | null;
  size?: "sm" | "md";
  className?: string;
};

export function VerifiedSellerBadge({ verified, size = "sm", className = "" }: Props) {
  if (!verified) return null;
  const sm = size === "sm";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 ${sm ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"} ${className}`}
          >
            <BadgeCheck className={sm ? "h-3 w-3" : "h-3.5 w-3.5"} />
            Verified
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Verified seller — approved by Rent &amp; Radiate</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
