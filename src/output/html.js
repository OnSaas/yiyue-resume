import { renderResume } from "../renderer/engine.js";

export function outputHtml(resume, presentation, context = {}) {
  return renderResume(resume, presentation, context);
}

export function outputPrint(resume, presentation, context = {}) {
  return renderResume(resume, presentation, { ...context, print: true });
}

export const OUTPUTS = [
  { id: "html", render: outputHtml },
  { id: "print", render: outputPrint },
];
