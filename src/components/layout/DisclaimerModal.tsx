import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DISCLAIMER, MOTTO } from "@/lib/rules";
import { useDeskStore } from "@/lib/store";

export function DisclaimerModal() {
  const hydrated = useDeskStore((s) => s.hydrated);
  const accepted = useDeskStore((s) => s.disclaimerAccepted);
  const accept = useDeskStore((s) => s.acceptDisclaimer);
  const open = hydrated && !accepted;
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>Educational paper desk</DialogTitle>
          <DialogDescription>
            Blockchain Warriors is for education and simulation only. It does not place live orders and is not financial advice. Use at your own risk.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{DISCLAIMER}</p>
        <p className="text-sm text-foreground">{MOTTO}</p>
        <Button className="mt-2 w-full" onClick={accept}>I understand — paper only</Button>
      </DialogContent>
    </Dialog>
  );
}
