import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Page Not Found",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Compass className="size-10" strokeWidth={1.5} />
      </div>

      <p className="mt-8 font-heading text-8xl font-semibold tracking-tight text-primary">
        404
      </p>

      <h1 className="mt-4 text-xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have been moved.
        Double-check the URL, or head back to the dashboard.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          <Home data-icon="inline-start" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
