import {
  TextRun,
  Paragraph,
  AlignmentType,
  BorderStyle,
  TableCell,
  WidthType,
} from "docx";

/** Render a checkbox: ■ (checked) or □ (unchecked) followed by label */
export function checkbox(checked: boolean, label: string): TextRun[] {
  return [
    new TextRun({
      text: checked ? "■" : "□",
      font: "MingLiU",
      size: 24,
    }),
    new TextRun({
      text: label,
      font: "Times New Roman",
      size: 24,
    }),
  ];
}

/** Create a text run with standard formatting */
export function textRun(
  text: string,
  options?: { bold?: boolean; size?: number; underline?: boolean; font?: string }
): TextRun {
  return new TextRun({
    text,
    font: options?.font || "Times New Roman",
    size: options?.size || 24,
    bold: options?.bold,
    underline: options?.underline ? {} : undefined,
  });
}

/** Create a paragraph with standard formatting */
export function para(
  content: string | TextRun[],
  options?: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; size?: number }
): Paragraph {
  const children =
    typeof content === "string"
      ? [textRun(content, { bold: options?.bold, size: options?.size })]
      : content;

  return new Paragraph({
    children,
    alignment: options?.alignment,
    spacing: { after: 0 },
  });
}

/** Light gray border style used in the documents */
export const lightBorder = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "BFBFBF",
};

/** Create a table cell with light gray borders */
export function cell(
  content: Paragraph[],
  options?: {
    width?: number;
    rowSpan?: number;
    columnSpan?: number;
    verticalAlign?: "top" | "center" | "bottom";
  }
): TableCell {
  return new TableCell({
    children: content,
    width: options?.width
      ? { size: options.width, type: WidthType.DXA }
      : undefined,
    rowSpan: options?.rowSpan,
    columnSpan: options?.columnSpan,
    verticalAlign: options?.verticalAlign || "top",
    borders: {
      top: lightBorder,
      bottom: lightBorder,
      left: lightBorder,
      right: lightBorder,
    },
  });
}
