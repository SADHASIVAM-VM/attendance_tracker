import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { CloseIcon } from "@astraicons/react/linear"

function Drawer({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerBackdrop({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

const drawerVariants = cva(
  "fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-300 ease-in-out border-[#E8EEF4] outline-none font-sans",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full",
        bottom: "inset-x-0 bottom-0 border-t data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-md data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full",
        right: "inset-y-0 right-0 h-full w-full sm:max-w-md md:max-w-lg border-l data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

function DrawerContent({
  className,
  children,
  side = "right",
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Popup> &
  VariantProps<typeof drawerVariants> & { showClose?: boolean }) {
  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(drawerVariants({ side }), className)}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            data-slot="drawer-close"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F4F6F8] hover:bg-slate-200 text-[#464853] hover:text-[#1E1F24] flex items-center justify-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#01B075]"
          >
            <CloseIcon className="w-4 h-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 p-6 border-b border-[#E8EEF4]", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex items-center justify-end gap-2 p-6 border-t border-[#E8EEF4] mt-auto bg-[#FAFCFE]", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base font-bold text-[#1E1F24] tracking-tight", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-xs text-[#71737D]", className)}
      {...props}
    />
  )
}

// Export Drawer and Sheet aliases
export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  Drawer as Sheet,
  DrawerTrigger as SheetTrigger,
  DrawerClose as SheetClose,
  DrawerContent as SheetContent,
  DrawerHeader as SheetHeader,
  DrawerFooter as SheetFooter,
  DrawerTitle as SheetTitle,
  DrawerDescription as SheetDescription,
}
