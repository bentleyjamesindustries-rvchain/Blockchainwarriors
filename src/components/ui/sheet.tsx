import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" }
>(({ className, children, side = "left", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn("fixed z-50 flex h-full w-72 flex-col border-border bg-card p-4", side === "left" ? "top-0 left-0 border-r" : "top-0 right-0 border-l", className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-3 right-3 rounded-sm p-2 text-muted-foreground">
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetContent, SheetClose };
