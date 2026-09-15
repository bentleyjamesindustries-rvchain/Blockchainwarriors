import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn("peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border data-[state=checked]:bg-primary data-[state=unchecked]:bg-secondary", className)}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className="pointer-events-none block h-4 w-4 translate-x-1 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground" />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;
export { Switch };
