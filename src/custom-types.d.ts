import { BaseEditor } from "slate";
import { ReactEditor } from "slate-react";
import ee from 'event-emitter'
import {
  TableElement,
  TableRowElement,
  TableCellElement,
} from "./components/Table/customTypes";

type ParagraphElement = { type: "paragraph"; children: Descendant[] };
type CustomElement =
  | ParagraphElement
  | TableElement
  | TableRowElement
  | TableCellElement;

type extendEditor = {
  tableState: {
    showSelection: boolean
    selection: Path[]
  }
  // 自定义事件
  on: (type: string, listener: ee.EventListener) => void
  off: (type: string, listener: ee.EventListener) => void
  once: (type: string, listener: ee.EventListener) => void
  emit: (type: string, ...args: any[]) => void
}
export type CustomEditor = BaseEditor & ReactEditor & extendEditor;

declare module "slate" {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
  }
}
