import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CalendarIcon, MapPin, Shield, Sparkles } from "lucide-react";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { demoImageMap } from "@/lib/seedDemo";

type Product = {
  id: string;
  store_id: string;
  category: "dress" | "jewellery";
  title: string;
  description: string | null;
  images: string[];
  price_per_day: number;
  security_deposit: number;
  size: string | null;
  color: string | null;
  condition_notes: string | null;
  store?: { name: string; city: string | null; address: string | null; rating: number } | null;
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*, store:stores(name,city,address,rating)")
        .eq("id", id!).maybeSingle();
      setProduct(data as any);
      if (data) document.title = `${(data as any).title} · Bloom`;
    })();
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="container py-20 text-muted-foreground">Loading…</div>
        <Footer />
      </div>
    );
  }

  const days = start && end ? Math.max(1, differenceInCalendarDays(end, start) + 1) : 0;
  const rentalTotal = days * Number(product.price_per_day);
  const deposit = Number(product.security_deposit);
  const grand = rentalTotal + deposit;
  const heroImg = product.images?.[0] || demoImageMap[product.title];

  async function book() {
    if (!user) {
      toast("Please sign in to rent this piece.");
      navigate(`/auth?next=/product/${id}`);
      return;
    }
    if (!start || !end) return toast.error("Please choose your rental dates.");
    if (delivery === "delivery" && address.trim().length < 8) return toast.error("Please enter a delivery address.");
    setSubmitting(true);
    const { data: created, error } = await supabase.from("rentals").insert({
      customer_id: user.id,
      product_id: product.id,
      store_id: product.store_id,
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
      days,
      rental_total: rentalTotal,
      deposit,
      grand_total: grand,
      delivery_method: delivery,
      address: delivery === "delivery" ? address : null,
    }).select("id").single();
    setSubmitting(false);
    if (error || !created) return toast.error(error?.message ?? "Could not reserve");
    navigate(`/checkout/${created.id}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <section className="container py-10 grid lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="space-y-4 animate-fade-up">
          <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-petal shadow-petal">
            {heroImg && <img src={heroImg} alt={product.title} className="w-full h-full object-cover" />}
          </div>
          {product.images?.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {product.images.slice(0, 4).map((src, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-petal">
                  <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6 animate-fade-up">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-rose-deep">{product.category}</span>
            <h1 className="font-display text-5xl md:text-6xl mt-2">{product.title}</h1>
            {product.store && (
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> {product.store.name}
                {product.store.city ? ` · ${product.store.city}` : ""}
                <span className="text-gold ml-2">★ {Number(product.store.rating).toFixed(1)}</span>
              </p>
            )}
          </div>

          <p className="text-foreground/80 leading-relaxed">{product.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {product.size && <Detail label="Size" value={product.size} />}
            {product.color && <Detail label="Color" value={product.color} />}
            <Detail label="Per day" value={`₹${Number(product.price_per_day).toLocaleString("en-IN")}`} />
            <Detail label="Deposit (refundable)" value={`₹${deposit.toLocaleString("en-IN")}`} />
          </div>

          {product.condition_notes && (
            <div className="rounded-2xl bg-secondary p-4 text-sm flex gap-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span><strong className="font-medium">Condition:</strong> {product.condition_notes}</span>
            </div>
          )}

          {/* Booking card */}
          <div className="rounded-3xl border border-border bg-card p-6 space-y-5 shadow-card">
            <h3 className="font-display text-2xl">Reserve your dates</h3>
            <div className="grid grid-cols-2 gap-3">
              <DateField label="Start" value={start} onChange={(d) => { setStart(d); if (d && end && end < d) setEnd(addDays(d, 1)); }} />
              <DateField label="End" value={end} onChange={setEnd} min={start} />
            </div>

            <div>
              <Label className="text-sm">Delivery</Label>
              <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as any)} className="grid grid-cols-2 gap-2 mt-2">
                <DeliveryOpt value="pickup" label="Store pickup" />
                <DeliveryOpt value="delivery" label="Home delivery" />
              </RadioGroup>
              {delivery === "delivery" && (
                <Textarea
                  placeholder="Delivery address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-3"
                  rows={2}
                />
              )}
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-4">
              <Row label={`Rental (${days || 0} day${days === 1 ? "" : "s"})`} value={`₹${rentalTotal.toLocaleString("en-IN")}`} />
              <Row label="Refundable deposit" value={`₹${deposit.toLocaleString("en-IN")}`} muted />
              <Row label="Total payable" value={`₹${grand.toLocaleString("en-IN")}`} bold />
            </div>

            <Button variant="hero" size="lg" className="w-full" onClick={book} disabled={submitting || !days}>
              {submitting ? "Reserving…" : days ? `Reserve for ₹${grand.toLocaleString("en-IN")}` : "Pick dates to reserve"}
            </Button>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Deposit refunded after item is returned in good condition.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "text-base font-semibold pt-1", muted && "text-muted-foreground")}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function DateField({ label, value, onChange, min }: { label: string; value?: Date; onChange: (d?: Date) => void; min?: Date }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-2", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || (min ? d < min : false)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DeliveryOpt({ value, label }: { value: string; label: string }) {
  return (
    <Label htmlFor={value} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 cursor-pointer hover:border-primary transition-smooth has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
      <RadioGroupItem value={value} id={value} />
      <span className="text-sm">{label}</span>
    </Label>
  );
}

export default ProductDetail;
