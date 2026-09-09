import { pageBox, DEFAULT_PAGE_SIZE } from "../config/pageSizes.js";

export function resolveCanvas(presentation = {}, options = {}) {
  const pageSize = options.pageSize || presentation.pageSize || DEFAULT_PAGE_SIZE;
  const box = pageBox(pageSize, presentation.orientation);
  return {
    ...box,
    strategy: "scale",
    margins: presentation.margins || null,
  };
}
