
function AcceptanceBanner({
  credentialId,
  onChanged,
  mockNotice,
}: {
  credentialId: string;
  onChanged?: () => void;
  mockNotice?: boolean;
}) {
  const accept = useServerFn(acceptCredential);
  const reject = useServerFn(rejectCredential);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const onAccept = async () => {
    if (mockNotice) {
      toast.info("Demo credential — acceptance is disabled.");
      return;
    }
    setBusy(true);
    try {
      await accept({ data: { credentialId } });
      toast.success("Credential accepted");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept");
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setBusy(true);
    try {
      await reject({ data: { credentialId, reason: reason.trim() } });
      toast.success("Credential rejected");
      setOpen(false);
      setReason("");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reject");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-4">
      <div className="font-medium text-warning-foreground">Please review and accept this credential</div>
      <p className="mt-1 text-sm text-muted-foreground">
        This credential is not yet valid and is not anchored on the blockchain. Once you accept it, it becomes valid in your wallet and is anchored automatically. If something is wrong, reject it with a reason for the issuer.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAccept} disabled={busy}>
          <Check className="mr-1 h-3.5 w-3.5" /> Accept credential
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={busy}>
          <X className="mr-1 h-3.5 w-3.5" /> Reject
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject credential</DialogTitle>
            <DialogDescription>
              Explain to the issuer why you are rejecting this credential. They can update the issuance details and resend, or accept your rejection.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The grade is incorrect — should be 9/10."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={onReject}>Reject credential</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
