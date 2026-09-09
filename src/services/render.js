import { outputHtml } from "../output/html.js";
import { resolvePresentation, normalizePresentation } from "../schema/presentation.js";
import { resolveCanvas } from "../domain/canvas.js";

export function renderService() {
  return {
    html(resume, presentation, context) {
      const resolved = normalizePresentation(presentation);
      return outputHtml(resume, resolved, context);
    },
    resolve(resumePres, override) {
      return resolvePresentation(resumePres, override);
    },
    canvas(presentation) {
      return resolveCanvas(presentation);
    },
  };
}
