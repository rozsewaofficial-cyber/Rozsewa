const _jsxFileName = "tmp_ts/accordion.tsx";import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef

(({ className, ...props }, ref) => (
  React.createElement(AccordionPrimitive.Item, { ref: ref, className: cn("border-b", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 12}} )
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef

(({ className, children, ...props }, ref) => (
  React.createElement(AccordionPrimitive.Header, { className: "flex", __self: this, __source: {fileName: _jsxFileName, lineNumber: 19}}
    , React.createElement(AccordionPrimitive.Trigger, {
      ref: ref,
      className: cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className,
      ),
      ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}

      , children
      , React.createElement(ChevronDown, { className: "h-4 w-4 shrink-0 transition-transform duration-200"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}} )
    )
  )
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef

(({ className, children, ...props }, ref) => (
  React.createElement(AccordionPrimitive.Content, {
    ref: ref,
    className: "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"    ,
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 38}}

    , React.createElement('div', { className: cn("pb-4 pt-0", className), __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}, children)
  )
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
