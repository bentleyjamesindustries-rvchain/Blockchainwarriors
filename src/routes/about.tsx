import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/rules";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-6">
      <header>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Blockchain Warriors</p>
        <h1 className="text-2xl font-medium tracking-tight">About this app</h1>
      </header>
      <Card>
        <CardContent className="space-y-3 pt-6 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground">
            A paper desk for Bitcoin and Dogecoin. It reads live prices, maps the last push and dip, and ranks three
            ideas in each lane: long, short, and diamond hand. Each idea includes a possible Elliott Wave read — a
            count, not a certainty.
          </p>
          <p>
            Bitcoin is the leader. Dogecoin longs and diamond buys sit when Bitcoin is weak. Nothing here places a live
            order.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What the score means</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">The score is setup quality from 8 to 92. It is not a win-rate and not a prediction.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><span className="text-foreground">~70–92</span> — more of the map is lined up. Still paper. Still a stop.</li>
            <li><span className="text-foreground">~40–69</span> — mixed. Often a wait, not a take.</li>
            <li><span className="text-foreground">Below ~40</span> — sit.</li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Long</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">A long is a bet that price goes up from the entry. You lose if it falls through the stop.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Short</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">A short is a bet that price goes down from the entry. You lose if it rallies through the stop.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Diamond hand — accumulate</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">Not a swing. A bag. Buy only when price tags a target.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Disclaimer</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground"><p>{DISCLAIMER}</p></CardContent>
      </Card>
    </div>
  );
}
