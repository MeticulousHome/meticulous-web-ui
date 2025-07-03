import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "../Switch/Switch";

export const BooleanField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center mb-3 pl-2">
    <Switch isSelected={value} onValueChange={(active) => onChange(active)} />
    <label className="ml-2 block text-sm font-medium text-gray-200">
      {label}
    </label>
  </div>
);

export const ReadOnlyField = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="mb-3 flex">
    <label
      htmlFor={label}
      className="h-full text-sm flex-1/4 font-medium text-gray-200 p-2"
    >
      {label}
    </label>
    <div className="block w-full rounded-md  p-2  shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
      {value}
    </div>
  </div>
);

export const StringField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="mb-3 flex">
    <label
      htmlFor={label}
      className="h-full text-sm flex-1/4 font-medium text-gray-200 p-2"
    >
      {label}
    </label>
    <input
      type="text"
      className="block w-full rounded-md border-2 p-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      id={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) => (
  <div className="mb-3 flex">
    <label
      htmlFor={label}
      className="h-1 flex-1/4 text-sm font-medium text-gray-200 p-2"
    >
      {label}
    </label>
    <input
      type="number"
      className="block w-full rounded-md border-2 p-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      id={label}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </div>
);

function SortableItem({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="border-2 border-gray-200 rounded-md px-4 py-2 mb-2 shadow-sm flex items-center"
    >
      {name}
    </li>
  );
}

export type ListItemProp = {
  key: string;
  value: string;
};

const getItemKey = (item: ListItemProp) => {
  return `${item.value} (${item.key})`;
};

export const DragDropList = ({
  value: items,
  onChange,
}: {
  value: ListItemProp[];
  onChange: (v: ListItemProp[]) => void;
}) => {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(
        (item) => getItemKey(item) === active.id,
      );
      const newIndex = items.findIndex((item) => getItemKey(item) === over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      onChange(newOrder);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((item) => `${item.value} (${item.key})`)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {items.map((id) => (
            <SortableItem
              key={getItemKey(id)}
              id={getItemKey(id)}
              name={id.value}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};
