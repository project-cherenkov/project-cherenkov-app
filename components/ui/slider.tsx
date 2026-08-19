"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// Touch-friendly by default via Radix (pointer events, not hover) — meets
// the "nothing that depends on hover" rule in spec §7 for the viz sliders.
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-3",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
      <SliderPrimitive.Range className="absolute h-full bg-cherenkov-blue-pastel" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-6 w-6 rounded-full border-2 border-cherenkov-blue-pastel bg-white shadow transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      aria-label="value"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
