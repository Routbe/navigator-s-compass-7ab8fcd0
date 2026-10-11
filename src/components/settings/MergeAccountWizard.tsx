import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { redeemAccountMerge, startAccountMerge } from "@/lib/account-merge.functions";
import { cn } from "@/lib/utils";

type Role = "primary" | "secondary";

/**
 * Tab 4 — sovereign account merge.
 *
 * Primary side: password re-confirmation mints a 5-minute pin + QR payload.
 * Secondary side: pin (or scanned payload) plus its own password executes the
 * transfer and closes the secondary account.
 */
export function MergeAccountWizard() {
  const { t } = useI18n();
  const [role, setRole] = useState<Role>("primary");

  // Step A
  const [primaryPassword, setPrimaryPassword] = useState("");
  const [ticket, setTicket] = useState<{
    pin: string;
    qrPayload: string;
    expiresAt: string;
  } | null>(null);
  const [busyA, setBusyA] = useState(false);

  // Steps B–D
  const [pin, setPin] = useState("");
  const [secondaryPassword, setSecondaryPassword] = useState("");
  const [busyD, setBusyD] = useState(false);

  const generate = async () => {
    setBusyA(true);
    try {
      const result = await startAccountMerge({ data: { password: primaryPassword } });
      if (!result.ok) {
        toast.error("Dat wachtwoord klopt niet. Laat het veld leeg als je geen wachtwoord hebt.");
        return;
      }
      setTicket({ pin: result.pin, qrPayload: result.qrPayload, expiresAt: result.expiresAt });
      setPrimaryPassword("");
    } catch {
      toast.error(t("merge_account.error"));
    } finally {
      setBusyA(false);
    }
  };

  const execute = async () => {
    setBusyD(true);
    try {
      const trimmed = pin.trim();
      const result = await redeemAccountMerge({
        data: trimmed.startsWith("rout-merge:")
          ? { token: trimmed, password: secondaryPassword || undefined }
          : { pin: trimmed, password: secondaryPassword || undefined },
      });
      if (!result.ok) {
        const reason = (result as { reason?: string }).reason;
        toast.error(
          reason === "same_account"
            ? "Deze code hoort bij dit account zelf. Gebruik hem op je tweede account."
            : reason === "bad_password"
              ? "Dat wachtwoord klopt niet. Laat het veld leeg als je geen wachtwoord hebt."
              : "Deze code is ongeldig of verlopen. Genereer een nieuwe op je hoofdaccount.",
        );
        return;
      }
      toast.success(t("merge_account.success"));
      window.location.href = "/auth/sign-in";
    } catch {
      toast.error(t("merge_account.error"));
    } finally {
      setBusyD(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <GitMerge className="h-4 w-4" /> {t("merge_account.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("merge_account.body")}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(["primary", "secondary"] as Role[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={role === option}
            onClick={() => setRole(option)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
              role === option
                ? "border-foreground bg-muted/60 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/40",
            )}
          >
            {option === "primary" ? t("merge_account.primary") : t("merge_account.secondary")}
          </button>
        ))}
      </div>

      {role === "primary" ? (
        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-medium">{t("merge_account.step_a")}</p>
          {ticket ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-full rounded-2xl border-2 border-primary/50 bg-primary/5 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Je merge-code</p>
                <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.4em]">{ticket.pin}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={async () => {
                    await navigator.clipboard.writeText(ticket.pin);
                    toast.success("Code gekopieerd");
                  }}
                >
                  <Copy className="h-4 w-4" /> Kopiëren
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Log in op je tweede account, kies "Dit account samenvoegen met een ander" en vul deze code in. {t("merge_account.expires")}.
              </p>
              <QRCodeSVG value={ticket.qrPayload} size={140} />
              <Button variant="ghost" size="sm" onClick={() => setTicket(null)}>Nieuwe code</Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Je bent al veilig ingelogd. Heb je een wachtwoord? Dan mag je het als extra bevestiging invullen — anders laat je dit leeg.
              </p>
              <Input
                type="password"
                value={primaryPassword}
                maxLength={72}
                placeholder="Wachtwoord (optioneel)"
                onChange={(e) => setPrimaryPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
              <Button
                onClick={generate}
                disabled={busyA}
                className="h-11 w-full gap-1.5 sm:w-auto"
              >
                {busyA ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("merge_account.generate")}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-medium">{t("merge_account.step_b")}</p>
          <Input
            value={pin}
            inputMode="numeric"
            maxLength={64}
            placeholder={t("merge_account.pin")}
            onChange={(e) => setPin(e.target.value)}
            className="h-11 rounded-xl tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            Wachtwoord (optioneel) — ingelogd via Google, Infomaniak of passkey? Laat leeg.
          </p>
          <Input
            type="password"
            value={secondaryPassword}
            maxLength={72}
            placeholder="Wachtwoord (optioneel)"
            onChange={(e) => setSecondaryPassword(e.target.value)}
            className="h-11 rounded-xl"
          />
          <Button
            onClick={execute}
            disabled={busyD || !pin.trim()}
            className="h-11 w-full gap-1.5 sm:w-auto"
          >
            {busyD ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("merge_account.execute")} · {t("merge_account.step_d")}
          </Button>
        </div>
      )}
    </section>
  );
}
