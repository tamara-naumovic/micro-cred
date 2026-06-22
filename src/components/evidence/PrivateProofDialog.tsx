import { useState } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("earner");
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
          {busy ? t("evidence.privateProof.preparing") : t("evidence.privateProof.trigger")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("evidence.privateProof.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("evidence.privateProof.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("evidence.privateProof.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {t("evidence.privateProof.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

