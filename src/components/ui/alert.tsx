import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

/**
 * The elements an alert title may render as.
 *
 * The default stays `h5`, so every existing caller is untouched. The escape hatch
 * exists because the correct heading level for an alert title is a property of the
 * page that hosts it, not of the alert: a page whose outline is `h1` → alert would
 * skip four levels and fail `heading-order`, which no amount of styling here can
 * fix. A host that knows its own outline passes the level it needs.
 */
type AlertTitleTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    /** The element to render. Defaults to `h5`, the historical rendering. */
    as?: AlertTitleTag;
  }
>(({ className, as = "h5", ...props }, ref) => {
  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  );
});
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
