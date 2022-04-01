import { useCallback, useMemo, useState } from "react";
import { createEditor, Descendant } from "slate";
import { Slate, Editable, withReact, RenderElementProps } from "slate-react";
import withCustom from "./withCustom";
import {
  withTable,
  RenderTable,
  RenderTableRow,
  RenderTableCell,
} from "../Table";
import "./App.scss";
import AddTable from "./AddTable";

const Element = (elementProp: RenderElementProps) => {
  const { attributes, children, element } = elementProp
  switch (element.type) {
    case 'table':
      return <RenderTable {...elementProp}/>;
    case 'tableRow':
      return <RenderTableRow {...elementProp} />;
    case 'tableCell':
      return <RenderTableCell {...elementProp} />;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

function App() {
  const editor = useMemo(() => withTable(withCustom(withReact(createEditor()))), []);
  const [value, setValue] = useState<Descendant[]>([
    {
      type: 'table',
      children: [
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              rowSpan: 2,
              colSpan: 2,
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试1' }],
                },
              ],
            },
            {
              type: 'tableCell',
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试3' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    { text: '测试4' },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              colSpan: 2,
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试5' }],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          children: [
            {
              type: 'tableCell',
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试6' }],
                },
              ],
            },
            {
              type: 'tableCell',
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试7' }],
                },
              ],
            },
            {
              type: 'tableCell',
              children: [
                {
                  type: 'paragraph',
                  children: [{ text: '测试8' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  const renderElement = useCallback((props) => <Element {...props} />, []);

  return (
    <div className="App">
      <Slate
        editor={editor}
        value={value}
        onChange={(newValue) => {
          console.log(newValue);
          setValue(newValue);
        }}
      >
        <div className="toolbar"><AddTable /></div>
        <Editable
          className="editor"
          autoFocus
          renderElement={renderElement}
          onKeyDown={(e) => {
            editor.emit("keydown", e);
          }}
          onMouseDown={(e) => {
            editor.emit("mousedown", e);
          }}
          onBlur={() => {
            editor.emit("blur");
          }}
        />
      </Slate>
    </div>
  );
}
export default App;
