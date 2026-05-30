import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function PaymentResult({ kind }: { kind: "success" | "failure" }) {
  const { rentalId } = useParams();
  const [params] = useSearchParams();
  const reason = params.get("reason");
  const ok = kind === "success";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full rounded-3xl border border-border bg-card p-8 shadow-card text-center space-y-5">
          <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${ok ? "bg-primary-soft text-rose-deep" : "bg-destructive/10 text-destructive"}`}>
            {ok ? <CheckCircle2 className="h-9 w-9" /> : <XCircle className="h-9 w-9" />}
          </div>
          <div>
            <h1 className="font-display text-3xl">
              {ok ? "Payment successful" : "Payment failed"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {ok
                ? "Your order is confirmed. A confirmation email is on its way."
                : reason || "We couldn't complete your payment. No money has been charged."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {ok && rentalId && (
              <Button asChild variant="hero">
                <Link to={`/receipt/${rentalId}`}>View receipt</Link>
              </Button>
            )}
            {!ok && rentalId && (
              <Button asChild variant="hero">
                <Link to={`/checkout/${rentalId}`}>Try again</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/my-rentals">Go to my orders</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
