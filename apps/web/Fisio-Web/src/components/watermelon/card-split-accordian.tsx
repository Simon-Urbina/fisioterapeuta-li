import React, { useState, type FC } from "react";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { ChevronDown } from "lucide-react";
import useMeasure from "react-use-measure";

// Acordeón "split" de Watermelon UI (registry.watermelon.sh),
// readaptado a la paleta del sitio. Una tarjeta abierta a la vez: el
// resto se agrupa con esquinas que se redondean hacia el hueco, así una
// lista larga de tarjetas deja de leerse como un muro plano.

export interface AccordionItemData {
  id: number;
  title: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface AccordionItemProps {
  item: AccordionItemData;
  setOpenId: (id: number | null) => void;
  index: number;
  total: number;
  openIndex: number;
}

interface AccordionProps {
  items: AccordionItemData[];
  className?: string;
}

const springTransition: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 50,
  mass: 1,
};

const AccordionItem: FC<AccordionItemProps> = ({
  item,
  setOpenId,
  index,
  total,
  openIndex,
}) => {
  const [ref, bounds] = useMeasure();
  const isOpen = index === openIndex;

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isBeforeOpen = index === openIndex - 1;
  const isAfterOpen = index === openIndex + 1;
  const isAlone = (isAfterOpen && isLast) || (isBeforeOpen && isFirst);

  const BORDER_WIDTH = "1px";
  const borderTopWidth = isFirst || isAfterOpen || isOpen ? BORDER_WIDTH : "0px";
  const borderBottomWidth =
    isLast || isBeforeOpen || isOpen ? BORDER_WIDTH : "0px";

  let borderTopLeftRadius = 0;
  let borderTopRightRadius = 0;
  let borderBottomLeftRadius = 0;
  let borderBottomRightRadius = 0;

  if (isOpen || isAlone) {
    borderTopLeftRadius = 18;
    borderTopRightRadius = 18;
    borderBottomLeftRadius = 18;
    borderBottomRightRadius = 18;
  } else if (isBeforeOpen) {
    borderBottomLeftRadius = 18;
    borderBottomRightRadius = 18;
  } else if (isAfterOpen) {
    borderTopLeftRadius = 18;
    borderTopRightRadius = 18;
  } else if (isFirst) {
    borderTopLeftRadius = 18;
    borderTopRightRadius = 18;
  } else if (isLast) {
    borderBottomLeftRadius = 18;
    borderBottomRightRadius = 18;
  }

  return (
    <motion.li layout>
      <motion.div
        animate={{
          borderTopLeftRadius,
          borderTopRightRadius,
          borderBottomLeftRadius,
          borderBottomRightRadius,
        }}
        className="overflow-hidden border-solid border-sky-100 bg-white will-change-transform"
        style={{
          borderTopWidth,
          borderBottomWidth,
          borderLeftWidth: BORDER_WIDTH,
          borderRightWidth: BORDER_WIDTH,
          borderStyle: "solid",
          marginBlock: isOpen ? "10px" : "0px",
          boxShadow: isOpen ? "var(--elevation-2)" : "none",
        }}
      >
        <button
          type="button"
          onClick={() => setOpenId(isOpen ? null : item.id)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <span className="flex items-center gap-3">
            {item.icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-deep-600">
                {item.icon}
              </span>
            )}
            <span className="font-display text-sm font-bold text-ink-900 sm:text-base">
              {item.title}
            </span>
          </span>

          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="shrink-0">
            <ChevronDown className="size-5 text-deep-600" />
          </motion.span>
        </button>

        <motion.div
          initial={false}
          animate={{
            height: isOpen ? bounds.height : 0,
            opacity: isOpen ? 1 : 0,
          }}
          className="overflow-hidden will-change-transform"
        >
          <div ref={ref}>
            <div className="px-4 pb-4 text-sm leading-relaxed text-ink-600">
              {item.content}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.li>
  );
};

export function CardSplitAccordion({ items, className }: AccordionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [openId, setOpenId] = useState<number | null>(items[0]?.id ?? null);
  const openIndex = items.findIndex((item) => item.id === openId);

  return (
    <MotionConfig
      transition={prefersReducedMotion ? { duration: 0 } : springTransition}
    >
      <ul className={className}>
        {items.map((item, index) => (
          <AccordionItem
            key={item.id}
            item={item}
            setOpenId={setOpenId}
            index={index}
            total={items.length}
            openIndex={openIndex}
          />
        ))}
      </ul>
    </MotionConfig>
  );
}
