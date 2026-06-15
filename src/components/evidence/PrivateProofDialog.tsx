import { useState } from "react";
import { Lock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  busy: boolean;
  disabled: boolean;
  onConfirm: () => void;
}

export function PrivateProofDialog({ busy, disabled, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || disabled}
          className="border-destructive/40 text-destructive hover:bg-destructive/5"
        >
          <Lock className="mr-1 h-3.5 w-3.5" />
          {busy ? "Preparing…" : "Download private ownership proof"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Download private ownership proof</AlertDialogTitle>
          <AlertDialogDescription>
            This file contains confidential recovery information associated with
            your credential. Keep it private. Do not send it to employers,
            verifiers or other third parties.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Download private proof
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
