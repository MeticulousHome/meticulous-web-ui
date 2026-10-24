import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Profile } from "@meticulous-home/espresso-profile";
import { profileImageUrl } from "../../api/api";
import { useMachine } from "../../contexts/MachineProvider";
import {
  useProfiles,
  useSettings,
  useUpdateSettings,
} from "../../hooks/useMachineData";
import { setNavigationGuard } from "../../lib/navigationGuard";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { SettingsCard } from "./fields";

const SortableRow = ({
  id,
  index,
  profile,
}: {
  id: string;
  index: number;
  profile?: Profile;
}) => {
  const { machineUrl } = useMachine();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const image = profileImageUrl(machineUrl, profile?.display?.image);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-surface px-4 py-2.5 ${isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        aria-label={`Move ${profile?.name ?? id}`}
        className="cursor-grab touch-none rounded p-1 text-ink-3 hover:bg-raised hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <span className="w-6 text-right text-xs text-ink-3">{index + 1}</span>
      <span className="size-8 shrink-0 overflow-hidden rounded-md bg-raised">
        {image && (
          <img
            src={image}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {profile?.name ?? <span className="font-mono text-ink-3">{id}</span>}
      </span>
    </li>
  );
};

export const ProfileOrderSection = () => {
  const { data: settings } = useSettings();
  const { data: profiles } = useProfiles();
  const mutation = useUpdateSettings();
  const notify = useToast();
  const saved = settings?.profile_order;
  const [order, setOrder] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (saved) setOrder(saved);
  }, [saved]);

  const byId = useMemo(
    () => new Map((profiles ?? []).map((profile) => [profile.id, profile])),
    [profiles],
  );
  const changed = !!saved && order.join() !== saved.join();
  // A navigation held until the user saves or discards the new order.
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);

  useEffect(() => {
    if (!changed) return;
    setNavigationGuard((proceed) => {
      setPendingNavigation(() => proceed);
      return true;
    });
    // Closing or reloading the page gets the browser's own prompt.
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      setNavigationGuard(null);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [changed]);

  const saveOrder = (then?: () => void) =>
    mutation.mutate(
      { profile_order: order },
      {
        onSuccess: () => {
          notify("Profile order saved", "success");
          then?.();
        },
        onError: (error) =>
          notify(`Couldn't save the order: ${error.message}`, "error"),
      },
    );

  const leave = (proceed: () => void) => {
    setPendingNavigation(null);
    setNavigationGuard(null);
    proceed();
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((current) =>
      arrayMove(
        current,
        current.indexOf(String(active.id)),
        current.indexOf(String(over.id)),
      ),
    );
  };

  return (
    <SettingsCard
      description="The order profiles appear in on the dial and on the Machine tab. Drag to rearrange, then save."
      actions={
        <div className="flex gap-2">
          {changed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => saved && setOrder(saved)}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            disabled={!changed}
            loading={mutation.isPending && !pendingNavigation}
            onClick={() => saveOrder()}
          >
            Save order
          </Button>
        </div>
      }
    >
      {!saved ? (
        <p className="px-5 py-4 text-sm text-ink-3">Loading…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-line">
              {order.map((id, index) => (
                <SortableRow
                  key={id}
                  id={id}
                  index={index}
                  profile={byId.get(id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Dialog
        open={pendingNavigation !== null}
        onClose={() => setPendingNavigation(null)}
        size="sm"
        title="Save the new profile order?"
        description="You rearranged the profiles but haven’t saved the order."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingNavigation(null)}>
              Keep editing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (saved) setOrder(saved);
                if (pendingNavigation) leave(pendingNavigation);
              }}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              data-autofocus
              loading={mutation.isPending}
              onClick={() =>
                saveOrder(() => pendingNavigation && leave(pendingNavigation))
              }
            >
              Save order
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Save it to use it on the dial and the Machine tab, or discard it to
          keep the current order.
        </p>
      </Dialog>
    </SettingsCard>
  );
};
