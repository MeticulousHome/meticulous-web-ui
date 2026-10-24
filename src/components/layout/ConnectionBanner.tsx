import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { CAN_CHANGE_MACHINE } from "../../api/api";
import { useMachine } from "../../contexts/MachineProvider";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { MachineAddressForm } from "../connection/MachineAddressForm";

// Shown when the machine can't be reached for a few seconds. On the dev
// server it also offers to point the page at another address.
export const ConnectionBanner = () => {
  const { connection, machineUrl } = useMachine();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (connection === "connected") {
      setVisible(false);
      return;
    }
    // A short grace period hides the banner during normal (re)connects.
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [connection]);

  if (!visible) return null;

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm sm:px-8">
        <WifiOff size={16} className="text-bad" />
        <span className="text-ink">
          {CAN_CHANGE_MACHINE ? (
            <>
              Can’t reach the machine at{" "}
              <span className="font-mono">
                {machineUrl.replace(/^https?:\/\//, "")}
              </span>
              .
            </>
          ) : (
            "Can’t reach the machine’s backend."
          )}
        </span>
        <span className="text-ink-2">Retrying…</span>
        {CAN_CHANGE_MACHINE && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setOpen(true)}
          >
            Change machine
          </Button>
        )}
      </div>
      {CAN_CHANGE_MACHINE && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Machine"
          description="Choose the machine this page talks to."
        >
          <MachineAddressForm onDone={() => setOpen(false)} />
        </Dialog>
      )}
    </div>
  );
};
