import { Editor, Element, Transforms } from "slate";
import { useSlate } from "slate-react";
import { tableData } from "./tableData";

export default function AddTable() {
  const editor = useSlate();

  const isInTable = () => {
    const [tableNode] = Editor.nodes(editor, {
      match: (n) =>
        !Editor.isEditor(n) && Element.isElement(n) && n.type === "table",
      mode: "highest",
    });
    return !!tableNode;
  };
  const handleAddTable = () => {
    if (isInTable()) return;
    Transforms.insertNodes(editor, tableData);
  };
  return (
    <span
      className={isInTable() ? "toolbar-disabled" : ""}
      onClick={handleAddTable}
    >
      添加表格
    </span>
  );
}
