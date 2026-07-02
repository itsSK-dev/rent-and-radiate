import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { Sun, Moon, Smartphone, Check, Bell, ChevronRight, Palette, LogOut, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light Mode", description: "Bright and clean", Icon: Sun },
  { value: "dark", label: "Dark Mode", description: "Easy on the eyes", Icon: Moon },
  { value: "system", label: "System Default", description: "Follow device theme", Icon: Smartphone },
];

const Settings = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your preferences and app experience.</p>
        </div>

        {/* Appearance */}
        <section aria-labelledby="appearance-heading" className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-5 w-5 text-primary" aria-hidden />
            <h2 id="appearance-heading" className="text-lg font-semibold">Appearance</h2>
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Currently:{" "}
                  <span className="text-foreground font-medium capitalize">{theme}</span>
                  {theme === "system" && (
                    <span className="text-muted-foreground"> (using {resolvedTheme})</span>
                  )}
                </p>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-label="Theme"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {THEME_OPTIONS.map(({ value, label, description, Icon }) => {
                const selected = theme === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "relative rounded-xl border p-4 text-left transition-all",
                      "hover:border-primary/50 hover:shadow-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card",
                    )}
                  >
                    {selected && (
                      <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center mb-3",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Your preference is saved on this device and applied instantly across every screen.
            </p>
          </Card>
        </section>

        {/* Notifications shortcut */}
        <section aria-labelledby="notifications-heading">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-primary" aria-hidden />
            <h2 id="notifications-heading" className="text-lg font-semibold">Notifications</h2>
          </div>
          <Card className="p-0 overflow-hidden">
            <Link
              to="/settings/notifications"
              className="flex items-center justify-between p-5 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-medium">Notification preferences</p>
                <p className="text-sm text-muted-foreground">Choose what alerts you want to receive.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Settings;
