import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DISCLAIMER } from "@/lib/rules";
import { useDeskStore } from "@/lib/store";
import type { DataSource, DeskSettings } from "@/lib/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const settings = useDeskStore((s) => s.settings);
  const setSettings = useDeskStore((s) => s.setSettings);
  const reset = useDeskStore((s) => s.resetPaper);
  const equity = useDeskStore((s) => s.equity);

  function num(key: keyof DeskSettings, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setSettings({ [key]: n } as Partial<DeskSettings>);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-6">
      <header>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Desk</p>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Risk</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="BTC risk % of equity">
            <Input type="number" step="0.25" value={settings.riskPct} onChange={(e) => num("riskPct", e.target.value)} />
          </Field>
          <Field label="DOGE risk % of equity">
            <Input
              type="number"
              step="0.25"
              value={settings.dogeRiskPct ?? 0.75}
              onChange={(e) => num("dogeRiskPct", e.target.value)}
            />
          </Field>
          <Field label="Min R:R">
            <Input type="number" step="0.1" value={settings.minRr} onChange={(e) => num("minRr", e.target.value)} />
          </Field>
          <Field label="Daily loss kill %">
            <Input type="number" step="0.5" value={settings.dailyLossPct} onChange={(e) => num("dailyLossPct", e.target.value)} />
          </Field>
          <Field label="Max trades / day">
            <Input type="number" value={settings.maxTradesPerDay} onChange={(e) => num("maxTradesPerDay", e.target.value)} />
          </Field>
          <Field label="Starting paper equity">
            <Input
              type="number"
              value={settings.paperEquityStart}
              onChange={(e) => num("paperEquityStart", e.target.value)}
            />
          </Field>
          <Field label="Current equity">
            <Input readOnly value={equity.toFixed(2)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Lookback days">
            <Input type="number" value={settings.lookbackDays} onChange={(e) => num("lookbackDays", e.target.value)} />
          </Field>
          <Field label="Data source">
            <select
              className="flex h-10 w-full rounded-sm border border-input bg-background px-3 text-sm"
              value={settings.dataSource}
              onChange={(e) => setSettings({ dataSource: e.target.value as DataSource })}
            >
              <option value="auto">Auto</option>
              <option value="coinbase">Coinbase</option>
              <option value="yahoo">Yahoo Finance</option>
              <option value="coingecko">CoinGecko</option>
              <option value="tradingview">TradingView first</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={settings.enableBtcLead} onCheckedChange={(v) => setSettings({ enableBtcLead: v })} />
            Only pitch DOGE longs when Bitcoin looks healthy
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Put this on your phone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground">
            This is a home-screen app. Open the desk in your phone browser, then pin it. No App Store needed.
          </p>
          <div>
            <p className="font-medium text-foreground">iPhone</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Open this page in Safari (not inside another app if you can avoid it).</li>
              <li>Tap the Share button.</li>
              <li>Tap Add to Home Screen.</li>
              <li>Name it Blockchain Warriors and Add.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-foreground">Android</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Open this page in Chrome.</li>
              <li>Tap the three dots.</li>
              <li>Tap Add to Home screen or Install app.</li>
            </ol>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set("install", "1");
              window.location.assign(url.toString());
            }}
          >
            Open install pictures
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={reset}>
        Reset paper equity & journal
      </Button>
      <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
